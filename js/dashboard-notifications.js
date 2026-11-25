import { requireAuth } from './dashboard-auth.js';
import { escapeHtml, logError } from './security.js';
import {
    calculateDaysLeft,
    isNoWarranty,
    extractActivePartnerWarrantyItems,
    parseLocalDate
} from './warranty-utils.js';
import { buildBuyerReceiptOrFilter, fetchCurrentUserPhone } from './phone-utils.js';

function getNotifLang() {
    return localStorage.getItem('valuon-lang') || 'ru';
}

function getNotifT() {
    const lang = getNotifLang();
    return window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const lang = getNotifLang();
    const locale = lang === 'ru' ? 'ru-RU' : 'en-US';
    const date = parseLocalDate(dateStr);
    if (!date) return '';
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'numeric', year: 'numeric' });
}

function updateNotifBadge(count) {
    document.querySelectorAll('[data-notif-badge]').forEach(el => {
        if (count > 0) {
            el.textContent = count > 99 ? '99+' : String(count);
            el.classList.remove('hidden');
        } else {
            el.textContent = '';
            el.classList.add('hidden');
        }
    });
}

async function fetchBuyerPartnerReceipts(userId, userEmail, client) {
    if (!userId && !userEmail) return [];
    const userPhone = await fetchCurrentUserPhone(client, userId);
    const buyerOrFilter = buildBuyerReceiptOrFilter({ userId, email: userEmail, phone: userPhone });

    const fullSelect = 'id, receipt_number, shop_name, purchase_date, lifecycle_status, status_changed_at, status_reason, refunded_amount, gross_total, currency, receipt_items(id, item_name, qty, refunded_qty, warranty_months, warranty_end_date)';
    const legacySelect = 'id, receipt_number, shop_name, purchase_date, gross_total, currency, receipt_items(id, item_name, qty, warranty_months, warranty_end_date)';

    let res = buyerOrFilter
        ? await client
            .from('business_receipts')
            .select(fullSelect)
            .or(buyerOrFilter)
            .order('purchase_date', { ascending: false })
        : { data: [], error: null };

    if (res.error && res.error.code === '42703' && userEmail) {
        res = await client
            .from('business_receipts')
            .select(fullSelect)
            .eq('customer_email', userEmail)
            .order('purchase_date', { ascending: false });
    }

    if (res.error && res.error.code === '42703' && userEmail) {
        res = await client
            .from('business_receipts')
            .select(legacySelect)
            .eq('customer_email', userEmail)
            .order('purchase_date', { ascending: false });
    }

    const { data, error } = res;
    if (error) {
        if (error.code !== '42703') logError('notif:partnerReceipts', error);
        return [];
    }
    return data || [];
}

function filterRecentLifecycleReceipts(receipts) {
    const cutoffMs = Date.now() - 30 * 86400000;
    const validStatuses = new Set(['voided', 'refunded', 'partially_refunded']);
    return (receipts || [])
        .filter(r => {
            if (!validStatuses.has(r.lifecycle_status)) return false;
            if (!r.status_changed_at) return false;
            const ts = new Date(r.status_changed_at).getTime();
            return Number.isFinite(ts) && ts >= cutoffMs;
        })
        .sort((a, b) => new Date(b.status_changed_at).getTime() - new Date(a.status_changed_at).getTime());
}

function buildLifecycleNotifications(receipts, t) {
    const lang = getNotifLang();
    return (receipts || []).map(r => {
        const lc = r.lifecycle_status || 'voided';
        const receiptNum = escapeHtml(r.receipt_number ? `#RCP-${r.receipt_number}` : `#${String(r.id).slice(0, 8).toUpperCase()}`);
        const shopName = escapeHtml(r.shop_name || '—');
        const reasonPart = r.status_reason
            ? ` ${escapeHtml(t.lifecycle_reason_prefix || 'Причина:')} ${escapeHtml(r.status_reason)}`
            : '';
        const currency = r.currency || 'EUR';
        const rawAmount = lc === 'partially_refunded'
            ? (parseFloat(r.refunded_amount) || 0)
            : (parseFloat(r.gross_total) || 0);
        const amountStr = typeof window.formatCurrency === 'function'
            ? escapeHtml(window.formatCurrency(rawAmount, currency, lang))
            : escapeHtml(`${rawAmount.toFixed(2)} ${currency}`);

        if (lc === 'voided') {
            return {
                type: 'lifecycle-voided',
                icon: 'fa-ban',
                title: (t.notif_receipt_voided_title || 'Чек {num} аннулирован').replace('{num}', () => receiptNum),
                text: (t.notif_receipt_voided_text || 'Магазин «{shop}» аннулировал чек.{reason}')
                    .replace('{shop}', () => shopName)
                    .replace('{reason}', () => reasonPart),
                date: r.status_changed_at ? formatDate(r.status_changed_at) : ''
            };
        }

        if (lc === 'partially_refunded') {
            return {
                type: 'lifecycle-partial',
                icon: 'fa-rotate-left',
                title: (t.notif_receipt_partial_title || 'Частичный возврат по чеку {num}').replace('{num}', () => receiptNum),
                text: (t.notif_receipt_partial_text || 'Магазин «{shop}» вернул часть позиций ({amount}).{reason}')
                    .replace('{shop}', () => shopName)
                    .replace('{amount}', () => amountStr)
                    .replace('{reason}', () => reasonPart),
                date: r.status_changed_at ? formatDate(r.status_changed_at) : ''
            };
        }

        return {
            type: 'lifecycle-refunded',
            icon: 'fa-rotate-left',
            title: (t.notif_receipt_refunded_title || 'Возврат по чеку {num}').replace('{num}', () => receiptNum),
            text: (t.notif_receipt_refunded_text || 'Магазин «{shop}» оформил полный возврат ({amount}).{reason}')
                .replace('{shop}', () => shopName)
                .replace('{amount}', () => amountStr)
                .replace('{reason}', () => reasonPart),
            date: r.status_changed_at ? formatDate(r.status_changed_at) : ''
        };
    });
}

function buildWarrantyNotifications(personalItems, partnerItems, t) {
    const expiring = [];
    const expired = [];

    const processItem = (item, isPartner) => {
        if (isNoWarranty(item)) return;
        const daysLeft = calculateDaysLeft(item.warranty_end_date);
        if (daysLeft > 30) return;

        const baseName = item.name || t.item_name_unknown || 'Товар';
        const displayName = isPartner && item.active_qty > 1
            ? `${baseName} ×${item.active_qty}`
            : baseName;
        const shopMeta = isPartner && item.shop_name ? escapeHtml(item.shop_name) : '';

        if (daysLeft >= 0) {
            const datePart = item.warranty_end_date ? formatDate(item.warranty_end_date) : '';
            const isToday = daysLeft === 0;
            expiring.push({
                daysLeft,
                type: 'warning',
                icon: 'fa-triangle-exclamation',
                title: (isToday
                    ? (t.notif_expires_today_title || 'Warranty for "{name}" expires today')
                    : (t.notif_expiring_title || 'Warranty for "{name}" is expiring')
                ).replace('{name}', () => escapeHtml(displayName)),
                text: isToday
                    ? (t.notif_expires_today_text || 'Last day of warranty. Check device condition.')
                    : (t.notif_expiring_text || '{count} days left. Check device condition.').replace('{count}', String(daysLeft)),
                date: shopMeta && datePart ? `${shopMeta} · ${datePart}` : (shopMeta || datePart)
            });
        } else {
            const absDays = Math.abs(daysLeft);
            const datePart = item.warranty_end_date ? formatDate(item.warranty_end_date) : formatDate(item.purchase_date);
            expired.push({
                daysLeft,
                type: 'expired',
                icon: 'fa-circle-xmark',
                title: (t.notif_expired_title || 'Warranty for "{name}" has expired').replace('{name}', () => escapeHtml(displayName)),
                text: (t.notif_expired_text || 'Expired {count} days ago.').replace('{count}', String(absDays)),
                date: shopMeta && datePart ? `${shopMeta} · ${datePart}` : (shopMeta || datePart)
            });
        }
    };

    (personalItems || []).forEach(item => processItem(item, false));
    (partnerItems || []).forEach(item => processItem(item, true));

    expiring.sort((a, b) => a.daysLeft - b.daysLeft);
    expired.sort((a, b) => b.daysLeft - a.daysLeft);

    return [...expiring, ...expired];
}

async function computeActiveAlertsCount(userId, userEmail, client) {
    const [profileRes, partnerReceipts] = await Promise.all([
        client.from('profiles').select('expiry_alerts').eq('id', userId).single(),
        fetchBuyerPartnerReceipts(userId, userEmail, client)
    ]);

    const lifecycleReceipts = filterRecentLifecycleReceipts(partnerReceipts);
    let count = lifecycleReceipts.length;
    const expiryAlertsEnabled = profileRes.data?.expiry_alerts ?? true;
    if (!expiryAlertsEnabled) return count;

    const { data: items, error } = await client
        .from('items')
        .select('purchase_date, warranty_months, warranty_end_date')
        .eq('user_id', userId);

    if (!error && Array.isArray(items)) {
        items.forEach(item => {
            if (isNoWarranty(item)) return;
            const daysLeft = calculateDaysLeft(item.warranty_end_date);
            if (daysLeft <= 30) count++;
        });
    }

    const partnerWarrantyItems = extractActivePartnerWarrantyItems(partnerReceipts);
    partnerWarrantyItems.forEach(item => {
        const daysLeft = calculateDaysLeft(item.warranty_end_date);
        if (daysLeft <= 30) count++;
    });

    return count;
}

export async function refreshNotifBadge() {
    try {
        const auth = await requireAuth();
        if (!auth) return;
        cachedUserId = auth.user.id;
        cachedUserEmail = auth.user.email;
        cachedClient = auth.client;
        if (notifInitialized) {
            await loadNotifications(auth.user.id, auth.user.email, auth.client);
            currentNotifLang = getNotifLang();
        } else {
            const count = await computeActiveAlertsCount(auth.user.id, auth.user.email, auth.client);
            updateNotifBadge(count);
        }
    } catch (e) {
        logError('notif:badgeRefresh', e);
    }
}

async function loadNotifications(userId, userEmail, client) {
    const container = document.getElementById('notifications-container');
    if (!container) return;

    const checkingText = window.dashboardTranslations?.[localStorage.getItem('valuon-lang') || 'ru']?.notif_checking || 'Проверка статусов...';
    container.innerHTML = `<div class="loading-state"><i class="fa-solid fa-circle-notch fa-spin"></i> ${checkingText}</div>`;

    const [profileRes, itemsRes, partnerReceipts] = await Promise.all([
        client.from('profiles').select('expiry_alerts').eq('id', userId).single(),
        client.from('items').select('name, purchase_date, warranty_months, warranty_end_date').eq('user_id', userId).order('purchase_date', { ascending: false }),
        fetchBuyerPartnerReceipts(userId, userEmail, client)
    ]);

    const t = getNotifT();
    const expiryAlertsEnabled = profileRes.data?.expiry_alerts ?? true;
    const items = itemsRes.data || [];

    if (itemsRes.error) {
        logError('notif:load', itemsRes.error);
        container.innerHTML = `<div class="empty-state error">${t.msg_save_error || 'Error loading notifications'}</div>`;
        return;
    }

    const lifecycleReceipts = filterRecentLifecycleReceipts(partnerReceipts);
    const partnerWarrantyItems = extractActivePartnerWarrantyItems(partnerReceipts);
    const notifications = buildLifecycleNotifications(lifecycleReceipts, t);

    if (expiryAlertsEnabled) {
        notifications.push(...buildWarrantyNotifications(items, partnerWarrantyItems, t));
    }

    const totalTrackedCount = items.length + partnerWarrantyItems.length;

    if (notifications.length === 0) {
        if (!expiryAlertsEnabled) {
            container.innerHTML = `
                <div class="notification-card info">
                    <div class="notif-icon"><i class="fa-solid fa-bell-slash"></i></div>
                    <div class="notif-content">
                        <h4>${t.notif_disabled_title || 'Notifications disabled'}</h4>
                        <p>${t.notif_disabled_desc || 'Enable warranty reminders in Settings to see alerts here.'}</p>
                    </div>
                </div>`;
        } else if (totalTrackedCount === 0) {
            container.innerHTML = `
                <div class="notification-card info">
                    <div class="notif-icon"><i class="fa-solid fa-database"></i></div>
                    <div class="notif-content">
                        <h4>${t.notif_empty_title || 'No items yet'}</h4>
                        <p>${t.notif_empty_desc || 'Add at least one item to receive notifications.'}</p>
                    </div>
                </div>`;
        } else {
            container.innerHTML = `
                <div class="notification-card info">
                    <div class="notif-icon"><i class="fa-solid fa-check-circle"></i></div>
                    <div class="notif-content">
                        <h4>${t.notif_all_good_title || 'All good!'}</h4>
                        <p>${(t.notif_all_good_text || 'You have {count} items and none expire within 30 days.').replace('{count}', totalTrackedCount)}</p>
                    </div>
                </div>`;
        }
    } else {
        container.innerHTML = notifications.map(n => `
            <div class="notification-card ${n.type}">
                <div class="notif-icon"><i class="fa-solid ${n.icon}"></i></div>
                <div class="notif-content">
                    <h4>${n.title}</h4>
                    <p>${n.text}</p>
                    ${n.date ? `<span class="notif-time">${n.date}</span>` : ''}
                </div>
            </div>
        `).join('');
    }

    updateNotifBadge(notifications.length);
}

let notifInitialized = false;
let notifLoadPromise = null;
let currentNotifLang = getNotifLang();

let cachedUserId = null;
let cachedUserEmail = null;
let cachedClient = null;

async function ensureNotifLoaded() {
    if (notifInitialized) return;
    if (notifLoadPromise) return notifLoadPromise;
    notifLoadPromise = (async () => {
        try {
            const auth = await requireAuth();
            if (!auth) return;
            cachedUserId = auth.user.id;
            cachedUserEmail = auth.user.email;
            cachedClient = auth.client;
            await loadNotifications(auth.user.id, auth.user.email, auth.client);
            currentNotifLang = getNotifLang();
            notifInitialized = true;
        } catch (e) {
            logError('notif:load', e);
        } finally {
            notifLoadPromise = null;
        }
    })();
    return notifLoadPromise;
}

document.querySelectorAll('[data-view="notifications"]').forEach(el => {
    el.addEventListener('click', ensureNotifLoaded);
});

window.addEventListener('dashboard-view-changed', (e) => {
    if (e.detail?.viewId === 'view-notifications') {
        ensureNotifLoaded();
    }
});

const startsOnNotifView = window.location.hash === '#view-notifications'
    || window.__targetView === 'view-notifications'
    || sessionStorage.getItem('dashboard-view') === 'view-notifications';

if (startsOnNotifView) {
    ensureNotifLoaded();
}

window.addEventListener('lang-changed', async (e) => {
    const newLang = e.detail?.lang || getNotifLang();
    if (notifInitialized && cachedUserId && cachedClient && newLang !== currentNotifLang) {
        currentNotifLang = newLang;
        try {
            await loadNotifications(cachedUserId, cachedUserEmail, cachedClient);
        } catch (e) {
            logError('notif:reloadLang', e);
        }
    }
});

window.addEventListener('phone-changed', async () => {
    if (notifInitialized && cachedUserId && cachedClient) {
        try {
            await loadNotifications(cachedUserId, cachedUserEmail, cachedClient);
        } catch (e) {
            logError('notif:reloadPhone', e);
        }
    } else {
        refreshNotifBadge();
    }
});

if (!startsOnNotifView) {
    (async function initNotifBadge() {
        try {
            const auth = await requireAuth();
            if (!auth) return;
            const count = await computeActiveAlertsCount(auth.user.id, auth.user.email, auth.client);
            updateNotifBadge(count);
        } catch (e) {
            logError('notif:badgeInit', e);
        }
    })();
}