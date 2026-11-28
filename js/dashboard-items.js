import { requireAuth, setupLogout } from './dashboard-auth.js';
import { escapeHtml, logError } from './security.js';
import { refreshNotifBadge } from './dashboard-notifications.js';
import { attachModalA11y } from './modal-a11y.js';
import { calculateDaysLeft, isNoWarranty, parseLocalDate } from './warranty-utils.js';
import { buildBuyerReceiptOrFilter, fetchCurrentUserPhone } from './phone-utils.js';
import { createSegmentedIndicator } from './segmented-indicator.js';
import { collapseAndRemove, haptic, pulseHighlight } from './ui-effects.js';

let currentClient = null;
let currentUserId = null;
let currentUserEmail = null;
let pendingDeleteItemId = null;
let verifiedStats = { total: 0, active: 0, expiring: 0, expired: 0 };
let lastMineItems = [];
let lastVerifiedReceipts = [];
let lastVerifiedItems = [];
let linkedReceiptsByItemId = new Map();
let currentItemsSort = sessionStorage.getItem('valuon-items-sort') || 'newest';
let userDefaultCurrency = 'EUR';
const verifiedReceiptPdfCache = new Map();
const SIGNED_URL_TTL = 60 * 60;

function renderItemCurrencySelects() {
    const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
    document.querySelectorAll('#add-modal select[name="currency"], #edit-modal select[name="currency"]').forEach((select) => {
        if (typeof window.renderCurrencyOptions === 'function') window.renderCurrencyOptions(select, lang);
    });
    if (typeof CustomSelect !== 'undefined') CustomSelect.refreshAll();
}

function renderItemTypeSelects() {
    const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
    document.querySelectorAll('#add-modal select[name="type"], #edit-modal select[name="type"]').forEach((select) => {
        if (typeof window.renderDeviceTypeOptions === 'function') window.renderDeviceTypeOptions(select, lang, { withIcons: true });
    });
    if (typeof CustomSelect !== 'undefined') CustomSelect.refreshAll();
}

window.addEventListener('lang-changed', renderItemCurrencySelects);
window.addEventListener('lang-changed', renderItemTypeSelects);

// Настройки — отдельная вкладка того же SPA (dashboard.html), которая
// подгружается один раз при заходе на страницу. Без этого слушателя смена
// валюты по умолчанию в настройках не долетала бы до модалки добавления
// вещи до перезагрузки страницы.
window.addEventListener('currency-changed', (e) => {
    if (e.detail?.currency) userDefaultCurrency = e.detail.currency;
});

function applySavedItemsTab() {
    let saved = 'verified';
    try { saved = localStorage.getItem('valuon-items-tab') || 'verified'; } catch (_) {}
    if (saved === 'verified') return;

    document.querySelector('#items-tabs .items-tab[data-items-tab="verified"]')?.classList.remove('active');
    document.querySelector('#items-tabs .items-tab[data-items-tab="verified"]')?.setAttribute('aria-selected', 'false');
    document.querySelector('#items-tabs .items-tab[data-items-tab="mine"]')?.classList.add('active');
    document.querySelector('#items-tabs .items-tab[data-items-tab="mine"]')?.setAttribute('aria-selected', 'true');

    document.getElementById('items-grid-verified')?.classList.add('hidden');
    document.getElementById('items-grid-mine')?.classList.remove('hidden');
}

async function initDashboardItems() {
    const auth = await requireAuth();
    if (!auth) return;

    currentClient = auth.client;
    currentUserId = auth.user.id;
    currentUserEmail = auth.user.email;
    setupLogout(auth.client);

    const { data: profile } = await auth.client
        .from('profiles')
        .select('currency')
        .eq('id', auth.user.id)
        .single();
    userDefaultCurrency = profile?.currency || 'EUR';
    renderItemCurrencySelects();
    renderItemTypeSelects();

    applySavedItemsTab();
    setupItemsTabs(auth.user.id, auth.user.email, auth.client);
    setupItemsSort();
    setupItemsSearch();
    // Bind any pending partner receipts issued before first sign-in (e.g. Google OAuth) once per session
    const bindSessionKey = `valuon-bound-pending:${auth.user.id}`;
    if (!sessionStorage.getItem(bindSessionKey)) {
        try {
            await auth.client.rpc('bind_pending_receipts');
            sessionStorage.setItem(bindSessionKey, '1');
        } catch (_) { /* non-critical */ }
    }
    await Promise.all([
        loadItems(auth.user.id, auth.client),
        loadVerifiedItems(auth.user.email, auth.client)
    ]);
    let hasSavedItemsTab = false;
    try { hasSavedItemsTab = Boolean(localStorage.getItem('valuon-items-tab')); } catch (_) {}
    if (!hasSavedItemsTab && lastVerifiedReceipts.length === 0 && lastMineItems.length > 0) {
        activateItemsTab('mine', { instant: false });
    }
    const urlParams = new URLSearchParams(window.location.search);
    const highlightItemId = urlParams.get('highlight_item');
    if (highlightItemId) {
        urlParams.delete('highlight_item');
        const nextQs = urlParams.toString();
        try { history.replaceState(null, '', `${window.location.pathname}${nextQs ? `?${nextQs}` : ''}${window.location.hash}`); } catch (_) {}
        activateItemsTab('mine', { instant: true });
        setTimeout(() => {
            const card = document.querySelector(`#items-grid-mine [data-id="${CSS.escape(highlightItemId)}"]`)?.closest('.item-card');
            if (card) pulseHighlight(card);
        }, 140);
    }
    window.addEventListener('phone-changed', () => {
        verifiedReceiptPdfCache.clear();
        loadVerifiedItems(auth.user.email, auth.client);
    });

    const renderSidebarProfile = (override) => {
        const avatarEl = document.getElementById('sidebar-profile-avatar');
        const nameEl = document.getElementById('sidebar-profile-name');
        const emailEl = document.getElementById('sidebar-profile-email');
        if (!avatarEl && !nameEl && !emailEl) return;
        const email = auth.user?.email || '';
        const meta = auth.user?.user_metadata || {};
        const googleFull = String(meta.full_name || meta.name || '').trim();
        const spacePos = googleFull.indexOf(' ');
        const fallbackFirst = spacePos > 0 ? googleFull.slice(0, spacePos).trim() : googleFull;
        const fallbackLast = spacePos > 0 ? googleFull.slice(spacePos + 1).trim() : '';
        const firstName = String(override?.firstName !== undefined ? override.firstName : (meta.first_name || meta.given_name || fallbackFirst || '')).trim();
        const lastName = String(override?.lastName !== undefined ? override.lastName : (meta.last_name || meta.family_name || fallbackLast || '')).trim();
        const combined = [firstName, lastName].filter(Boolean).join(' ');
        const rawName = String(override?.displayName !== undefined ? override.displayName : (combined || meta.display_name || googleFull || '')).trim();
        const fallbackName = email ? email.split('@')[0] : 'Account';
        const displayName = rawName || fallbackName;

        let initials = '';
        if (firstName && lastName) {
            initials = (Array.from(firstName)[0] + Array.from(lastName)[0]).toUpperCase();
        } else if (firstName) {
            initials = Array.from(firstName)[0].toUpperCase();
        } else if (lastName) {
            initials = Array.from(lastName)[0].toUpperCase();
        } else {
            const parts = displayName.split(/\s+/).filter(Boolean);
            initials = parts.length >= 2
                ? (Array.from(parts[0])[0] + Array.from(parts[parts.length - 1])[0]).toUpperCase()
                : (Array.from(displayName)[0] || 'U').toUpperCase();
        }
        if (avatarEl) avatarEl.textContent = initials || 'U';
        if (nameEl) nameEl.textContent = displayName;
        if (emailEl) emailEl.textContent = email;
    };
    renderSidebarProfile();
    window.addEventListener('valuon:profile-updated', (e) => {
        renderSidebarProfile(e.detail || {});
    });
    let liveReceiptsRefreshTimer = null;
    window.addEventListener('valuon:receipts-updated', () => {
        clearTimeout(liveReceiptsRefreshTimer);
        liveReceiptsRefreshTimer = setTimeout(() => {
            verifiedReceiptPdfCache.clear();
            loadVerifiedItems(auth.user.email, auth.client, { silent: true });
        }, 250);
    });
    setupModal(auth.client, auth.user.id);
    setupEditModal(auth.client, auth.user.id);
    setupDeleteItemModal(auth.client, auth.user.id);
}

const VALID_ITEMS_SORTS = new Set(['newest', 'warranty_asc', 'price_desc', 'price_asc']);
let currentItemsSearch = '';

function setupItemsSearch() {
    const input = document.getElementById('items-search-input');
    const clearBtn = document.getElementById('items-search-clear');
    if (!input) return;

    const applySearch = (val) => {
        currentItemsSearch = String(val || '').trim().toLowerCase();
        if (clearBtn) clearBtn.style.display = currentItemsSearch ? '' : 'none';
        const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
        const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.en || {};
        renderItems(lastMineItems, { animateCount: false });
        renderVerifiedItems(lastVerifiedReceipts, t, { animateCount: false });
    };

    input.addEventListener('input', () => applySearch(input.value));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && input.value) {
            input.value = '';
            applySearch('');
        }
    });
    clearBtn?.addEventListener('click', () => {
        input.value = '';
        applySearch('');
        input.focus();
    });
}

function matchesItemSearch(item, isVerified) {
    if (!currentItemsSearch) return true;
    const fields = isVerified
        ? [item.item_name, item.name, item.shop_name, item.category]
        : [item.name, item.brand, item.store_name, item.serial_number, item.location, item.type];
    return fields.some(v => v && String(v).toLowerCase().includes(currentItemsSearch));
}

function renderItemsSearchEmpty(grid, t) {
    grid.innerHTML = `
        <div class="empty-state" data-animate="zoom">
            <div class="empty-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
            <h3 data-i18n="search_empty_title">${escapeHtml(t.search_empty_title || 'Nothing found')}</h3>
            <p data-i18n="search_empty_desc">${escapeHtml(t.search_empty_desc || 'Try a different search query')}</p>
            <button type="button" class="btn btn-outline empty-state-cta btn-reset-items-search">
                <span data-i18n="search_reset_btn">${escapeHtml(t.search_reset_btn || 'Reset search')}</span>
            </button>
        </div>`;
    grid.querySelector('.btn-reset-items-search')?.addEventListener('click', () => {
        const input = document.getElementById('items-search-input');
        if (input) {
            input.value = '';
            input.dispatchEvent(new Event('input'));
        }
    });
}

function setupItemsSort() {
    const select = document.getElementById('items-sort-select');
    if (!select) return;
    if (!VALID_ITEMS_SORTS.has(currentItemsSort)) {
        currentItemsSort = 'newest';
    }
    select.value = currentItemsSort;
    if (typeof CustomSelect !== 'undefined') CustomSelect.refreshAll();

    select.addEventListener('change', () => {
        const nextSort = VALID_ITEMS_SORTS.has(select.value) ? select.value : 'newest';
        currentItemsSort = nextSort;
        sessionStorage.setItem('valuon-items-sort', nextSort);
        const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
        const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
        renderItems(lastMineItems, { animateCount: false });
        renderVerifiedItems(lastVerifiedReceipts, t, { animateCount: false });
    });
}

function getItemDateTs(item) {
    const raw = item.purchase_date || item.created_at;
    if (!raw) return 0;
    const dt = (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim()))
        ? parseLocalDate(raw)
        : new Date(raw);
    const ms = dt ? dt.getTime() : NaN;
    return Number.isFinite(ms) ? ms : 0;
}

function sortDashboardItems(items, mode, isVerified) {
    const copy = [...(items || [])];
    const getPrice = (it) => {
        const val = parseFloat(isVerified ? it.gross_total : it.price);
        return Number.isFinite(val) && val > 0 ? val : null;
    };

    copy.sort((a, b) => {
        if (mode === 'warranty_asc') {
            const noA = isNoWarranty(a);
            const noB = isNoWarranty(b);
            const daysA = noA ? null : calculateDaysLeft(a.warranty_end_date);
            const daysB = noB ? null : calculateDaysLeft(b.warranty_end_date);
            const bucketA = noA ? 2 : (daysA >= 0 ? 0 : 1);
            const bucketB = noB ? 2 : (daysB >= 0 ? 0 : 1);
            if (bucketA !== bucketB) return bucketA - bucketB;
            if (bucketA === 0 && daysA !== daysB) return daysA - daysB;
            if (bucketA === 1 && daysA !== daysB) return daysB - daysA;
            return getItemDateTs(b) - getItemDateTs(a);
        }
        if (mode === 'price_desc' || mode === 'price_asc') {
            const pa = getPrice(a);
            const pb = getPrice(b);
            if (pa === null && pb === null) return getItemDateTs(b) - getItemDateTs(a);
            if (pa === null) return 1;
            if (pb === null) return -1;
            if (pa !== pb) return mode === 'price_desc' ? pb - pa : pa - pb;
            return getItemDateTs(b) - getItemDateTs(a);
        }
        return getItemDateTs(b) - getItemDateTs(a);
    });
    return copy;
}

async function openLinkedPersonalReceipt(itemId, btn) {
    const receipt = linkedReceiptsByItemId.get(String(itemId));
    if (!receipt || !currentClient) return;
    const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
    const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};

    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        let targetUrl = receipt.file_url || '';
        const expiresAt = receipt.created_at
            ? new Date(receipt.created_at).getTime() + SIGNED_URL_TTL * 1000
            : 0;
        const needsRefresh = receipt.file_path && (!targetUrl || Date.now() >= expiresAt);

        if (needsRefresh) {
            const { data, error } = await currentClient.storage
                .from('receipts')
                .createSignedUrl(receipt.file_path, SIGNED_URL_TTL);
            if (error || !data?.signedUrl) throw error || new Error('Failed to create signed URL');
            targetUrl = data.signedUrl;
            receipt.file_url = targetUrl;
            receipt.created_at = new Date().toISOString();
        }

        if (!targetUrl) throw new Error('Missing receipt URL');
        const parsed = new URL(targetUrl, window.location.origin);
        if (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && parsed.origin === window.location.origin)) {
            window.open(parsed.href, '_blank', 'noopener,noreferrer');
        } else {
            throw new Error('Unsupported URL protocol');
        }
    } catch (e) {
        logError('items:openLinkedReceipt', e);
        showToast(t.receipt_open_error || (lang === 'ru' ? 'Не удалось открыть файл чека' : 'Failed to open receipt file'), 'error');
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

function getTotalWarrantyDays(item) {
    const start = item?.purchase_date ? parseLocalDate(item.purchase_date) : null;
    const end = item?.warranty_end_date ? parseLocalDate(item.warranty_end_date) : null;
    if (start && end) {
        const diff = Math.round((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000);
        if (diff > 0) return diff;
    }
    return (Number(item?.warranty_months) || 12) * 30;
}

function getTodayLocalIso() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseWarrantyMonthsInput(rawVal) {
    const trimmed = String(rawVal ?? '').trim();
    if (!trimmed) return 0;
    const m = parseInt(trimmed, 10);
    return Number.isFinite(m) && m > 0 ? Math.min(600, m) : 0;
}

async function downloadVerifiedReceiptPDF(receiptId, btn) {
    if (!receiptId || !currentClient || (!currentUserId && !currentUserEmail)) return;
    const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        const { ensurePdfLibsLoaded, downloadReceiptPDF } = await import('./receipt-generator.js?v=20261126l');
        await ensurePdfLibsLoaded();
        let receipt = verifiedReceiptPdfCache.get(String(receiptId));

        if (!receipt) {
            const userPhone = await fetchCurrentUserPhone(currentClient, currentUserId);
            const buyerOrFilter = buildBuyerReceiptOrFilter({ userId: currentUserId, email: currentUserEmail, phone: userPhone });

            let pdfRes = buyerOrFilter
                ? await currentClient
                    .from('business_receipts')
                    .select('*, receipt_items(*)')
                    .eq('id', receiptId)
                    .or(buyerOrFilter)
                    .order('sort_order', { referencedTable: 'receipt_items', ascending: true })
                    .single()
                : { data: null, error: new Error('Receipt not found') };

            if (pdfRes.error && pdfRes.error.code === '42703' && currentUserEmail) {
                pdfRes = await currentClient
                    .from('business_receipts')
                    .select('*, receipt_items(*)')
                    .eq('id', receiptId)
                    .eq('customer_email', currentUserEmail)
                    .order('sort_order', { referencedTable: 'receipt_items', ascending: true })
                    .single();
            }

            const { data, error } = pdfRes;
            if (error || !data) throw error || new Error('Receipt not found');
            receipt = data;

            if (!Array.isArray(receipt.receipt_items) || receipt.receipt_items.length === 0) {
                const { data: items } = await currentClient
                    .from('receipt_items')
                    .select('*')
                    .eq('receipt_id', receipt.id)
                    .order('sort_order');
                if (items?.length) receipt.receipt_items = items;
            }
            verifiedReceiptPdfCache.set(String(receiptId), receipt);
        }

        let shopMeta = {};
        if (receipt.shop_id) {
            try {
                const { data: sData } = await currentClient
                    .rpc('get_shop_public_info', { p_shop_id: receipt.shop_id });
                const row = Array.isArray(sData) ? sData[0] : sData;
                if (row) shopMeta = row;
            } catch (_) { }
        }

        const mockShop = {
            shop_name: receipt.shop_name || shopMeta.shop_name || 'Partner Store',
            address: receipt.address || shopMeta.address || '',
            country: receipt.country || shopMeta.country || null,
            currency: receipt.currency || 'EUR',
            tax_id: receipt.tax_id || shopMeta.tax_id || '',
            logo_path: receipt.logo_path || shopMeta.logo_path || null,
            contact_email: shopMeta.contact_email || '',
            contact_phone: shopMeta.contact_phone || ''
        };
        await downloadReceiptPDF(receipt, mockShop);
    } catch (e) {
        logError('items:downloadVerifiedReceipt', e);
        showToast(
            lang === 'ru'
                ? 'Генератор PDF пока недоступен'
                : 'PDF generator is not available yet',
            'error'
        );
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}


let loadItemsSeq = 0;

async function loadItems(userId, client) {
    const grid = document.querySelector('#items-grid-mine');
    if (!grid) return;

    const seq = ++loadItemsSeq;

    grid.innerHTML = '<div class="rotating-loader"></div>';
    const loaderEl = grid.querySelector('.rotating-loader');
    if (loaderEl && typeof RotatingTextLoader !== 'undefined') {
        const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
        const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
        new RotatingTextLoader(loaderEl, [
            t.loading_items || 'Загружаем покупки…',
            t.loading_items_check || 'Проверяем данные…',
            t.loading_items_update || 'Обновляем статусы…'
        ], { interval: 800 });
    }

    const [itemsRes, receiptsRes] = await Promise.all([
        client
            .from('items')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }),
        client
            .from('receipts')
            .select('id, item_id, file_url, file_path, file_type, receipt_name, created_at')
            .eq('user_id', userId)
            .not('item_id', 'is', null)
            .order('created_at', { ascending: false })
    ]);

    if (seq !== loadItemsSeq) return;

    const { data: items, error } = itemsRes;

    if (error) {
        logError('items:load', error);
        const loadLang = (window.getValuonLang ? window.getValuonLang() : 'en');
        grid.innerHTML = '<p class="empty-state error">' + (loadLang === 'en' ? 'Data load error.' : 'Ошибка загрузки данных.') + '</p>';
        return;
    }

    linkedReceiptsByItemId = new Map();
    if (!receiptsRes.error && Array.isArray(receiptsRes.data)) {
        receiptsRes.data.forEach(r => {
            const key = String(r.item_id);
            if (!linkedReceiptsByItemId.has(key)) {
                linkedReceiptsByItemId.set(key, r);
            }
        });
    }

    const safeItems = items || [];

    lastMineItems = safeItems;
    renderItems(safeItems);
    updateStats(safeItems);

    if (typeof window.applyDashboardLang === 'function') {
        window.applyDashboardLang((window.getValuonLang ? window.getValuonLang() : 'en'));
    }
}

export { calculateDaysLeft };

function getStatusInfo(daysLeft) {
    if (daysLeft > 30) return { class: 'active' };
    if (daysLeft >= 0) return { class: 'warning' };
    return { class: 'expired' };
}

function renderItems(items, opts = {}) {
    const grid = document.querySelector('#items-grid-mine');
    if (!grid) return;

    const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
    const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};

    const countEl = document.getElementById('items-count-mine');
    if (countEl && opts.animateCount !== false) window.animateCount(countEl, items.length);

    if (items.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" data-animate="zoom">
                <div class="empty-icon"><i class="fa-solid fa-box-open"></i></div>
                <h3 data-i18n="empty_state_title">${escapeHtml(t.empty_state_title || 'Пока нет добавленных вещей')}</h3>
                <p data-i18n="empty_state">${escapeHtml(t.empty_state || 'Добавьте первую покупку — чек, гарантию, серийный номер.')}</p>
                <button type="button" class="btn btn-outline empty-state-cta" id="empty-add-item-btn">
                    <i class="fa-solid fa-plus"></i> <span data-i18n="empty_state_cta">${escapeHtml(t.empty_state_cta || 'Добавить вещь')}</span>
                </button>
            </div>`;

        document.getElementById('empty-add-item-btn')?.addEventListener('click', () => {
            document.getElementById('add-item-btn')?.click();
        });
        return;
    }

    const filteredItems = currentItemsSearch
        ? items.filter(it => matchesItemSearch(it, false))
        : items;

    if (filteredItems.length === 0) {
        renderItemsSearchEmpty(grid, t);
        return;
    }

    const sortedItems = sortDashboardItems(filteredItems, currentItemsSort, false);

    grid.innerHTML = sortedItems.map(item => {
        const iconClass = (item.type && Object.prototype.hasOwnProperty.call(window.DEVICE_ICONS, item.type))
            ? window.DEVICE_ICONS[item.type]
            : window.DEVICE_ICONS.other;
        const noWarranty = isNoWarranty(item);
        const daysLeft = noWarranty ? null : calculateDaysLeft(item.warranty_end_date);
        const status = noWarranty ? null : getStatusInfo(daysLeft);
        const totalDays = getTotalWarrantyDays(item);
        const progress = noWarranty ? 0
            : totalDays > 0 ? Math.max(0, Math.min(100, (daysLeft / totalDays) * 100)) : 0;
        const statusClass = noWarranty ? 'none' : status.class;

        const stats = [];
        if (item.serial_number) {
            const shortSerial = item.serial_number.length > 10
                ? escapeHtml(item.serial_number.substring(0, 10)) + '…'
                : escapeHtml(item.serial_number);
            stats.push({ icon: 'fa-barcode', labelKey: 'stat_serial', fallback: 'Serial #', value: shortSerial });
        }
        if (item.store_name) {
            stats.push({ icon: 'fa-store', labelKey: 'stat_store', fallback: 'Store', value: escapeHtml(item.store_name) });
        }
        if (item.price && item.price > 0) {
            stats.push({ icon: 'fa-tag', labelKey: 'stat_price', fallback: 'Price', value: escapeHtml(window.formatCurrency(item.price, item.currency || 'EUR', lang)) });
        }
        let dateStr = '';
        if (item.purchase_date) {
            const d = item.purchase_date.slice(0, 10).split('-');
            dateStr = lang === 'ru' ? `${d[2]}.${d[1]}.${d[0]}` : `${d[1]}/${d[2]}/${d[0]}`;
            stats.push({ icon: 'fa-regular fa-calendar', labelKey: 'stat_date', fallback: 'Date', value: escapeHtml(dateStr) });
        }
        const statsHtml = stats.map(s => `
                        <div class="mine-stat${s.accent ? ' accent' : ''}">
                            <span class="mine-stat-icon"><i class="fa-solid ${s.icon}"></i></span>
                            <div class="mine-stat-text">
                                <div class="mine-stat-label" data-i18n="${s.labelKey}">${escapeHtml(t[s.labelKey] || s.fallback)}</div>
                                <div class="mine-stat-value" title="${s.value}">${s.value}</div>
                            </div>
                        </div>`).join('');

        const btnEditText = escapeHtml(t.btn_edit || 'Изменить');
        const btnDeleteText = escapeHtml(t.btn_delete || 'Удалить');
        const btnCalendarText = escapeHtml(t.add_to_calendar || 'В календарь');
        const btnOpenReceiptText = escapeHtml(t.btn_open_receipt || (lang === 'ru' ? 'Открыть чек' : 'Open receipt'));
        const hasLinkedReceipt = linkedReceiptsByItemId.has(String(item.id));
        const linkedReceiptButtonHtml = hasLinkedReceipt ? `
                        <button type="button" class="btn-action btn-open-linked-receipt" data-item-id="${escapeHtml(item.id)}"
                                title="${btnOpenReceiptText}" aria-label="${btnOpenReceiptText}">
                            <i class="fa-solid fa-receipt"></i>
                        </button>` : '';
        const calendarButtonHtml = item.warranty_end_date && daysLeft >= 0 ? `
                        <button type="button" class="btn-action btn-add-calendar btn-calendar-wide" data-id="${escapeHtml(item.id)}"
                                title="${btnCalendarText}" aria-label="${btnCalendarText}">
                            <i class="fa-solid fa-calendar-plus" aria-hidden="true"></i>
                            <span data-i18n="add_to_calendar">${btnCalendarText}</span>
                        </button>` : '';

        let progressSectionHtml;
        if (noWarranty) {
            progressSectionHtml = `
                        <div class="mine-progress">
                            <div class="mine-progress-top">
                                <span class="days-left-text none" data-i18n="no_warranty">${escapeHtml(t.no_warranty || 'No warranty')}</span>
                            </div>
                            <div class="no-warranty-track"><i class="fa-solid fa-shield-slash"></i></div>
                        </div>`;
        } else {
            const progressTextKey = daysLeft > 0 ? 'days_left' : (daysLeft === 0 ? 'warranty_expires_today' : 'warranty_expired_text');
            const untilLabel = escapeHtml(t.progress_until || 'until');
            const endD = item.warranty_end_date ? item.warranty_end_date.slice(0, 10).split('-') : null;
            const endDateStr = endD ? (lang === 'ru' ? `${endD[2]}.${endD[1]}.${endD[0]}` : `${endD[1]}/${endD[2]}/${endD[0]}`) : '';
            progressSectionHtml = `
                        <div class="mine-progress">
                            <div class="mine-progress-top">
                                <span class="days-left-text ${status.class}"
                                      data-i18n="${progressTextKey}"
                                      data-i18n-count="${daysLeft > 0 ? daysLeft : ''}"></span>
                                <span class="mine-progress-until">${endDateStr ? `<span data-i18n="progress_until">${untilLabel}</span> ${escapeHtml(endDateStr)}` : ''}</span>
                            </div>
                            <div class="mine-progress-track">
                                <div class="mine-progress-fill ${status.class}" data-progress="${progress}"></div>
                            </div>
                        </div>`;
        }

        return `
            <div class="mine-item-card is-${statusClass}" data-item-id="${escapeHtml(item.id)}">
                <div class="mine-item-header">
                    <div class="mine-item-icon"><i class="fa-solid ${iconClass}"></i></div>
                    <div class="mine-item-heading">
                        <h3 class="mine-item-title" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</h3>
                        <div class="mine-item-brand">${escapeHtml(item.brand) || escapeHtml(t.brand_not_specified || 'Brand not specified')}</div>
                    </div>
                </div>

                <div class="mine-item-body">
                    ${stats.length ? `<div class="mine-stats-grid">${statsHtml}</div>` : ''}

                    ${progressSectionHtml}

                    <div class="mine-item-actions-wrap">
                        ${calendarButtonHtml}
                        <div class="mine-item-actions">
                            ${linkedReceiptButtonHtml}
                            <button class="btn-action btn-edit-item" data-id="${escapeHtml(item.id)}" title="${btnEditText}">
                                <i class="fa-solid fa-pen"></i>
                                <span data-i18n="btn_edit">${btnEditText}</span>
                            </button>
                            <button class="btn-action btn-delete-item" data-id="${escapeHtml(item.id)}" title="${btnDeleteText}">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            grid.querySelectorAll('.mine-progress-fill[data-progress]').forEach(el => {
                const progress = parseFloat(el.dataset.progress);
                el.style.width = `${progress}%`;
                el.removeAttribute('data-progress');
            });
        });
    });

    grid.querySelectorAll('.btn-edit-item').forEach(btn => {
        btn.addEventListener('click', () => {
            openEditModal(btn.dataset.id, currentClient, currentUserId).catch(e => {
                logError('items:openEditModal', e);
            });
        });
    });

    grid.querySelectorAll('.btn-delete-item').forEach(btn => {
        btn.addEventListener('click', () => {
            pendingDeleteItemId = btn.dataset.id;
            document.getElementById('delete-item-modal')?.classList.add('active');
            document.documentElement.classList.add('modal-open');
        });
    });

    grid.querySelectorAll('.btn-add-calendar').forEach(btn => {
        btn.addEventListener('click', async () => {
            const item = lastMineItems.find(it => String(it.id) === btn.dataset.id);
            if (!item) {
                logError('items:calendar', new Error('Item not found'));
                showToast(t.msg_calendar_error || 'Не удалось создать событие календаря', 'error');
                return;
            }
            const { downloadICS } = await import('./calendar-export.js');
            downloadICS(item);
        });
    });

    grid.querySelectorAll('.btn-open-linked-receipt').forEach(btn => {
        btn.addEventListener('click', () => {
            openLinkedPersonalReceipt(btn.dataset.itemId, btn);
        });
    });

    if (typeof window.applyDashboardLang === 'function') {
        window.applyDashboardLang(lang);
    }
}

const VERIFIED_EXPAND_UNIT_LIMIT = 20;

function extractActiveVerifiedItems(receipts) {
    const activeItems = [];
    (receipts || []).forEach(r => {
        const lc = r.lifecycle_status || 'active';
        if (lc === 'voided' || lc === 'refunded') return;
        (r.receipt_items || []).forEach(it => {
            const origQty = Math.max(1, parseInt(it.qty, 10) || 1);
            const refQty = Math.max(0, parseInt(it.refunded_qty, 10) || 0);
            const activeQty = origQty - refQty;
            if (activeQty <= 0) return;

            const origGross = parseFloat(it.gross_total) || 0;

            if (activeQty <= VERIFIED_EXPAND_UNIT_LIMIT) {
                const unitGross = Math.max(0, Math.round((origGross / origQty) * 100) / 100);
                for (let u = 0; u < activeQty; u++) {
                    activeItems.push({
                        ...it,
                        id: activeQty === 1 ? String(it.id) : `${it.id}__unit_${u + 1}`,
                        receipt_id: r.id,
                        qty: 1,
                        gross_total: unitGross,
                        shop_name: r.shop_name,
                        purchase_date: r.purchase_date,
                    });
                }
            } else {
                const activeGross = refQty > 0
                    ? Math.max(0, Math.round(origGross * (activeQty / origQty) * 100) / 100)
                    : origGross;

                activeItems.push({
                    ...it,
                    receipt_id: r.id,
                    qty: activeQty,
                    gross_total: activeGross,
                    shop_name: r.shop_name,
                    purchase_date: r.purchase_date,
                });
            }
        });
    });
    return activeItems;
}

function renderVerifiedItems(receipts, t, opts = {}) {
    const grid = document.querySelector('#items-grid-verified');
    if (!grid) return;

    const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
    const allItems = extractActiveVerifiedItems(receipts);

    const countEl = document.getElementById('items-count-verified');
    if (countEl && opts.animateCount !== false) window.animateCount(countEl, allItems.length);

    if (allItems.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" data-animate="zoom">
                <div class="empty-icon"><i class="fa-solid fa-shield-halved"></i></div>
                <h3 data-i18n="verified_empty_title">${escapeHtml(t.verified_empty_title || 'Пока нет подтвержденных товаров')}</h3>
                <p data-i18n="verified_empty_text">${escapeHtml(t.verified_empty_text || 'Товары из чеков от партнёров появятся здесь автоматически.')}</p>
            </div>`;
        return;
    }

    const filteredVerified = currentItemsSearch
        ? allItems.filter(it => matchesItemSearch(it, true))
        : allItems;

    if (filteredVerified.length === 0) {
        renderItemsSearchEmpty(grid, t);
        return;
    }

    const sortedItems = sortDashboardItems(filteredVerified, currentItemsSort, true);
    lastVerifiedItems = sortedItems;

    grid.innerHTML = sortedItems.map(item => {
        const iconClass = (item.category && Object.prototype.hasOwnProperty.call(window.DEVICE_ICONS, item.category))
            ? window.DEVICE_ICONS[item.category]
            : window.DEVICE_ICONS.other;
        const d = item.purchase_date ? item.purchase_date.slice(0, 10).split('-') : null;
        const dateStr = d ? (lang === 'ru' ? `${d[2]}.${d[1]}.${d[0]}` : `${d[1]}/${d[2]}/${d[0]}`) : '';
        const qty = parseInt(item.qty, 10) || 1;
        const noWarranty = isNoWarranty(item);
        const daysLeft = noWarranty ? null : calculateDaysLeft(item.warranty_end_date);
        const status = noWarranty ? null : getStatusInfo(daysLeft);
        const totalDays = getTotalWarrantyDays(item);
        const progress = noWarranty ? 0
            : totalDays > 0 ? Math.max(0, Math.min(100, (daysLeft / totalDays) * 100)) : 0;
        const statusClass = noWarranty ? 'none' : status.class;

        const stats = [];
        if (qty > 1) {
            stats.push({ icon: 'fa-layer-group', labelKey: 'stat_qty', fallback: 'Qty', value: '×' + escapeHtml(String(qty)) });
        }
        stats.push({ icon: 'fa-tag', labelKey: 'stat_price', fallback: 'Price', value: escapeHtml(window.formatCurrency(parseFloat(item.gross_total) || 0, item.currency || 'EUR', lang)) });
        if (!noWarranty) {
            stats.push({ icon: 'fa-shield-halved', labelKey: 'stat_warranty', fallback: 'Warranty', value: `${escapeHtml(String(item.warranty_months || 0))} ${escapeHtml(t.months_short || 'mo')}.` });
        }
        if (dateStr) {
            stats.push({ icon: 'fa-regular fa-calendar', labelKey: 'stat_date', fallback: 'Date', value: escapeHtml(dateStr) });
        }
        const statsHtml = stats.map(s => `
                        <div class="mine-stat">
                            <span class="mine-stat-icon"><i class="fa-solid ${s.icon}"></i></span>
                            <div class="mine-stat-text">
                                <div class="mine-stat-label" data-i18n="${s.labelKey}">${escapeHtml(t[s.labelKey] || s.fallback)}</div>
                                <div class="mine-stat-value" title="${s.value}">${s.value}</div>
                            </div>
                        </div>`).join('');

        const btnCalendarText = escapeHtml(t.add_to_calendar || 'В календарь');
        const btnReceiptPdfText = escapeHtml(t.btn_receipt_pdf || (lang === 'ru' ? 'Чек PDF' : 'PDF Receipt'));
        const calendarButtonHtml = item.warranty_end_date && daysLeft >= 0 ? `
                        <button type="button" class="btn-action btn-add-calendar btn-calendar-wide" data-id="${escapeHtml(item.id)}"
                                title="${btnCalendarText}" aria-label="${btnCalendarText}">
                            <i class="fa-solid fa-calendar-plus" aria-hidden="true"></i>
                            <span data-i18n="add_to_calendar">${btnCalendarText}</span>
                        </button>` : '';
        const receiptButtonHtml = item.receipt_id ? `
                        <button type="button" class="btn-action btn-download-item-receipt" data-receipt-id="${escapeHtml(item.receipt_id)}"
                                title="${btnReceiptPdfText}">
                            <i class="fa-solid fa-file-arrow-down"></i>
                            <span data-i18n="btn_receipt_pdf">${btnReceiptPdfText}</span>
                        </button>` : '';

        let progressSectionHtml;
        if (noWarranty) {
            progressSectionHtml = `
                        <div class="mine-progress">
                            <div class="mine-progress-top">
                                <span class="days-left-text none" data-i18n="no_warranty">${escapeHtml(t.no_warranty || 'No warranty')}</span>
                            </div>
                            <div class="no-warranty-track"><i class="fa-solid fa-shield-slash"></i></div>
                        </div>`;
        } else {
            const progressTextKey = daysLeft > 0 ? 'days_left' : (daysLeft === 0 ? 'warranty_expires_today' : 'warranty_expired_text');
            const untilLabel = escapeHtml(t.progress_until || 'until');
            const endD = item.warranty_end_date ? item.warranty_end_date.slice(0, 10).split('-') : null;
            const endDateStr = endD ? (lang === 'ru' ? `${endD[2]}.${endD[1]}.${endD[0]}` : `${endD[1]}/${endD[2]}/${endD[0]}`) : '';
            progressSectionHtml = `
                        <div class="mine-progress">
                            <div class="mine-progress-top">
                                <span class="days-left-text ${status.class}"
                                      data-i18n="${progressTextKey}"
                                      data-i18n-count="${daysLeft > 0 ? daysLeft : ''}"></span>
                                <span class="mine-progress-until">${endDateStr ? `<span data-i18n="progress_until">${untilLabel}</span> ${escapeHtml(endDateStr)}` : ''}</span>
                            </div>
                            <div class="mine-progress-track">
                                <div class="mine-progress-fill ${status.class}" data-progress="${progress}"></div>
                            </div>
                        </div>`;
        }

        const itemName = escapeHtml(item.item_name || (t.item_name_unknown || 'Товар'));

        const verifiedLabel = escapeHtml(t.verified_badge || 'Confirmed');

        return `
            <div class="mine-item-card verified is-${statusClass}" data-item-id="${escapeHtml(item.id)}">
                <div class="mine-item-header">
                    <div class="mine-item-icon">
                        <i class="fa-solid ${iconClass}"></i>
                        <span class="verified-check" title="${verifiedLabel}" aria-label="${verifiedLabel}"><i class="fa-solid fa-check"></i></span>
                    </div>
                    <div class="mine-item-heading">
                        <h3 class="mine-item-title" title="${itemName}">${itemName}</h3>
                        <div class="mine-item-brand">${escapeHtml(item.shop_name || '—')}</div>
                    </div>
                </div>

                <div class="mine-item-body">
                    ${stats.length ? `<div class="mine-stats-grid">${statsHtml}</div>` : ''}

                    ${progressSectionHtml}

                    ${(calendarButtonHtml || receiptButtonHtml) ? `
                    <div class="mine-item-actions-wrap verified-actions-wrap">
                        ${calendarButtonHtml}
                        ${receiptButtonHtml ? `<div class="mine-item-actions verified-actions">${receiptButtonHtml}</div>` : ''}
                    </div>` : ''}
                </div>
            </div>`;
    }).join('');

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            grid.querySelectorAll('.mine-progress-fill[data-progress]').forEach(el => {
                const progress = parseFloat(el.dataset.progress);
                el.style.width = `${progress}%`;
                el.removeAttribute('data-progress');
            });
        });
    });

    grid.querySelectorAll('.btn-add-calendar').forEach(btn => {
        btn.addEventListener('click', async () => {
            const item = lastVerifiedItems.find(it => String(it.id) === btn.dataset.id);
            if (!item) {
                logError('items:calendar', new Error('Item not found'));
                showToast(t.msg_calendar_error || 'Не удалось создать событие календаря', 'error');
                return;
            }
            const { downloadICS } = await import('./calendar-export.js');
            downloadICS(item);
        });
    });

    grid.querySelectorAll('.btn-download-item-receipt').forEach(btn => {
        btn.addEventListener('click', () => {
            downloadVerifiedReceiptPDF(btn.dataset.receiptId, btn);
        });
    });

    if (typeof window.applyDashboardLang === 'function') {
        window.applyDashboardLang(lang);
    }
}

let loadVerifiedItemsSeq = 0;

async function loadVerifiedItems(userEmail, client, { silent = false } = {}) {
    const grid = document.querySelector('#items-grid-verified');
    if (!grid) return;

    const seq = ++loadVerifiedItemsSeq;

    if (!silent) {
        grid.innerHTML = '<div class="rotating-loader"></div>';
        const loaderEl = grid.querySelector('.rotating-loader');
        if (loaderEl && typeof RotatingTextLoader !== 'undefined') {
            const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
            const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
            new RotatingTextLoader(loaderEl, [
                t.loading_items || 'Загружаем покупки…',
                t.loading_items_check || 'Проверяем данные…',
                t.loading_items_update || 'Обновляем статусы…'
            ], { interval: 800 });
        }
    }

    const userPhone = await fetchCurrentUserPhone(client, currentUserId);
    if (seq !== loadVerifiedItemsSeq) return;
    const buyerOrFilter = buildBuyerReceiptOrFilter({ userId: currentUserId, email: userEmail, phone: userPhone });

    let res = buyerOrFilter
        ? await client
            .from('business_receipts')
            .select('id, lifecycle_status, purchase_date, shop_name, receipt_items(id, item_name, qty, refunded_qty, gross_total, currency, warranty_months, warranty_end_date, category)')
            .or(buyerOrFilter)
            .order('purchase_date', { ascending: false })
        : { data: [], error: null };

    if (res.error && res.error.code === '42703' && userEmail) {
        res = await client
            .from('business_receipts')
            .select('id, lifecycle_status, purchase_date, shop_name, receipt_items(id, item_name, qty, refunded_qty, gross_total, currency, warranty_months, warranty_end_date, category)')
            .eq('customer_email', userEmail)
            .order('purchase_date', { ascending: false });
    }

    if (res.error && res.error.code === '42703' && userEmail) {
        res = await client
            .from('business_receipts')
            .select('id, purchase_date, shop_name, receipt_items(id, item_name, qty, gross_total, currency, warranty_months, warranty_end_date, category)')
            .eq('customer_email', userEmail)
            .order('purchase_date', { ascending: false });
    }

    if (seq !== loadVerifiedItemsSeq) return;

    const { data, error } = res;

    if (error) {
        logError('items:loadVerified', error);
        const loadLang = (window.getValuonLang ? window.getValuonLang() : 'en');
        grid.innerHTML = `<p class="empty-state error">${loadLang === 'en' ? 'Data load error.' : 'Ошибка загрузки данных.'}</p>`;
        return;
    }

    const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
    const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
    lastVerifiedReceipts = data || [];
    renderVerifiedItems(lastVerifiedReceipts, t);

    const activeItems = extractActiveVerifiedItems(data || []);
    let verifiedActive = 0, verifiedExpiring = 0, verifiedExpired = 0;
    const verifiedTotal = activeItems.length;
    activeItems.forEach(it => {
        if (isNoWarranty({ warranty_months: it.warranty_months, purchase_date: it.purchase_date, warranty_end_date: it.warranty_end_date })) return;
        const days = calculateDaysLeft(it.warranty_end_date);
        if (days > 30) verifiedActive++;
        else if (days >= 0 && days <= 30) verifiedExpiring++;
        else verifiedExpired++;
    });

    verifiedStats = { total: verifiedTotal, active: verifiedActive, expiring: verifiedExpiring, expired: verifiedExpired };
    updateStats(lastMineItems);
}

let _tabTransitionTimer = null;

function switchGridTab(oldGrid, newGrid) {
    if (!newGrid || oldGrid === newGrid) return;
    if (_tabTransitionTimer) {
        clearTimeout(_tabTransitionTimer);
        _tabTransitionTimer = null;
    }

    const container = oldGrid?.parentElement;
    if (container) {
        container.style.minHeight = '';
        container.style.transition = '';
    }

    if (oldGrid) {
        oldGrid.classList.remove('fade-in', 'fade-out');
        oldGrid.classList.add('hidden');
    }
    newGrid.classList.remove('hidden', 'fade-out', 'fade-in');
    void newGrid.offsetWidth;
    newGrid.classList.add('fade-in');

    _tabTransitionTimer = setTimeout(() => {
        newGrid.classList.remove('fade-in');
        _tabTransitionTimer = null;
    }, 310);
}

let _itemsTabsIndicator = null;

function activateItemsTab(target, { instant = false } = {}) {
    const tab = document.querySelector(`#items-tabs .items-tab[data-items-tab="${target}"]`);
    if (!tab || tab.classList.contains('active')) return;

    const tabs = document.querySelectorAll('#items-tabs .items-tab');
    tabs.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    if (_itemsTabsIndicator) _itemsTabsIndicator.update(instant);

    try { localStorage.setItem('valuon-items-tab', target); } catch (_) {}
    const mineGrid = document.querySelector('#items-grid-mine');
    const verifiedGrid = document.querySelector('#items-grid-verified');
    if (instant) {
        if (target === 'mine') {
            verifiedGrid?.classList.add('hidden');
            mineGrid?.classList.remove('hidden');
        } else {
            mineGrid?.classList.add('hidden');
            verifiedGrid?.classList.remove('hidden');
        }
    } else {
        const oldGrid = target === 'mine' ? verifiedGrid : mineGrid;
        const newGrid = target === 'mine' ? mineGrid : verifiedGrid;
        switchGridTab(oldGrid, newGrid);
    }
}

function setupItemsTabs(userId, userEmail, client) {
    const tabsWrap = document.getElementById('items-tabs');
    const tabs = document.querySelectorAll('#items-tabs .items-tab');
    const indicatorEl = document.getElementById('items-tab-indicator');
    _itemsTabsIndicator = createSegmentedIndicator(tabsWrap, indicatorEl, {
        itemSelector: '.items-tab',
    });

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            activateItemsTab(tab.dataset.itemsTab);
        });
    });

    window.addEventListener('lang-changed', () => _itemsTabsIndicator?.update(true));
}

function updateStats(items) {
    const totalEl = document.getElementById('stat-total');
    const activeEl = document.getElementById('stat-active');
    const expiringEl = document.getElementById('stat-expiring');
    const expiredEl = document.getElementById('stat-expired');

    if (!totalEl || !activeEl || !expiringEl) return;

    let activeCount = 0;
    let expiringCount = 0;
    let expiredCount = 0;

    items.forEach(item => {
        if (isNoWarranty(item)) return;
        const days = calculateDaysLeft(item.warranty_end_date);
        if (days > 30) activeCount++;
        else if (days >= 0 && days <= 30) expiringCount++;
        else if (days < 0) expiredCount++;
    });

    window.animateCount(totalEl, items.length + verifiedStats.total);
    window.animateCount(activeEl, activeCount + verifiedStats.active);
    window.animateCount(expiringEl, expiringCount + verifiedStats.expiring);
    if (expiredEl) window.animateCount(expiredEl, expiredCount + verifiedStats.expired);
    updateExportAllCalendarBar();
}

function getActiveWarrantyItems() {
    const result = [];
    const verified = extractActiveVerifiedItems(lastVerifiedReceipts || []);
    for (const it of verified) {
        if (isNoWarranty({ warranty_months: it.warranty_months, purchase_date: it.purchase_date, warranty_end_date: it.warranty_end_date })) continue;
        const days = calculateDaysLeft(it.warranty_end_date);
        if (Number.isFinite(days) && days >= 0) result.push(it);
    }
    for (const it of (lastMineItems || [])) {
        if (isNoWarranty(it)) continue;
        const days = calculateDaysLeft(it.warranty_end_date);
        if (Number.isFinite(days) && days >= 0) result.push(it);
    }
    return result;
}

function formatCalendarAllSub(n) {
    const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
    const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.en || {};
    if (lang === 'en') {
        const tpl = n === 1
            ? (t.calendar_all_sub_one || '{n} active warranty · reminder 7 days before expiry (.ics)')
            : (t.calendar_all_sub_many || '{n} active warranties · reminders 7 days before expiry (.ics)');
        return tpl.replace('{n}', String(n));
    }
    const mod10 = n % 10;
    const mod100 = n % 100;
    let tpl;
    if (mod10 === 1 && mod100 !== 11) tpl = t.calendar_all_sub_one || '{n} активная гарантия · напоминание за 7 дней (.ics)';
    else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) tpl = t.calendar_all_sub_few || '{n} активные гарантии · напоминания за 7 дней (.ics)';
    else tpl = t.calendar_all_sub_many || '{n} активных гарантий · напоминания за 7 дней (.ics)';
    return tpl.replace('{n}', String(n));
}

function updateExportAllCalendarBar() {
    const btn = document.getElementById('export-all-calendar-btn');
    const sub = document.getElementById('export-all-calendar-sub');
    if (!btn) return;
    const active = getActiveWarrantyItems();
    if (active.length === 0) {
        btn.classList.add('hidden');
        return;
    }
    if (sub) sub.textContent = formatCalendarAllSub(active.length);
    btn.classList.remove('hidden');
}

(function bindExportAllCalendarBtn() {
    const btn = document.getElementById('export-all-calendar-btn');
    const iconWrap = document.getElementById('export-all-calendar-icon');
    let resetTimer = null;
    btn?.addEventListener('click', async () => {
        const active = getActiveWarrantyItems();
        const { downloadAllICS } = await import('./calendar-export.js');
        const exported = downloadAllICS(active);
        if (exported > 0 && iconWrap) {
            if (resetTimer) clearTimeout(resetTimer);
            btn.classList.add('is-exported');
            iconWrap.innerHTML = '<i class="fa-solid fa-check"></i>';
            resetTimer = setTimeout(() => {
                btn.classList.remove('is-exported');
                iconWrap.innerHTML = '<i class="fa-solid fa-download"></i>';
                resetTimer = null;
            }, 1500);
        }
    });
    window.addEventListener('lang-changed', updateExportAllCalendarBar);
})();

async function openEditModal(itemId, client, userId) {
    const modal = document.getElementById('edit-modal');
    const form = document.getElementById('edit-item-form');
    if (!modal || !form) return;

    const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
    const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};

    // Данные вещи уже есть в памяти после последней загрузки списка (loadItems),
    // так что открываем модалку сразу без похода в сеть. Сетевой запрос —
    // только запасной вариант, если по какой-то причине кэш пуст/устарел.
    let item = lastMineItems.find(it => String(it.id) === String(itemId));

    if (!item) {
        const { data, error } = await client
            .from('items')
            .select('*')
            .eq('id', itemId)
            .eq('user_id', userId)
            .single();

        if (error || !data) {
            showToast(t.msg_item_update_failed || 'Failed to load item', 'error');
            return;
        }
        item = data;
    }

    form.querySelector('[name="item_id"]').value = item.id;
    form.querySelector('[name="name"]').value = item.name || '';
    form.querySelector('[name="type"]').value = item.type || 'other';
    form.querySelector('[name="brand"]').value = item.brand || '';
    form.querySelector('[name="price"]').value = item.price ?? '';
    form.querySelector('[name="store_name"]').value = item.store_name || '';
    form.querySelector('[name="serial_number"]').value = item.serial_number || '';
    const dateInput = form.querySelector('[name="purchase_date"]');
    dateInput.value = item.purchase_date || '';
    if (dateInput._cdp) dateInput._cdp.syncDisplay();
    form.querySelector('[name="warranty_months"]').value = item.warranty_months ?? 12;
    syncWarrantyChips(modal.querySelector('.warranty-presets'), item.warranty_months ?? 12);
    form.querySelector('[name="location"]').value = item.location || '';

    const currencySelect = form.querySelector('[name="currency"]');
    if (currencySelect) {
        currencySelect.value = item.currency || 'EUR';
        if (typeof CustomSelect !== 'undefined') CustomSelect.refreshAll();
    }
    const priceSuffix = form.querySelector('.input-suffix .suffix-hint');
    if (priceSuffix && typeof window.currencySymbol === 'function') {
        priceSuffix.textContent = window.currencySymbol(item.currency || 'EUR');
    }

    if (typeof window.applyDashboardLang === 'function') {
        window.applyDashboardLang(lang);
    }

    if (modal._closeTimer) {
        clearTimeout(modal._closeTimer);
        modal._closeTimer = null;
        modal.classList.remove('closing');
    }
    modal.classList.add('active');
    document.documentElement.classList.add('modal-open');
}

function syncModalOpenClass() {
    if (!document.querySelector('.modal-overlay.active:not(.closing), .modal.active:not(.closing)')) {
        document.documentElement.classList.remove('modal-open');
    }
}

function syncWarrantyChips(presetsEl, val) {
    if (!presetsEl) return;
    const cleanVal = String(val ?? '').trim();
    presetsEl.querySelectorAll('.warranty-chip').forEach(chip => {
        chip.classList.toggle('is-selected', chip.dataset.months === cleanVal);
    });
}

function setupEditModal(client, userId) {
    const modal = document.getElementById('edit-modal');
    const form = document.getElementById('edit-item-form');
    const closeBtn = document.getElementById('close-edit-modal');
    const cancelBtn = document.getElementById('cancel-edit-modal');

    if (!modal || !form) return;

    let isSubmitting = false;
    let successCloseTimer = null;
    let pendingReload = false;
    const submitBtn = form.querySelector('button[type="submit"]');
    let submitBtnOriginalHTML = submitBtn?.innerHTML || '';

    function resetSubmitState() {
        if (successCloseTimer) {
            clearTimeout(successCloseTimer);
            successCloseTimer = null;
        }
        if (submitBtn && submitBtnOriginalHTML) {
            submitBtn.innerHTML = submitBtnOriginalHTML;
            submitBtn.disabled = false;
        }
        isSubmitting = false;
    }

    function flushPendingReload() {
        if (!pendingReload) return;
        pendingReload = false;
        loadItems(userId, client);
        refreshNotifBadge();
    }

    function closeModal() {
        if (successCloseTimer) {
            clearTimeout(successCloseTimer);
            successCloseTimer = null;
        }
        if (modal.classList.contains('closing')) return;
        modal.classList.add('closing');
        modal._closeTimer = setTimeout(() => {
            modal._closeTimer = null;
            modal.classList.remove('active', 'closing');
            form.reset();
            syncModalOpenClass();
            resetSubmitState();
            flushPendingReload();
        }, 250);
    }

    attachModalA11y(modal, { mode: 'active', onClose: closeModal });

    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    const currencySelect = form.querySelector('[name="currency"]');
    currencySelect?.addEventListener('change', () => {
        const priceSuffix = form.querySelector('.input-suffix .suffix-hint');
        if (priceSuffix && typeof window.currencySymbol === 'function') {
            priceSuffix.textContent = window.currencySymbol(currencySelect.value);
        }
    });

    const editWarrantyPresets = modal.querySelector('.warranty-presets');
    const editWarrantyInput = form.querySelector('[name="warranty_months"]');
    if (editWarrantyPresets && editWarrantyInput) {
        editWarrantyPresets.addEventListener('click', (e) => {
            const chip = e.target.closest('.warranty-chip');
            if (!chip) return;
            e.preventDefault();
            editWarrantyInput.value = chip.dataset.months || '0';
            syncWarrantyChips(editWarrantyPresets, chip.dataset.months);
            editWarrantyInput.dispatchEvent(new Event('input', { bubbles: true }));
            editWarrantyInput.dispatchEvent(new Event('change', { bubbles: true }));
        });
        editWarrantyInput.addEventListener('input', () => {
            syncWarrantyChips(editWarrantyPresets, editWarrantyInput.value);
        });
    }

    const editDateInput = form.querySelector('[name="purchase_date"]');
    if (editDateInput) editDateInput.max = getTodayLocalIso();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
        const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
        const editDateVal = form.querySelector('[name="purchase_date"]')?.value || '';
        if (editDateVal && editDateVal > getTodayLocalIso()) {
            showToast(lang === 'ru' ? 'Дата покупки не может быть в будущем' : 'Purchase date cannot be in the future', 'warning');
            return;
        }

        isSubmitting = true;

        const btn = submitBtn || form.querySelector('button[type="submit"]');
        submitBtnOriginalHTML = btn.innerHTML;

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            const itemId = form.querySelector('[name="item_id"]').value;

            const { error } = await client.from('items').update({
                name: form.querySelector('[name="name"]').value.trim(),
                type: form.querySelector('[name="type"]').value,
                brand: form.querySelector('[name="brand"]').value.trim(),
                price: Math.max(0, parseFloat(form.querySelector('[name="price"]').value) || 0),
                store_name: form.querySelector('[name="store_name"]').value.trim(),
                serial_number: form.querySelector('[name="serial_number"]').value.trim(),
                purchase_date: form.querySelector('[name="purchase_date"]').value,
                warranty_months: parseWarrantyMonthsInput(form.querySelector('[name="warranty_months"]').value),
                location: form.querySelector('[name="location"]').value.trim(),
                currency: form.querySelector('[name="currency"]')?.value || 'EUR',
                updated_at: new Date().toISOString()
            }).eq('id', itemId)
                .eq('user_id', userId);

            if (error) throw error;

            btn.innerHTML = '<i class="fa-solid fa-check"></i>';
            showToast(t.msg_item_updated || 'Item updated', 'success');
            pendingReload = true;

            successCloseTimer = setTimeout(() => {
                successCloseTimer = null;
                closeModal();
            }, 350);

        } catch (err) {
            logError('items:update', err);
            showToast(t.msg_item_update_failed || 'Update failed', 'error');
            resetSubmitState();
        }
    });
}

function setupDeleteItemModal(client, userId) {
    const modal = document.getElementById('delete-item-modal');
    const confirmBtn = document.getElementById('confirm-delete-item');
    const cancelBtn = document.getElementById('cancel-delete-item');

    function closeDeleteModal() {
        if (modal?.classList.contains('closing')) return;
        modal?.classList.add('closing');
        setTimeout(() => {
            modal?.classList.remove('active', 'closing');
            syncModalOpenClass();
            pendingDeleteItemId = null;
        }, 250);
    }

    attachModalA11y(modal, { mode: 'active', onClose: closeDeleteModal });

    cancelBtn?.addEventListener('click', closeDeleteModal);
    modal?.addEventListener('click', (e) => { if (e.target === modal) closeDeleteModal(); });

    confirmBtn?.addEventListener('click', async () => {
        if (!pendingDeleteItemId) return;

        const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
        const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
        const originalHTML = confirmBtn.innerHTML;
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            const { error } = await client.from('items').delete()
                .eq('id', pendingDeleteItemId)
                .eq('user_id', userId);
            if (error) throw error;

            haptic(10);
            const deletedId = pendingDeleteItemId;
            showToast(t.msg_item_deleted || 'Item deleted', 'success');
            closeDeleteModal();
            const deletedCard = document.querySelector(`#items-grid-mine [data-id="${CSS.escape(String(deletedId))}"]`)?.closest('.item-card');
            if (deletedCard) {
                await new Promise((resolve) => collapseAndRemove(deletedCard, resolve));
            }
            await loadItems(userId, client);
            refreshNotifBadge();

        } catch (err) {
            logError('items:delete', err);
            showToast(t.msg_item_delete_failed || 'Delete failed', 'error');
        } finally {
            confirmBtn.innerHTML = originalHTML;
            confirmBtn.disabled = false;
        }
    });
}

function setupModal(client, userId) {
    const addBtn = document.getElementById('add-item-btn');
    const modal = document.getElementById('add-modal');
    const closeBtn = document.getElementById('close-modal');
    const cancelBtn = document.getElementById('cancel-modal');
    const form = document.querySelector('.modal-form');

    if (!addBtn || !modal) return;

    let isSubmitting = false;
    let successCloseTimer = null;
    let pendingReloadUserId = null;
    const submitBtn = form?.querySelector('button[type="submit"]');
    let submitBtnOriginalHTML = submitBtn?.innerHTML || '';

    function resetSubmitState() {
        if (successCloseTimer) {
            clearTimeout(successCloseTimer);
            successCloseTimer = null;
        }
        if (submitBtn && submitBtnOriginalHTML) {
            submitBtn.innerHTML = submitBtnOriginalHTML;
            submitBtn.disabled = false;
        }
        isSubmitting = false;
    }

    function flushPendingReload() {
        if (!pendingReloadUserId) return;
        const uid = pendingReloadUserId;
        pendingReloadUserId = null;
        loadItems(uid, client);
        refreshNotifBadge();
    }

    function closeAddModal() {
        if (successCloseTimer) {
            clearTimeout(successCloseTimer);
            successCloseTimer = null;
        }
        if (modal.classList.contains('closing')) return;
        modal.classList.add('closing');
        modal._closeTimer = setTimeout(() => {
            modal._closeTimer = null;
            modal.classList.remove('active', 'closing');
            form?.reset();
            syncModalOpenClass();
            resetSubmitState();
            flushPendingReload();
        }, 250);
    }

    attachModalA11y(modal, { mode: 'active', onClose: closeAddModal });

    const currencySelect = form?.querySelector('[name="currency"]');
    const priceSuffix = form?.querySelector('.input-suffix .suffix-hint');

    function updatePriceSuffix() {
        if (priceSuffix && typeof window.currencySymbol === 'function') {
            priceSuffix.textContent = window.currencySymbol(currencySelect?.value || userDefaultCurrency);
        }
    }

    currencySelect?.addEventListener('change', updatePriceSuffix);

    const addWarrantyPresets = modal.querySelector('.warranty-presets');
    const addWarrantyInput = form?.querySelector('[name="warranty_months"]');
    if (addWarrantyPresets && addWarrantyInput) {
        addWarrantyPresets.addEventListener('click', (e) => {
            const chip = e.target.closest('.warranty-chip');
            if (!chip) return;
            e.preventDefault();
            addWarrantyInput.value = chip.dataset.months || '0';
            syncWarrantyChips(addWarrantyPresets, chip.dataset.months);
            addWarrantyInput.dispatchEvent(new Event('input', { bubbles: true }));
            addWarrantyInput.dispatchEvent(new Event('change', { bubbles: true }));
        });
        addWarrantyInput.addEventListener('input', () => {
            syncWarrantyChips(addWarrantyPresets, addWarrantyInput.value);
        });
    }

    addBtn.addEventListener('click', () => {
        if (modal._closeTimer) {
            clearTimeout(modal._closeTimer);
            modal._closeTimer = null;
            modal.classList.remove('closing');
        }
        resetSubmitState();
        modal.classList.add('active');
        document.documentElement.classList.add('modal-open');
        syncWarrantyChips(addWarrantyPresets, addWarrantyInput?.value || '0');
        const dateInput = form?.querySelector('[name="purchase_date"]');
        if (dateInput) {
            const todayIso = getTodayLocalIso();
            dateInput.max = todayIso;
            dateInput.value = todayIso;
            if (dateInput._cdp) dateInput._cdp.syncDisplay();
        }
        if (currencySelect) {
            currencySelect.value = userDefaultCurrency;
        }
        const typeSelect = form?.querySelector('[name="type"]');
        if (typeSelect) {
            typeSelect.value = 'other';
        }
        if (typeof CustomSelect !== 'undefined') CustomSelect.refreshAll();
        updatePriceSuffix();
    });
    closeBtn?.addEventListener('click', closeAddModal);
    cancelBtn?.addEventListener('click', closeAddModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeAddModal();
    });

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (isSubmitting) return;
        isSubmitting = true;

        const btn = submitBtn || form.querySelector('button[type="submit"]');
        submitBtnOriginalHTML = btn.innerHTML;
        const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
        const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};

        try {
            if (!userId) {
                showToast(t.msg_session_expired || 'Session expired. Please log in again.', 'error');
                resetSubmitState();
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            const nameInput = form.querySelector('input[name="name"]');
            const typeSelect = form.querySelector('select[name="type"]');
            const brandInput = form.querySelector('input[name="brand"]');
            const serialInput = form.querySelector('input[name="serial_number"]');
            const dateInput = form.querySelector('input[name="purchase_date"]');
            if (dateInput?.value && dateInput.value > getTodayLocalIso()) {
                showToast(lang === 'ru' ? 'Дата покупки не может быть в будущем' : 'Purchase date cannot be in the future', 'warning');
                resetSubmitState();
                return;
            }
            const monthsInput = form.querySelector('input[name="warranty_months"]');
            const locationInput = form.querySelector('input[name="location"]');
            const priceInput = form.querySelector('input[name="price"]');
            const storeInput = form.querySelector('input[name="store_name"]');

            const { error } = await client.from('items').insert([{
                user_id: userId,
                name: nameInput.value.trim(),
                type: typeSelect ? typeSelect.value : 'other',
                brand: brandInput ? brandInput.value.trim() : '',
                serial_number: serialInput ? serialInput.value.trim() : '',
                purchase_date: dateInput.value,
                warranty_months: parseWarrantyMonthsInput(monthsInput.value),
                location: locationInput ? locationInput.value.trim() : '',
                price: Math.max(0, parseFloat(priceInput?.value) || 0),
                store_name: storeInput ? storeInput.value.trim() : '',
                currency: currencySelect?.value || userDefaultCurrency
            }]);

            if (error) throw error;

            btn.innerHTML = '<i class="fa-solid fa-check"></i>';

            showToast(t.msg_item_added || 'Товар добавлен', 'success');
            pendingReloadUserId = userId;
            activateItemsTab('mine');

            successCloseTimer = setTimeout(() => {
                successCloseTimer = null;
                closeAddModal();
            }, 350);

        } catch (err) {
            logError('items:warrantyUpdate', err);

            if (err.code === '23505') {
                showToast(t.msg_item_exists || (lang === 'ru' ? 'Эта вещь уже добавлена!' : 'This item already exists!'), 'warning');
            } else {
                showToast(t.msg_item_save_failed || (lang === 'ru' ? 'Ошибка сохранения. Попробуйте снова.' : 'Save failed. Try again.'), 'error');
            }

            resetSubmitState();
        }
    });
}

initDashboardItems().catch(e => {
    logError('init:dashboardItems', e);
    const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
    const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
    const msg = t.load_error || (lang === 'ru' ? 'Ошибка загрузки. Обновите страницу.' : 'Load error. Please refresh.');
    const el = document.querySelector('#items-grid-verified:not(.hidden), #items-grid-mine:not(.hidden)')
        || document.querySelector('#items-grid-verified')
        || document.querySelector('#items-grid-mine');
    if (el) el.innerHTML = `<p class="empty-state error">${msg}</p>`;
});