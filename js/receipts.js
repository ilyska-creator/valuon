import { requireAuth, setupLogout } from './dashboard-auth.js';
import { escapeHtml, logError, pluralRu } from './security.js';
import { attachModalA11y } from './modal-a11y.js';
import { buildBuyerReceiptOrFilter, fetchCurrentUserPhone } from './phone-utils.js';
import { createSegmentedIndicator } from './segmented-indicator.js';
import { parseLocalDate } from './warranty-utils.js';
import { pulseHighlight } from './ui-effects.js';

let pendingDeleteId = null;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SIGNED_URL_TTL = 60 * 60;


let currentClient = null;
let currentUserId = null;
let currentUserEmail = null;
let userDefaultCurrency = 'EUR';
let lastBusinessReceipts = [];
let lastPersonalReceipts = [];
let currentReceiptsSort = sessionStorage.getItem('valuon-receipts-sort') || 'newest';
let receiptsLoaded = false;


let uploadModal = null;

let currentRenderedLang = (window.getValuonLang ? window.getValuonLang() : 'en');

window.addEventListener('lang-changed', (e) => {
    const newLang = e.detail?.lang || getLang();
    const select = document.getElementById('upload-receipt-currency');
    if (select && typeof window.renderCurrencyOptions === 'function') {
        window.renderCurrencyOptions(select, newLang);
    }
    if (receiptsLoaded && currentClient && currentUserId && newLang !== currentRenderedLang) {
        currentRenderedLang = newLang;
        renderSplitReceipts(lastBusinessReceipts, lastPersonalReceipts, currentClient, currentUserId, { animateCounts: false, skipLangApply: true });
    }
    if (typeof CustomSelect !== 'undefined') CustomSelect.refreshAll();
});

function getLang() {
    return (window.getValuonLang ? window.getValuonLang() : 'en');
}

// Вкладки и заголовок секции теперь статичны в HTML (как на странице
// "Мои вещи"), поэтому просто восстанавливаем сохранённую вкладку —
// без пересборки разметки и, соответственно, без мигания текста.
function applySavedReceiptsTab() {
    let saved = 'personal';
    try { saved = localStorage.getItem('valuon-receipts-tab') || 'personal'; } catch (_) {}
    if (saved === 'personal') return;

    document.querySelector('#receipts-tabs .items-tab[data-receipts-tab="personal"]')?.classList.remove('active');
    document.querySelector('#receipts-tabs .items-tab[data-receipts-tab="personal"]')?.setAttribute('aria-selected', 'false');
    document.querySelector('#receipts-tabs .items-tab[data-receipts-tab="business"]')?.classList.add('active');
    document.querySelector('#receipts-tabs .items-tab[data-receipts-tab="business"]')?.setAttribute('aria-selected', 'true');

    document.getElementById('receipts-grid-personal')?.classList.add('hidden');
    document.getElementById('receipts-grid-business')?.classList.remove('hidden');
}

const ALLOWED_RECEIPT_MIME_EXT = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf'
};

function buildDownloadFilename(rawName, fileType, filePath, blobType) {
    const cleanBase = String(rawName || 'receipt')
        .replace(/[\\/:*?"<>|]+/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^\.+|\.+$/g, '') || 'receipt';

    const mimeCandidates = [fileType, blobType]
        .map(v => String(v || '').split(';')[0].trim().toLowerCase())
        .filter(Boolean);

    let ext = '';
    for (const mime of mimeCandidates) {
        if (Object.prototype.hasOwnProperty.call(ALLOWED_RECEIPT_MIME_EXT, mime)) {
            ext = ALLOWED_RECEIPT_MIME_EXT[mime];
            break;
        }
        if (mime === 'image/jpg') { ext = 'jpg'; break; }
        if (mime === 'image/heic') { ext = 'heic'; break; }
        if (mime === 'image/heif') { ext = 'heif'; break; }
    }

    if (!ext && filePath) {
        const match = String(filePath).split('?')[0].match(/\.([a-zA-Z0-9]{2,5})$/);
        if (match) ext = match[1].toLowerCase();
    }

    if (!ext) return cleanBase;

    const lowerBase = cleanBase.toLowerCase();
    const alreadyMatches = lowerBase.endsWith('.' + ext) || (ext === 'jpg' && lowerBase.endsWith('.jpeg'));
    return alreadyMatches ? cleanBase : `${cleanBase}.${ext}`;
}

function validateReceiptFile(file) {
    if (!file) return false;
    const lang = getLang();
    if (file.size === 0) {
        showToast(
            lang === 'ru' ? 'Файл пустой. Выберите корректный файл чека.' : 'File is empty. Please choose a valid receipt file.',
            'warning'
        );
        return false;
    }
    if (file.size > MAX_FILE_SIZE) {
        showToast(
            lang === 'ru'
                ? `Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)} МБ). Максимум 10 МБ.`
                : `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB.`,
            'warning'
        );
        return false;
    }
    if (!Object.prototype.hasOwnProperty.call(ALLOWED_RECEIPT_MIME_EXT, file.type)) {
        showToast(
            lang === 'ru'
                ? 'Неподдерживаемый тип файла. Загрузите изображение (JPG, PNG, WebP) или PDF.'
                : 'Unsupported file type. Please upload an image (JPG, PNG, WebP) or PDF.',
            'error'
        );
        return false;
    }
    return true;
}

async function verifyReceiptMagicBytes(file) {
    try {
        const buf = await file.slice(0, 12).arrayBuffer();
        const b = new Uint8Array(buf);
        if (b.length < 4) return false;
        // JPEG: FF D8 FF
        if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return file.type === 'image/jpeg' || file.type === 'image/jpg';
        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return file.type === 'image/png';
        // WEBP: RIFF....WEBP
        if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
            b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return file.type === 'image/webp';
        // PDF: %PDF-
        if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return file.type === 'application/pdf';
        return false;
    } catch (_) {
        return false;
    }
}

async function initReceipts() {
    const auth = await requireAuth();
    if (!auth) return;

    const { user, client } = auth;
    setupLogout(client);

    currentClient = client;
    currentUserId = user.id;
    currentUserEmail = user.email;

    const { data: profile } = await client
        .from('profiles')
        .select('currency')
        .eq('id', user.id)
        .single();
    userDefaultCurrency = profile?.currency || 'EUR';

    const uploadCurrencySelect = document.getElementById('upload-receipt-currency');
    if (uploadCurrencySelect && typeof window.renderCurrencyOptions === 'function') {
        window.renderCurrencyOptions(uploadCurrencySelect, getLang());
    }

    uploadModal = createUploadModal(client, currentUserId);
    setupUploadListeners(uploadModal);
    setupDeleteModal(client, currentUserId);

    applySavedReceiptsTab();
    setupReceiptsTabs();
    setupReceiptsSort();
    setupReceiptsSearch();

    await loadAllReceipts(currentUserEmail, currentUserId, client);
    let hasSavedReceiptsTab = false;
    try { hasSavedReceiptsTab = Boolean(localStorage.getItem('valuon-receipts-tab')); } catch (_) {}
    if (!hasSavedReceiptsTab && lastPersonalReceipts.length === 0 && lastBusinessReceipts.length > 0) {
        activateReceiptsTab('business', { instant: false });
    }
    await populateItemSelect(currentUserId, client);

    if (typeof window.applyDashboardLang === 'function') {
        window.applyDashboardLang(getLang());
    }
}

const VALID_RECEIPTS_SORTS = new Set(['newest', 'oldest', 'price_desc', 'price_asc']);
let currentReceiptsSearch = '';

function setupReceiptsSearch() {
    const input = document.getElementById('receipts-search-input');
    const clearBtn = document.getElementById('receipts-search-clear');
    if (!input) return;

    const applySearch = (val) => {
        currentReceiptsSearch = String(val || '').trim().toLowerCase();
        if (clearBtn) clearBtn.style.display = currentReceiptsSearch ? '' : 'none';
        if (receiptsLoaded) {
            renderSplitReceipts(lastBusinessReceipts, lastPersonalReceipts, currentClient, currentUserId, { animateCounts: false, skipLangApply: true });
        }
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

function matchesPersonalReceiptSearch(r) {
    if (!currentReceiptsSearch) return true;
    const fields = [r.receipt_name, r.store_name, r.items?.name, r.items?.store_name, r.items?.brand];
    return fields.some(v => v && String(v).toLowerCase().includes(currentReceiptsSearch));
}

function matchesBusinessReceiptSearch(r) {
    if (!currentReceiptsSearch) return true;
    const numStr = r.receipt_number ? `#rcp-${r.receipt_number}` : '';
    const fields = [r.shop_name, numStr, r.receipt_number, r.pos_serial];
    if (fields.some(v => v && String(v).toLowerCase().includes(currentReceiptsSearch))) return true;
    if (Array.isArray(r.receipt_items)) {
        return r.receipt_items.some(it => it.item_name && String(it.item_name).toLowerCase().includes(currentReceiptsSearch));
    }
    return false;
}

function buildReceiptsSearchEmptyHTML(t) {
    return `
        <div class="empty-state" data-animate="zoom">
            <div class="empty-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
            <h3 data-i18n="search_empty_title">${escapeHtml(t.search_empty_title || 'Nothing found')}</h3>
            <p data-i18n="search_empty_desc">${escapeHtml(t.search_empty_desc || 'Try a different search query')}</p>
            <button type="button" class="btn btn-outline empty-state-cta btn-reset-receipts-search">
                <span data-i18n="search_reset_btn">${escapeHtml(t.search_reset_btn || 'Reset search')}</span>
            </button>
        </div>`;
}

function setupReceiptsSort() {
    const select = document.getElementById('receipts-sort-select');
    if (!select) return;
    if (!VALID_RECEIPTS_SORTS.has(currentReceiptsSort)) {
        currentReceiptsSort = 'newest';
    }
    select.value = currentReceiptsSort;
    if (typeof CustomSelect !== 'undefined') CustomSelect.refreshAll();

    select.addEventListener('change', () => {
        const nextSort = VALID_RECEIPTS_SORTS.has(select.value) ? select.value : 'newest';
        currentReceiptsSort = nextSort;
        sessionStorage.setItem('valuon-receipts-sort', nextSort);
        if (receiptsLoaded && currentClient && currentUserId) {
            renderSplitReceipts(lastBusinessReceipts, lastPersonalReceipts, currentClient, currentUserId, { animateCounts: false });
        }
    });
}

function getDateTimestamp(primary, fallback) {
    const raw = primary || fallback;
    if (!raw) return 0;
    const dt = (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim()))
        ? parseLocalDate(raw)
        : new Date(raw);
    const ms = dt ? dt.getTime() : NaN;
    return Number.isFinite(ms) ? ms : 0;
}

function getEffectiveBusinessAmount(r) {
    const lc = r?.lifecycle_status;
    if (lc === 'voided' || lc === 'refunded') return null;
    const gross = parseFloat(r?.gross_total);
    if (!Number.isFinite(gross) || gross <= 0) return null;
    if (lc === 'partially_refunded') {
        const ref = parseFloat(r.refunded_amount) || 0;
        return Math.max(0, Math.round((gross - ref) * 100) / 100);
    }
    return gross;
}

function sortReceiptsArray(list, mode, isBusiness) {
    const copy = [...(list || [])];
    const getDate = (r) => isBusiness
        ? getDateTimestamp(r.purchase_date, r.created_at)
        : getDateTimestamp(r.display_date, r.created_at);
    const getAmount = (r) => {
        if (isBusiness) return getEffectiveBusinessAmount(r);
        const val = parseFloat(r.display_amount);
        return Number.isFinite(val) && val > 0 ? val : null;
    };

    copy.sort((a, b) => {
        if (mode === 'oldest') {
            return getDate(a) - getDate(b);
        }
        if (mode === 'price_desc' || mode === 'price_asc') {
            const pa = getAmount(a);
            const pb = getAmount(b);
            if (pa === null && pb === null) return getDate(b) - getDate(a);
            if (pa === null) return 1;
            if (pb === null) return -1;
            if (pa !== pb) return mode === 'price_desc' ? pb - pa : pa - pb;
            return getDate(b) - getDate(a);
        }
        return getDate(b) - getDate(a);
    });
    return copy;
}

const MAX_RECEIPT_ATTACHMENTS = 3;

function getReceiptAttachments(r) {
    if (Array.isArray(r?.attachments) && r.attachments.length > 0) {
        return r.attachments
            .filter(a => a && (a.path || a.url))
            .slice(0, MAX_RECEIPT_ATTACHMENTS);
    }
    if (r?.file_path || r?.file_url) {
        return [{
            path: r.file_path || '',
            url: r.file_url || '',
            type: r.file_type || '',
            name: r.receipt_name || r.display_name || 'receipt',
        }];
    }
    return [];
}

let attViewerInitialized = false;
let attViewerItems = [];
let attViewerIdx = 0;
let attViewerReceiptName = 'receipt';

function getSafeReceiptUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    try {
        const parsed = new URL(rawUrl, window.location.origin);
        if (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && parsed.origin === window.location.origin)) {
            return parsed.href;
        }
    } catch (_) { }
    return '';
}

function renderAttachmentsViewerState() {
    const stage = document.getElementById('att-viewer-stage');
    const thumbs = document.getElementById('att-viewer-thumbs');
    const counter = document.getElementById('att-viewer-counter');
    const openBtn = document.getElementById('att-viewer-open-btn');
    if (!stage || !attViewerItems.length) return;

    const current = attViewerItems[attViewerIdx] || attViewerItems[0];
    const safeCurrentUrl = getSafeReceiptUrl(current.url);
    const lang = getLang();
    const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
    const isPdf = current.type === 'application/pdf' || /\.pdf$/i.test(current.path || '');

    if (counter) counter.textContent = `${attViewerIdx + 1} / ${attViewerItems.length}`;
    if (openBtn) {
        if (safeCurrentUrl) {
            openBtn.href = safeCurrentUrl;
            openBtn.removeAttribute('aria-disabled');
        } else {
            openBtn.removeAttribute('href');
            openBtn.setAttribute('aria-disabled', 'true');
        }
    }

    if (isPdf) {
        const hint = t.attachments_pdf_hint || (lang === 'ru' ? 'PDF-документ — нажмите «Открыть» или «Скачать»' : 'PDF document — tap Open or Download');
        stage.innerHTML = `
            <div class="att-viewer-pdf-box">
                <i class="fa-solid fa-file-pdf" aria-hidden="true"></i>
                <strong>${escapeHtml(current.name || 'document.pdf')}</strong>
                <span>${escapeHtml(hint)}</span>
            </div>`;
    } else {
        stage.innerHTML = `<img src="${escapeHtml(safeCurrentUrl)}" alt="${escapeHtml(current.name || 'Receipt')}">`;
    }

    if (thumbs) {
        thumbs.innerHTML = attViewerItems.map((att, idx) => {
            const pdf = att.type === 'application/pdf' || /\.pdf$/i.test(att.path || '');
            const safeThumbUrl = getSafeReceiptUrl(att.url);
            return `<button type="button" class="att-viewer-thumb${idx === attViewerIdx ? ' active' : ''}" data-att-idx="${idx}" aria-label="${idx + 1}">
                ${pdf ? '<i class="fa-solid fa-file-pdf"></i>' : `<img src="${escapeHtml(safeThumbUrl)}" alt="">`}
            </button>`;
        }).join('');
    }
}

function initAttachmentsViewer() {
    if (attViewerInitialized) return;
    attViewerInitialized = true;
    const modal = document.getElementById('attachments-viewer-modal');
    const closeBtn = document.getElementById('close-att-viewer');
    const thumbs = document.getElementById('att-viewer-thumbs');
    const dlBtn = document.getElementById('att-viewer-download-btn');
    if (!modal) return;

    const close = () => {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.documentElement.classList.remove('modal-open');
    };
    attachModalA11y(modal, { mode: 'active', onClose: close });
    closeBtn?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    thumbs?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-att-idx]');
        if (!btn) return;
        const idx = parseInt(btn.dataset.attIdx, 10);
        if (!isNaN(idx) && idx >= 0 && idx < attViewerItems.length) {
            attViewerIdx = idx;
            renderAttachmentsViewerState();
        }
    });

    dlBtn?.addEventListener('click', async () => {
        const cur = attViewerItems[attViewerIdx];
        const safeUrl = getSafeReceiptUrl(cur?.url);
        if (!safeUrl) return;
        const orig = dlBtn.innerHTML;
        dlBtn.disabled = true;
        dlBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        try {
            const res = await fetch(safeUrl);
            if (!res.ok) throw new Error('Download failed');
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = buildDownloadFilename(`${attViewerReceiptName}-${attViewerIdx + 1}`, cur.type, cur.path, blob.type);
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
        } catch (err) {
            logError('receipts:viewerDownload', err);
            const lang = getLang();
            showToast(lang === 'ru' ? 'Не удалось скачать файл' : 'Failed to download file', 'error');
        } finally {
            dlBtn.innerHTML = orig;
            dlBtn.disabled = false;
        }
    });
}

async function openAttachmentsViewer(receipt, attachments, client) {
    initAttachmentsViewer();
    const modal = document.getElementById('attachments-viewer-modal');
    const titleEl = document.getElementById('att-viewer-title');
    if (!modal || !attachments?.length) return;

    // Ensure fresh signed URLs for all attachments (re-sign if missing or near/past TTL)
    const now = Date.now();
    const maxAgeMs = (SIGNED_URL_TTL - 300) * 1000;
    const pathsNeedingSign = attachments
        .filter(a => {
            if (!a.path) return false;
            if (!a.url) return true;
            const signedAt = Number(a.signed_at || receipt?._signedAt || 0);
            return !signedAt || (now - signedAt > maxAgeMs);
        })
        .map(a => a.path);
    const hydrated = attachments.map(a => ({ ...a }));
    if (pathsNeedingSign.length > 0 && client) {
        try {
            const { data } = await client.storage.from('receipts').createSignedUrls(pathsNeedingSign, SIGNED_URL_TTL);
            if (Array.isArray(data)) {
                const freshAt = Date.now();
                const map = new Map();
                data.forEach((d, i) => { if (d?.signedUrl) map.set(d.path || pathsNeedingSign[i], d.signedUrl); });
                hydrated.forEach(a => {
                    if (a.path && map.has(a.path)) {
                        a.url = map.get(a.path);
                        a.signed_at = freshAt;
                    }
                });
                if (receipt) {
                    receipt._signedAt = freshAt;
                    if (Array.isArray(receipt.attachments)) {
                        receipt.attachments = receipt.attachments.map(a => (
                            a?.path && map.has(a.path)
                                ? { ...a, url: map.get(a.path), signed_at: freshAt }
                                : a
                        ));
                    }
                    if (receipt.file_path && map.has(receipt.file_path)) {
                        receipt.file_url = map.get(receipt.file_path);
                    }
                }
            }
        } catch (_) { }
    }

    attViewerItems = hydrated;
    attViewerIdx = 0;
    attViewerReceiptName = receipt?.display_name || receipt?.receipt_name || 'receipt';
    if (titleEl) titleEl.textContent = attViewerReceiptName;

    renderAttachmentsViewerState();
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('modal-open');
}

async function attachFreshSignedUrls(receipts, client) {
    if (!Array.isArray(receipts) || receipts.length === 0) return [];

    const now = Date.now();
    const msPerSecond = 1000;
    const SAFETY_MARGIN_MS = 5 * 60 * 1000;
    const needsRefresh = new Set();
    const uniquePaths = new Set();

    receipts.forEach((r, idx) => {
        const atts = getReceiptAttachments(r);
        if (atts.length === 0) return;
        const expiresAt = r.created_at
            ? new Date(r.created_at).getTime() + SIGNED_URL_TTL * msPerSecond
            : 0;
        const isExpired = !Number.isFinite(expiresAt) || now + SAFETY_MARGIN_MS >= expiresAt;
        let rowNeeds = false;
        atts.forEach(a => {
            if (!a.path) return;
            if (!a.url || isExpired) {
                uniquePaths.add(a.path);
                rowNeeds = true;
            }
        });
        if (rowNeeds) needsRefresh.add(idx);
    });

    const pathsToSign = [...uniquePaths];
    if (pathsToSign.length === 0) {
        return receipts;
    }

    const signedUrlByPath = new Map();

    try {
        const { data, error } = await client.storage
            .from('receipts')
            .createSignedUrls(pathsToSign, SIGNED_URL_TTL);

        if (!error && Array.isArray(data)) {
            data.forEach((entry, i) => {
                const pathKey = entry?.path || pathsToSign[i];
                if (pathKey && entry?.signedUrl && !entry?.error) {
                    signedUrlByPath.set(pathKey, entry.signedUrl);
                }
            });
        } else if (error) {
            logError('receipts:batchSignUrls', error);
        }
    } catch (err) {
        logError('receipts:batchSignUrlsCatch', err);
    }

    const missingPaths = pathsToSign.filter(p => !signedUrlByPath.has(p));
    if (missingPaths.length > 0) {
        await Promise.all(missingPaths.map(async (p) => {
            try {
                const { data, error } = await client.storage
                    .from('receipts')
                    .createSignedUrl(p, SIGNED_URL_TTL);
                if (!error && data?.signedUrl) {
                    signedUrlByPath.set(p, data.signedUrl);
                } else {
                    logError('receipts:signUrl', error);
                }
            } catch (err) {
                logError('receipts:signUrlCatch', err);
            }
        }));
    }

    const signedAtNow = Date.now();
    return receipts.map((r, idx) => {
        if (!needsRefresh.has(idx)) {
            return r._signedAt ? r : { ...r, _signedAt: r.created_at ? new Date(r.created_at).getTime() : signedAtNow };
        }
        const next = { ...r, _signedAt: signedAtNow };
        if (r.file_path && signedUrlByPath.has(r.file_path)) {
            next.file_url = signedUrlByPath.get(r.file_path);
        }
        if (Array.isArray(r.attachments) && r.attachments.length > 0) {
            next.attachments = r.attachments.map(a => (
                a?.path && signedUrlByPath.has(a.path)
                    ? { ...a, url: signedUrlByPath.get(a.path), signed_at: signedAtNow }
                    : a
            ));
        }
        return next;
    });
}

async function loadAllReceipts(userEmail, userId, client) {
    // Шапка и вкладки статичны (как на "Мои вещи") и никогда не пересобираются,
    // а значит вкладки кликабельны и во время загрузки. Поэтому лоадер ставим
    // в обе сетки сразу — иначе клик по неактивной вкладке во время загрузки
    // на миг показал бы пустую сетку вместо индикатора загрузки.
    const personalGrid = document.getElementById('receipts-grid-personal');
    const businessGrid = document.getElementById('receipts-grid-business');
    if (!personalGrid || !businessGrid) return;

    const lang = getLang();
    const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
    const phrases = [
        t.loading_receipts || 'Загружаем чеки…',
        t.loading_signatures || 'Проверяем подписи…',
        t.loading_items_update || 'Обновляем статусы…'
    ];

    [personalGrid, businessGrid].forEach(grid => {
        grid.innerHTML = '<div class="rotating-loader"></div>';
        const loaderEl = grid.querySelector('.rotating-loader');
        if (loaderEl && typeof RotatingTextLoader !== 'undefined') {
            new RotatingTextLoader(loaderEl, phrases, { interval: 800 });
        }
    });

    try {
        const userPhone = await fetchCurrentUserPhone(client, userId);
        const buyerOrFilter = buildBuyerReceiptOrFilter({ userId, email: userEmail, phone: userPhone });

        let bizRes = buyerOrFilter
            ? await client
                .from('business_receipts')
                .select('*, receipt_items(*)')
                .or(buyerOrFilter)
                .order('purchase_date', { ascending: false })
                .order('sort_order', { referencedTable: 'receipt_items', ascending: true })
            : { data: [], error: null };

        if (bizRes.error && bizRes.error.code === '42703' && userEmail) {
            bizRes = await client
                .from('business_receipts')
                .select('*, receipt_items(*)')
                .eq('customer_email', userEmail)
                .order('purchase_date', { ascending: false })
                .order('sort_order', { referencedTable: 'receipt_items', ascending: true });
        }

        const { data: businessData, error: bizError } = bizRes;
        if (bizError) logError('receipts:loadBiz', bizError);

        const { data: personalData, error: personalError } = await client
            .from('receipts')
            .select('*, items(name, price, purchase_date, store_name, currency)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (personalError) throw personalError;

        const personalWithFreshUrls = await attachFreshSignedUrls(personalData || [], client);

        lastBusinessReceipts = businessData || [];
        lastPersonalReceipts = personalWithFreshUrls;
        receiptsLoaded = true;

        renderSplitReceipts(lastBusinessReceipts, lastPersonalReceipts, client, userId);

        const params = new URLSearchParams(window.location.search);
        const highlightId = params.get('highlight');
        if (highlightId) {
            params.delete('highlight');
            const nextQs = params.toString();
            const nextUrl = `${window.location.pathname}${nextQs ? `?${nextQs}` : ''}${window.location.hash}`;
            try { history.replaceState(null, '', nextUrl); } catch (_) {}

            const bizCard = document.querySelector(`#receipts-grid-business [data-receipt-id="${CSS.escape(highlightId)}"], #receipts-grid-business [data-id="${CSS.escape(highlightId)}"]`)?.closest('.receipt-card, .biz-receipt-card, .item-card');
            if (bizCard) {
                if (typeof activateReceiptsTab === 'function') activateReceiptsTab('business');
                setTimeout(() => pulseHighlight(bizCard), 120);
            } else {
                const persCard = document.querySelector(`#receipts-grid-personal [data-receipt-id="${CSS.escape(highlightId)}"], #receipts-grid-personal [data-id="${CSS.escape(highlightId)}"]`)?.closest('.receipt-card, .item-card');
                if (persCard) {
                    if (typeof activateReceiptsTab === 'function') activateReceiptsTab('personal');
                    setTimeout(() => pulseHighlight(persCard), 120);
                }
            }
        }
    } catch (e) {
        logError('receipts:load', e);
        const errLang = getLang();
        const errorHtml = `<p class="empty-state error">${errLang === 'en' ? 'Data load error.' : 'Ошибка загрузки данных.'}</p>`;
        personalGrid.innerHTML = errorHtml;
        businessGrid.innerHTML = errorHtml;
    }
}

function renderSplitReceipts(businessReceipts, personalReceipts, client, userId, opts = {}) {
    const lang = getLang();
    const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};

    const personalGrid = document.getElementById('receipts-grid-personal');
    const businessGrid = document.getElementById('receipts-grid-business');
    if (!personalGrid || !businessGrid) return;

    personalGrid.innerHTML = buildPersonalGridHTML(personalReceipts, t, lang);
    businessGrid.innerHTML = buildBusinessGridHTML(businessReceipts, t, lang);

    if (opts.animateCounts !== false) {
        requestAnimationFrame(() => {
            window.animateCount(document.getElementById('receipts-count-personal'), personalReceipts.length);
            window.animateCount(document.getElementById('receipts-count-business'), businessReceipts.length);
        });
    }
    updateReceiptsSummary();
    restoreListeners(client, userId);
    document.querySelectorAll('.btn-reset-receipts-search').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById('receipts-search-input');
            if (input) {
                input.value = '';
                input.dispatchEvent(new Event('input'));
            }
        });
    });
}

function updateReceiptsSummary() {
    const summaryStrip = document.getElementById('receipts-summary-strip');
    const totalEl = document.getElementById('receipts-summary-total');
    const countEl = document.getElementById('receipts-summary-count');
    if (!summaryStrip || !totalEl || !countEl) return;

    let activeTab = 'personal';
    try { activeTab = localStorage.getItem('valuon-receipts-tab') || 'personal'; } catch (_) {}
    const rawReceipts = activeTab === 'personal' ? lastPersonalReceipts : lastBusinessReceipts;
    const receipts = currentReceiptsSearch
        ? rawReceipts.filter(r => activeTab === 'personal' ? matchesPersonalReceiptSearch(r) : matchesBusinessReceiptSearch(r))
        : rawReceipts;

    if (!receiptsLoaded || !receipts || receipts.length === 0) {
        summaryStrip.classList.add('hidden');
        return;
    }

    const lang = getLang();
    const sumsByCurrency = new Map();
    let validCount = 0;

    receipts.forEach(r => {
        const isPersonal = activeTab === 'personal';
        const amt = isPersonal
            ? Number(r.items?.price ?? r.amount)
            : getEffectiveBusinessAmount(r);
        const cur = (isPersonal ? (r.items?.currency ?? r.currency) : r.currency) || userDefaultCurrency || 'EUR';
        if (Number.isFinite(amt) && amt > 0) {
            sumsByCurrency.set(cur, (sumsByCurrency.get(cur) || 0) + amt);
            validCount++;
        }
    });

    if (sumsByCurrency.size === 0) {
        summaryStrip.classList.add('hidden');
        return;
    }

    const formattedTotals = Array.from(sumsByCurrency.entries())
        .map(([cur, sum]) => (typeof window.formatCurrency === 'function')
            ? window.formatCurrency(sum, cur, lang)
            : `${sum.toFixed(2)} ${cur}`)
        .join(' · ');

    totalEl.textContent = formattedTotals;
    const purchasesWord = lang === 'ru'
        ? `${validCount} ${pluralRu(validCount, 'чек', 'чека', 'чеков')}`
        : `${validCount} ${validCount === 1 ? 'receipt' : 'receipts'}`;
    countEl.textContent = purchasesWord;
    summaryStrip.classList.remove('hidden');
}

function buildPersonalGridHTML(receipts, t, lang) {
    if (receipts.length === 0) {
        return `
            <div class="empty-state" data-animate="zoom">
                <div class="empty-icon"><i class="fa-solid fa-receipt"></i></div>
                <h3 data-i18n="no_personal_receipts">${t.no_personal_receipts || (lang === 'ru' ? 'Пока нет загруженных чеков' : 'No personal receipts yet')}</h3>
                <p data-i18n="personal_empty_desc">${t.personal_empty_desc || (lang === 'ru' ? 'Сфотографируйте или загрузите первый чек — он останется здесь навсегда.' : 'Photograph or upload your first receipt — it will stay here for good.')}</p>
                <button type="button" class="btn btn-outline empty-state-cta" id="empty-upload-receipt-btn">
                    <i class="fa-solid fa-upload"></i> <span data-i18n="personal_empty_cta">${t.personal_empty_cta || (lang === 'ru' ? 'Загрузить чек' : 'Upload receipt')}</span>
                </button>
            </div>`;
    }

    const filtered = currentReceiptsSearch ? receipts.filter(matchesPersonalReceiptSearch) : receipts;
    if (filtered.length === 0) {
        return buildReceiptsSearchEmptyHTML(t);
    }

    const flatData = filtered.map(r => ({
        ...r,
        item_name: r.items?.name || null,
        display_name: r.items?.name || r.receipt_name || r.store_name || 'Untitled Receipt',
        display_amount: r.items?.price ?? r.amount,
        display_currency: r.items?.currency ?? r.currency,
        display_date: r.items?.purchase_date || r.purchase_date,
        display_store: r.items?.store_name || r.store_name,
        is_linked: !!r.items
    }));

    const sorted = sortReceiptsArray(flatData, currentReceiptsSort, false);
    return sorted.map(r => renderPersonalCard(r, t)).join('');
}

function buildBusinessGridHTML(receipts, t, lang) {
    if (receipts.length === 0) {
        return `
            <div class="empty-state" data-animate="zoom">
                <div class="empty-icon"><i class="fa-solid fa-store"></i></div>
                <h3 data-i18n="no_business_receipts">${t.no_business_receipts || (lang === 'ru' ? 'Пока нет чеков от партнёров' : 'No business receipts yet')}</h3>
                <p data-i18n="business_empty_desc">${t.business_empty_desc || (lang === 'ru' ? 'Как только магазин-партнёр Valuon выпишет чек на ваш email или телефон, он появится здесь автоматически.' : 'Once a Valuon partner store issues a receipt to your email or phone, it will appear here automatically.')}</p>
            </div>`;
    }

    const filtered = currentReceiptsSearch ? receipts.filter(matchesBusinessReceiptSearch) : receipts;
    if (filtered.length === 0) {
        return buildReceiptsSearchEmptyHTML(t);
    }

    const sorted = sortReceiptsArray(filtered, currentReceiptsSort, true);
    return sorted.map(r => renderBusinessCard(r, t)).join('');
}

let _receiptsTabTransitionTimer = null;

function switchReceiptsGridTab(oldGrid, newGrid) {
    if (!newGrid || oldGrid === newGrid) return;
    if (_receiptsTabTransitionTimer) {
        clearTimeout(_receiptsTabTransitionTimer);
        _receiptsTabTransitionTimer = null;
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

    _receiptsTabTransitionTimer = setTimeout(() => {
        newGrid.classList.remove('fade-in');
        _receiptsTabTransitionTimer = null;
    }, 310);
}

let _receiptsTabsIndicator = null;

function activateReceiptsTab(target, { instant = false } = {}) {
    const tab = document.querySelector(`#receipts-tabs .items-tab[data-receipts-tab="${target}"]`);
    if (!tab || tab.classList.contains('active')) return;

    const tabs = document.querySelectorAll('#receipts-tabs .items-tab');
    tabs.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    if (_receiptsTabsIndicator) _receiptsTabsIndicator.update(instant);

    try { localStorage.setItem('valuon-receipts-tab', target); } catch (_) {}
    const personalGrid = document.getElementById('receipts-grid-personal');
    const businessGrid = document.getElementById('receipts-grid-business');
    if (instant) {
        if (target === 'personal') {
            businessGrid?.classList.add('hidden');
            personalGrid?.classList.remove('hidden');
        } else {
            personalGrid?.classList.add('hidden');
            businessGrid?.classList.remove('hidden');
        }
    } else {
        const oldGrid = target === 'personal' ? businessGrid : personalGrid;
        const newGrid = target === 'personal' ? personalGrid : businessGrid;
        switchReceiptsGridTab(oldGrid, newGrid);
    }
    updateReceiptsSummary();
}

function setupReceiptsTabs() {
    const tabsWrap = document.getElementById('receipts-tabs');
    const tabs = document.querySelectorAll('#receipts-tabs .items-tab');
    const indicatorEl = document.getElementById('receipts-tab-indicator');
    _receiptsTabsIndicator = createSegmentedIndicator(tabsWrap, indicatorEl, {
        itemSelector: '.items-tab',
    });

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            activateReceiptsTab(tab.dataset.receiptsTab);
        });
    });

    window.addEventListener('lang-changed', () => _receiptsTabsIndicator?.update(true));
}

function renderBusinessCard(r, t) {
    const lang = getLang();
    const locale = lang === 'ru' ? 'ru-RU' : 'en-US';
    const dateObj = r.purchase_date ? parseLocalDate(r.purchase_date) : null;
    const dateStr = dateObj ? dateObj.toLocaleDateString(locale) : '—';
    const receiptNum = escapeHtml(r.receipt_number ? `#RCP-${r.receipt_number}` : `#${String(r.id).slice(0, 8).toUpperCase()}`);

    const lc = r.lifecycle_status || 'active';
    const closed = lc === 'voided' || lc === 'refunded';
    const isPartial = lc === 'partially_refunded';

    const lineItems = Array.isArray(r.receipt_items) ? r.receipt_items : [];
    const itemsCount = lineItems.length;

    const renderLineItem = (it) => {
        const qty = Math.max(1, parseInt(it.qty, 10) || 1);
        const refQty = Math.max(0, parseInt(it.refunded_qty, 10) || 0);
        const fullRef = !closed && refQty >= qty;
        const partRef = !closed && refQty > 0 && refQty < qty;
        const refPill = fullRef
            ? `<span class="item-refund-pill">${escapeHtml(t.lifecycle_item_returned_badge || 'Возвращено')}</span>`
            : partRef
                ? `<span class="item-refund-pill partial">${escapeHtml((t.lifecycle_item_returned_short || '−{n} возвр.').replace('{n}', String(refQty)))}</span>`
                : '';
        const warrantyHtml = (it.warranty_months && !fullRef && !closed)
            ? `<span class="receipt-doc-item-warranty">${escapeHtml(String(it.warranty_months))} ${escapeHtml(t.months_short || 'mo')}.</span>`
            : '';
        return `
            <li class="receipt-doc-item-row${fullRef ? ' item-row-refunded' : ''}">
                <div class="receipt-doc-item-left">
                    <span class="item-name">${escapeHtml(it.item_name)}</span>
                    <span class="item-qty">×${qty}</span>
                    ${refPill}
                </div>
                ${warrantyHtml}
            </li>`;
    };

    const itemsListHtml = itemsCount > 0 ? `
        <ul class="receipt-doc-items${closed ? ' is-struck' : ''}">
            ${lineItems.map(renderLineItem).join('')}
        </ul>` : '';

    const currency = r.currency || 'EUR';
    const grossVal = parseFloat(r.gross_total) || 0;
    const refundedVal = parseFloat(r.refunded_amount) || 0;
    const netVal = isPartial ? Math.max(0, Math.round((grossVal - refundedVal) * 100) / 100) : grossVal;
    const priceFormatted = escapeHtml(window.formatCurrency(isPartial ? netVal : grossVal, currency, lang));
    const deltaHtml = (isPartial && refundedVal > 0)
        ? `<span class="receipt-doc-amount-delta">−${escapeHtml(window.formatCurrency(refundedVal, currency, lang))}</span>`
        : '';

    const lcMetaMap = {
        active: { labelKey: 'status_business_verified', fallback: 'Verified' },
        partially_refunded: { labelKey: 'lifecycle_partially_refunded', fallback: 'Partial Refund' },
        refunded: { labelKey: 'lifecycle_refunded', fallback: 'Refunded' },
        voided: { labelKey: 'lifecycle_voided', fallback: 'Voided' },
    };
    const lcMeta = lcMetaMap[lc] || lcMetaMap.active;
    const statusLabel = escapeHtml(t[lcMeta.labelKey] || lcMeta.fallback);
    const btnDownloadText = escapeHtml(t.btn_download || 'Скачать');
    const shopName = escapeHtml(r.shop_name || '—');

    let lifecycleNoteHtml = '';
    if (lc !== 'active' && (r.status_reason || r.status_changed_at)) {
        const changedDateObj = r.status_changed_at ? parseLocalDate(r.status_changed_at) : null;
        const changedStr = changedDateObj ? changedDateObj.toLocaleDateString(locale) : '';
        const reasonStr = r.status_reason ? escapeHtml(r.status_reason) : '';
        lifecycleNoteHtml = `
            <div class="receipt-lifecycle-meta is-${escapeHtml(lc)}">
                ${changedStr ? `<span><strong>${statusLabel}</strong> · ${escapeHtml(changedStr)}</span>` : ''}
                ${reasonStr ? `<span>${escapeHtml(t.lifecycle_reason_prefix || 'Причина:')} ${reasonStr}</span>` : ''}
            </div>`;
    }

    return `
        <article class="receipt-doc-card is-business lifecycle-${escapeHtml(lc)}" data-id="${escapeHtml(r.id)}" data-lifecycle-status="${escapeHtml(lc)}">
            <div class="receipt-doc-top">
                <div class="receipt-doc-identity">
                    <div class="receipt-doc-icon is-${escapeHtml(lc)}" aria-hidden="true">
                        <i class="fa-solid fa-file-invoice-dollar"></i>
                    </div>
                    <div class="receipt-doc-heading">
                        <h3 class="receipt-doc-title" title="${receiptNum}">${receiptNum}</h3>
                        <div class="receipt-doc-subtitle" title="${shopName}">
                            <i class="fa-solid fa-store" aria-hidden="true"></i>
                            <span>${shopName}</span>
                        </div>
                    </div>
                </div>
                <span class="receipt-status-badge is-${escapeHtml(lc)}" data-i18n="${lcMeta.labelKey}">${statusLabel}</span>
            </div>

            <div class="receipt-doc-hero">
                <div class="receipt-doc-amount-wrap">
                    <span class="receipt-doc-amount${closed ? ' is-struck' : ''}">${priceFormatted}</span>
                    ${deltaHtml}
                </div>
                <span class="receipt-doc-date">
                    <i class="fa-regular fa-calendar" aria-hidden="true"></i>
                    <span>${escapeHtml(dateStr)}</span>
                </span>
            </div>

            <div class="receipt-doc-content">
                ${itemsListHtml}
                ${lifecycleNoteHtml}
            </div>

            <div class="receipt-doc-actions">
                <button type="button" class="receipt-doc-btn is-primary btn-download-biz" data-receipt-id="${escapeHtml(r.id)}" title="${btnDownloadText}">
                    <i class="fa-solid fa-download" aria-hidden="true"></i>
                    <span data-i18n="btn_download">${btnDownloadText}</span>
                </button>
            </div>
        </article>
    `;
}

function renderPersonalCard(r, t) {
    const lang = getLang();
    const isPdf = r.file_type === 'application/pdf';
    const isImage = r.file_type && r.file_type.startsWith('image/');
    const iconClass = isPdf ? 'fa-file-pdf' : isImage ? 'fa-file-image' : 'fa-file-invoice';
    const typeKey = isPdf ? 'receipt_type_pdf' : isImage ? 'receipt_type_image' : 'receipt_type_file';
    const typeFallback = isPdf ? 'PDF' : isImage ? (lang === 'ru' ? 'Фото' : 'Photo') : (lang === 'ru' ? 'Файл' : 'File');
    const typeLabel = escapeHtml(t[typeKey] || typeFallback);

    const amountVal = parseFloat(r.display_amount);
    const hasAmount = Number.isFinite(amountVal) && amountVal > 0;
    const priceFormatted = hasAmount
        ? escapeHtml(window.formatCurrency(amountVal, r.display_currency || 'EUR', lang))
        : '';
    const displayDateObj = r.display_date ? parseLocalDate(r.display_date) : null;
    const dateStr = displayDateObj
        ? escapeHtml(displayDateObj.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US'))
        : '';

    const displayName = escapeHtml(r.display_name);
    const storeHtml = r.display_store ? `
        <div class="receipt-doc-subtitle" title="${escapeHtml(r.display_store)}">
            <i class="fa-solid fa-store" aria-hidden="true"></i>
            <span>${escapeHtml(r.display_store)}</span>
        </div>` : '';

    const heroHtml = (hasAmount || dateStr) ? `
        <div class="receipt-doc-hero${!hasAmount ? ' is-date-only' : ''}">
            ${hasAmount ? `<div class="receipt-doc-amount-wrap"><span class="receipt-doc-amount">${priceFormatted}</span></div>` : ''}
            ${dateStr ? `<span class="receipt-doc-date"><i class="fa-regular fa-calendar" aria-hidden="true"></i><span>${dateStr}</span></span>` : ''}
        </div>` : '';

    const linkedHtml = r.is_linked ? `
        <div class="receipt-doc-linked" title="${escapeHtml(r.item_name)}">
            <i class="fa-solid fa-link" aria-hidden="true"></i>
            <span class="receipt-doc-linked-label" data-i18n="receipt_linked_label">${escapeHtml(t.receipt_linked_label || (lang === 'ru' ? 'Товар' : 'Item'))}:</span>
            <span class="receipt-doc-linked-val">${escapeHtml(r.item_name)}</span>
        </div>` : '';

    const btnViewText = escapeHtml(t.btn_view || 'Просмотр');
    const btnDownloadText = escapeHtml(t.btn_download || 'Скачать');
    const btnDeleteText = escapeHtml(t.btn_delete || 'Удалить');

    const attachments = getReceiptAttachments(r);
    const attCount = attachments.length;
    const multiBadgeTpl = t.receipt_files_badge_few || (lang === 'ru' ? '{n} файла' : '{n} files');
    const badgeHtml = attCount > 1
        ? `<span class="receipt-type-badge is-multi"><i class="fa-solid fa-paperclip" aria-hidden="true"></i> ${escapeHtml(multiBadgeTpl.replace('{n}', String(attCount)))}</span>`
        : `<span class="receipt-type-badge" data-i18n="${typeKey}">${typeLabel}</span>`;

    const downloadBtnHtml = attCount > 1 ? '' : `
                <button type="button" class="receipt-doc-btn is-secondary btn-download-receipt"
                        data-url="${escapeHtml(r.file_url)}"
                        data-name="${displayName}"
                        data-file-type="${escapeHtml(r.file_type || '')}"
                        data-file-path="${escapeHtml(r.file_path || '')}"
                        title="${btnDownloadText}">
                    <i class="fa-solid fa-download" aria-hidden="true"></i>
                    <span data-i18n="btn_download">${btnDownloadText}</span>
                </button>`;

    return `
        <article class="receipt-doc-card is-personal" data-id="${escapeHtml(r.id)}">
            <div class="receipt-doc-top">
                <div class="receipt-doc-identity">
                    <div class="receipt-doc-icon is-personal" aria-hidden="true">
                        <i class="fa-solid ${iconClass}"></i>
                    </div>
                    <div class="receipt-doc-heading">
                        <h3 class="receipt-doc-title" title="${displayName}">${displayName}</h3>
                        ${storeHtml}
                    </div>
                </div>
                ${badgeHtml}
            </div>

            ${heroHtml}

            <div class="receipt-doc-content">
                ${linkedHtml}
            </div>

            <div class="receipt-doc-actions">
                <button type="button" class="receipt-doc-btn is-primary btn-view-receipt"
                        data-receipt-id="${escapeHtml(r.id)}"
                        data-url="${escapeHtml(r.file_url)}"
                        data-file-path="${escapeHtml(r.file_path || '')}"
                        title="${btnViewText}">
                    <i class="fa-solid fa-eye" aria-hidden="true"></i>
                    <span data-i18n="btn_view">${btnViewText}</span>
                </button>
                ${downloadBtnHtml}
                <button type="button" class="receipt-doc-btn is-danger is-icon btn-delete-receipt"
                        data-id="${escapeHtml(r.id)}"
                        title="${btnDeleteText}" aria-label="${btnDeleteText}">
                    <i class="fa-solid fa-trash" aria-hidden="true"></i>
                </button>
            </div>
        </article>
    `;
}

function setupUploadListeners(modal) {
    if (!modal) return;
    document.getElementById('upload-receipt-btn')?.addEventListener('click', modal.open);
    document.getElementById('empty-upload-receipt-btn')?.addEventListener('click', modal.open);

    const dropZone = document.getElementById('drop-zone');
    if (!dropZone) return;

    dropZone.addEventListener('click', modal.open);

    let dragCounter = 0;

    dropZone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragCounter = Math.max(0, dragCounter - 1);
        if (dragCounter === 0) {
            dropZone.classList.remove('drag-over');
        }
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        dropZone.classList.remove('drag-over');
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            if (!validateReceiptFile(files[0])) return;
            modal.open();
            modal.setFile(files[0]);
        }
    });
}

function restoreListeners(client, userId) {
    const lang = getLang();

    // Кнопка в пустом состоянии сетки — сам элемент каждый раз создаётся
    // заново при обновлении содержимого, поэтому биндим её здесь, а не
    // один раз при инициализации (в отличие от статичных upload-zone/шапки).
    document.getElementById('empty-upload-receipt-btn')?.addEventListener('click', () => uploadModal?.open());

    const urlSignedAt = Date.now();
    const resolveFreshReceiptUrl = async (btn) => {
        const filePath = btn.dataset.filePath;
        const currentUrl = btn.dataset.url;
        const signedAt = Number(btn.dataset.signedAt) || urlSignedAt;
        const isExpiring = Date.now() - signedAt > (SIGNED_URL_TTL - 300) * 1000;
        if (filePath && (!currentUrl || isExpiring)) {
            const { data, error } = await client.storage
                .from('receipts')
                .createSignedUrl(filePath, SIGNED_URL_TTL);
            if (!error && data?.signedUrl) {
                btn.dataset.url = data.signedUrl;
                btn.dataset.signedAt = String(Date.now());
                return data.signedUrl;
            }
        }
        return currentUrl || '';
    };

    document.querySelectorAll('.btn-view-receipt').forEach(btn => {
        btn.addEventListener('click', async () => {
            const receiptId = btn.dataset.receiptId;
            const rec = receiptId
                ? (lastPersonalReceipts || []).find(x => String(x.id) === String(receiptId))
                : null;
            const atts = rec ? getReceiptAttachments(rec) : [];
            if (atts.length > 1) {
                openAttachmentsViewer(rec, atts, client);
                return;
            }
            const rawUrl = await resolveFreshReceiptUrl(btn);
            const safeUrl = getSafeReceiptUrl(rawUrl);
            if (safeUrl) {
                window.open(safeUrl, '_blank', 'noopener,noreferrer');
            }
        });
    });

    document.querySelectorAll('.btn-download-receipt').forEach(btn => {
        btn.addEventListener('click', async () => {
            const name = btn.dataset.name || 'receipt';
            const originalHTML = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            try {
                const url = await resolveFreshReceiptUrl(btn);
                const safeUrl = getSafeReceiptUrl(url);
                if (!safeUrl) throw new Error('Invalid or missing receipt URL');
                const response = await fetch(safeUrl);
                if (!response.ok) throw new Error('Network response was not ok');
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = buildDownloadFilename(name, btn.dataset.fileType, btn.dataset.filePath, blob.type);
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(blobUrl);
                }, 200);
            } catch (err) {
                logError('receipts:download', err);
                showToast(lang === 'ru' ? 'Не удалось скачать файл' : 'Failed to download file', 'error');
            } finally {
                btn.innerHTML = originalHTML;
                btn.disabled = false;
            }
        });
    });

    document.querySelectorAll('.btn-download-biz').forEach(btn => {
        btn.addEventListener('click', async () => {
            const originalHTML = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            try {
                const { ensurePdfLibsLoaded, downloadReceiptPDF } = await import('./receipt-generator.js?v=20261126l');
                await ensurePdfLibsLoaded();
                const userPhoneForPdf = await fetchCurrentUserPhone(client, userId);
                const pdfOrFilter = buildBuyerReceiptOrFilter({ userId, email: currentUserEmail, phone: userPhoneForPdf });
                let pdfRes = pdfOrFilter
                    ? await client
                        .from('business_receipts')
                        .select('*, receipt_items(*)')
                        .eq('id', btn.dataset.receiptId)
                        .or(pdfOrFilter)
                        .order('sort_order', { referencedTable: 'receipt_items', ascending: true })
                        .single()
                    : { data: null, error: new Error('Receipt not found') };

                if (pdfRes.error && pdfRes.error.code === '42703' && currentUserEmail) {
                    pdfRes = await client
                        .from('business_receipts')
                        .select('*, receipt_items(*)')
                        .eq('id', btn.dataset.receiptId)
                        .eq('customer_email', currentUserEmail)
                        .order('sort_order', { referencedTable: 'receipt_items', ascending: true })
                        .single();
                }

                const { data: receipt, error } = pdfRes;

                if (error || !receipt) throw error || new Error('Receipt not found');

                if (!Array.isArray(receipt.receipt_items) || receipt.receipt_items.length === 0) {
                    const { data: items } = await client
                        .from('receipt_items')
                        .select('*')
                        .eq('receipt_id', receipt.id)
                        .order('sort_order');
                    if (items?.length) receipt.receipt_items = items;
                }

                let shopMeta = {};
                if (receipt.shop_id) {
                    try {
                        const { data: sData } = await client
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
                logError('receipts:pdfGen', e);
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
        });
    });

    document.querySelectorAll('.btn-delete-receipt').forEach(btn => {
        btn.addEventListener('click', () => {
            pendingDeleteId = btn.dataset.id;
            document.getElementById('delete-receipt-modal')?.classList.add('active');
            document.documentElement.classList.add('modal-open');
        });
    });
}

async function populateItemSelect(userId, client) {
    const select = document.getElementById('linked-item-select');
    if (!select) return;

    const [{ data: itemsData }, { data: linkedReceipts }] = await Promise.all([
        client
            .from('items')
            .select('id, name, price, purchase_date, store_name, type, currency')
            .eq('user_id', userId)
            .order('name'),
        client
            .from('receipts')
            .select('item_id')
            .eq('user_id', userId)
            .not('item_id', 'is', null),
    ]);

    const linkedItemIds = new Set(
        (linkedReceipts || []).map(r => String(r.item_id)).filter(Boolean)
    );

    // Keep only the placeholder option (value="")
    Array.from(select.options).forEach((opt) => {
        if (opt.value !== '') opt.remove();
    });
    select.value = '';

    if (itemsData) {
        itemsData.forEach(item => {
            if (linkedItemIds.has(String(item.id))) return;
            const opt = document.createElement('option');
            opt.value = item.id;
            opt.textContent = item.name;
            opt.dataset.price = item.price ?? '';
            opt.dataset.date = item.purchase_date || '';
            opt.dataset.store = item.store_name || '';
            opt.dataset.name = item.name || '';
            opt.dataset.currency = item.currency || 'EUR';
            const icon = deviceIconMarkup(item.type);
            if (icon) {
                opt.setAttribute('data-icon', icon);
            }
            select.appendChild(opt);
        });
    }

    if (select._cs) {
        select._cs.refresh();
    } else if (typeof CustomSelect !== 'undefined') {
        CustomSelect.refreshAll();
    }
}

function syncModalOpenClass() {
    if (!document.querySelector('.modal-overlay.active:not(.closing), .modal.active:not(.closing)')) {
        document.documentElement.classList.remove('modal-open');
    }
}

function setupDeleteModal(client, userId) {
    const modal = document.getElementById('delete-receipt-modal');
    const confirmBtn = document.getElementById('confirm-delete-receipt');
    const cancelBtn = document.getElementById('cancel-delete-receipt');

    function closeDeleteModal() {
        if (modal?.classList.contains('closing')) return;
        modal?.classList.add('closing');
        setTimeout(() => {
            modal?.classList.remove('active', 'closing');
            syncModalOpenClass();
            pendingDeleteId = null;
        }, 250);
    }

    attachModalA11y(modal, { mode: 'active', onClose: closeDeleteModal });

    cancelBtn?.addEventListener('click', closeDeleteModal);
    modal?.addEventListener('click', (e) => { if (e.target === modal) closeDeleteModal(); });

    confirmBtn?.addEventListener('click', async () => {
        if (!pendingDeleteId) return;

        const lang = getLang();
        const originalHTML = confirmBtn.innerHTML;
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            const { data: delReceipt } = await client
                .from('receipts')
                .select('file_path, attachments')
                .eq('id', pendingDeleteId)
                .eq('user_id', userId)
                .single();

            const { error: dbError } = await client.from('receipts').delete()
                .eq('id', pendingDeleteId)
                .eq('user_id', userId);

            if (dbError) throw dbError;

            const pathsToRemove = new Set();
            if (delReceipt?.file_path) pathsToRemove.add(delReceipt.file_path);
            if (Array.isArray(delReceipt?.attachments)) {
                delReceipt.attachments.forEach(a => { if (a?.path) pathsToRemove.add(a.path); });
            }
            if (pathsToRemove.size > 0) {
                const { error: storageError } = await client.storage
                    .from('receipts')
                    .remove([...pathsToRemove]);

                if (storageError) {
                    logError('receipts:storageDelete', storageError);
                }
            }

            showToast(lang === 'ru' ? 'Чек удалён' : 'Receipt deleted', 'success');
            closeDeleteModal();

            await loadAllReceipts(currentUserEmail, userId, client);
            await populateItemSelect(userId, client);

        } catch (err) {
            logError('receipts:delete', err);
            showToast(
                lang === 'ru'
                    ? 'Не удалось удалить чек. Попробуйте ещё раз.'
                    : 'Failed to delete receipt. Please try again.',
                'error'
            );
        } finally {
            confirmBtn.innerHTML = originalHTML;
            confirmBtn.disabled = false;
        }
    });
}


function createUploadModal(client, userId) {
    const modal = document.getElementById('upload-modal');
    const closeBtn = document.getElementById('close-upload-modal');
    const cancelBtn = document.getElementById('cancel-upload-modal');
    const form = document.getElementById('upload-receipt-form');
    const fileInput = document.getElementById('modal-file-input');
    const fileNameDisplay = document.getElementById('file-name-display');
    const miniDropZone = document.getElementById('modal-drop-zone');
    const linkedItemSelect = document.getElementById('linked-item-select');

    if (!modal || !form) {
        return { open: () => { }, setFile: () => { } };
    }

    const receiptNameInput = form.querySelector('[name="receipt_name"]');
    const amountInput = form.querySelector('[name="amount"]');
    const dateInput = form.querySelector('[name="purchase_date"]');
    if (dateInput) {
        const now = new Date();
        dateInput.max = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
    const storeInput = form.querySelector('[name="store_name"]');
    const currencySelect = form.querySelector('[name="currency"]');
    const lockIcons = form.querySelectorAll('.lock-icon');
    const linkHint = document.getElementById('link-hint');
    const lockedFields = [receiptNameInput, amountInput, dateInput, storeInput];

    function updateAmountSuffix() {
        const suffix = form.querySelector('.input-with-lock .suffix-hint');
        if (suffix && typeof window.currencySymbol === 'function') {
            suffix.textContent = window.currencySymbol(currencySelect?.value || userDefaultCurrency);
        }
    }
    currencySelect?.addEventListener('change', updateAmountSuffix);

    function updateHintText(locked) {
        if (!linkHint) return;
        const lang = getLang();
        if (locked) {
            linkHint.textContent = lang === 'ru'
                ? '🔒 Данные из товара. Изменить можно в управлении товаром.'
                : '🔒 Data from item. Edit in item management.';
            linkHint.classList.add('locked');
        } else {
            linkHint.textContent = lang === 'ru' ? 'Ручной ввод данных' : 'Manual data entry';
            linkHint.classList.remove('locked');
        }
    }

    function setFieldLock(input, locked) {
        if (!input) return;
        input.readOnly = locked;
        if (input._cdp) input._cdp.setLocked(locked);
        const group = input.closest('.input-group');
        group?.querySelector('.lock-icon')?.classList.toggle('hidden', !locked);
    }

    function setFieldsLocked(locked) {
        lockedFields.forEach(input => setFieldLock(input, locked));
        if (currencySelect) {
            currencySelect.disabled = locked;
            currencySelect.closest('.input-group')?.querySelector('.lock-icon')?.classList.toggle('hidden', !locked);
        }
        if (!locked) {
            lockIcons.forEach(icon => icon.classList.add('hidden'));
        }
        updateHintText(locked);
    }

    function fillFromItem(selected) {
        const nameVal = (selected.dataset.name || '').trim();
        const priceVal = (selected.dataset.price || '').trim();
        const dateVal = (selected.dataset.date || '').trim();
        const storeVal = (selected.dataset.store || '').trim();
        const currVal = (selected.dataset.currency || '').trim();

        receiptNameInput.value = nameVal;
        setFieldLock(receiptNameInput, Boolean(nameVal));

        amountInput.value = priceVal;
        setFieldLock(amountInput, Boolean(priceVal));

        dateInput.value = dateVal;
        if (dateInput._cdp) dateInput._cdp.syncDisplay();
        setFieldLock(dateInput, Boolean(dateVal));

        storeInput.value = storeVal;
        setFieldLock(storeInput, Boolean(storeVal));

        if (currencySelect) {
            currencySelect.value = currVal || userDefaultCurrency;
            currencySelect.disabled = Boolean(currVal);
            currencySelect.closest('.input-group')?.querySelector('.lock-icon')?.classList.toggle('hidden', !currVal);
            if (typeof CustomSelect !== 'undefined') CustomSelect.refreshAll();
            updateAmountSuffix();
        }
        updateHintText(Boolean(nameVal || priceVal || dateVal || storeVal || currVal));
    }

    function clearLockedFields() {
        lockedFields.forEach(input => { if (input && input.readOnly) input.value = ''; });
        if (currencySelect && currencySelect.disabled) {
            currencySelect.value = userDefaultCurrency;
            if (typeof CustomSelect !== 'undefined') CustomSelect.refreshAll();
            updateAmountSuffix();
        }
    }

    function open() {
        if (modal._closeTimer) {
            clearTimeout(modal._closeTimer);
            modal._closeTimer = null;
            modal.classList.remove('closing');
        }
        modal.classList.add('active');
        document.documentElement.classList.add('modal-open');
        if (dateInput) {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            dateInput.value = `${y}-${m}-${d}`;
            if (dateInput._cdp) dateInput._cdp.syncDisplay();
        }
        if (currencySelect) {
            currencySelect.value = userDefaultCurrency;
            if (typeof CustomSelect !== 'undefined') CustomSelect.refreshAll();
        }
        updateAmountSuffix();
        populateItemSelect(userId, client).catch(() => {});
    }

    let isSubmitting = false;

    function close(force = false) {
        if (isSubmitting && !force) return;
        if (modal.classList.contains('closing')) return;
        modal.classList.add('closing');
        modal._closeTimer = setTimeout(() => {
            modal._closeTimer = null;
            modal.classList.remove('active', 'closing');
            syncModalOpenClass();
            clearLockedFields();
            setFieldsLocked(false);
            form.reset();
            if (dateInput?._cdp) dateInput._cdp.syncDisplay();
            if (typeof CustomSelect !== 'undefined') CustomSelect.refreshAll();
            clearSelectedFile();
        }, 250);
    }

    attachModalA11y(modal, { mode: 'active', onClose: close });

    const modalCameraBtn = document.getElementById('modal-camera-btn');
    const modalCameraInput = document.getElementById('modal-camera-input');
    const quickCameraBtn = document.getElementById('take-photo-receipt-btn');
    const quickCameraInput = document.getElementById('quick-camera-input');
    const pickerRowEl = document.getElementById('modal-file-picker-row');
    const filesListEl = document.getElementById('modal-files-list');
    const filesCounterEl = document.getElementById('modal-files-counter');
    let selectedFiles = []; // [{ file, previewUrl }]

    function formatFileSize(bytes) {
        if (!bytes) return '';
        if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function renderSelectedFiles() {
        const count = selectedFiles.length;
        if (filesCounterEl) {
            filesCounterEl.textContent = `${count} / ${MAX_RECEIPT_ATTACHMENTS}`;
            filesCounterEl.classList.toggle('is-full', count >= MAX_RECEIPT_ATTACHMENTS);
        }
        pickerRowEl?.classList.toggle('is-limit-reached', count >= MAX_RECEIPT_ATTACHMENTS);
        miniDropZone?.classList.toggle('has-file', count > 0);

        if (fileNameDisplay) {
            const lang = getLang();
            const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
            if (count === 0) {
                fileNameDisplay.textContent = t.upload_select_hint || (lang === 'ru' ? 'Нажмите для выбора файлов (до 3)' : 'Click to select files (up to 3)');
            } else if (count >= MAX_RECEIPT_ATTACHMENTS) {
                fileNameDisplay.textContent = lang === 'ru' ? 'Прикреплено максимум (3 из 3)' : 'Maximum attached (3 of 3)';
            } else {
                fileNameDisplay.textContent = lang === 'ru'
                    ? `Прикреплено: ${count} · добавить ещё`
                    : `Attached: ${count} · add more`;
            }
        }

        if (!filesListEl) return;
        if (count === 0) {
            filesListEl.innerHTML = '';
            filesListEl.classList.add('hidden');
            return;
        }
        filesListEl.classList.remove('hidden');
        filesListEl.innerHTML = selectedFiles.map((entry, idx) => {
            const isPdf = entry.file.type === 'application/pdf';
            const thumbHtml = isPdf
                ? '<span class="receipt-photo-pdf-thumb"><i class="fa-solid fa-file-pdf"></i></span>'
                : `<img src="${escapeHtml(entry.previewUrl || '')}" alt="">`;
            return `
                <div class="receipt-photo-preview" data-file-idx="${idx}">
                    ${thumbHtml}
                    <div class="receipt-photo-preview-info">
                        <span class="receipt-photo-preview-name">${escapeHtml(entry.file.name)}</span>
                        <span class="receipt-photo-preview-meta">${escapeHtml(formatFileSize(entry.file.size))}</span>
                    </div>
                    <button type="button" class="receipt-photo-remove-btn" data-remove-file-idx="${idx}" aria-label="Remove">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>`;
        }).join('');
    }

    function clearSelectedFile() {
        selectedFiles.forEach(entry => {
            if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
        });
        selectedFiles = [];
        if (fileInput) fileInput.value = '';
        if (modalCameraInput) modalCameraInput.value = '';
        if (quickCameraInput) quickCameraInput.value = '';
        renderSelectedFiles();
    }

    async function normalizeReceiptPhoto(file) {
        if (!file || !String(file.type || '').startsWith('image/')) return file;
        const needsConvert = !['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
        const needsCompress = file.size > 2.5 * 1024 * 1024;
        if (!needsConvert && !needsCompress) return file;
        try {
            const url = URL.createObjectURL(file);
            const img = await new Promise((resolve, reject) => {
                const i = new Image();
                i.onload = () => resolve(i);
                i.onerror = reject;
                i.src = url;
            });
            URL.revokeObjectURL(url);
            const maxDim = 2000;
            let w = img.naturalWidth || img.width;
            let h = img.naturalHeight || img.height;
            if (w > maxDim || h > maxDim) {
                const scale = maxDim / Math.max(w, h);
                w = Math.round(w * scale);
                h = Math.round(h * scale);
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
            if (!blob) return file;
            const base = (file.name || 'receipt_photo').replace(/\.[^/.]+$/, '');
            return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
        } catch (_) {
            return file;
        }
    }

    async function addFiles(rawList) {
        const incoming = Array.from(rawList || []);
        if (!incoming.length) return false;
        const lang = getLang();
        const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
        let addedAny = false;

        for (const rawFile of incoming) {
            if (selectedFiles.length >= MAX_RECEIPT_ATTACHMENTS) {
                showToast(
                    t.receipt_files_limit_toast || (lang === 'ru'
                        ? 'Можно прикрепить максимум 3 файла к одному чеку'
                        : 'You can attach up to 3 files per receipt'),
                    'warning'
                );
                break;
            }
            const file = await normalizeReceiptPhoto(rawFile);
            if (!validateReceiptFile(file)) continue;
            const previewUrl = String(file.type || '').startsWith('image/')
                ? URL.createObjectURL(file)
                : '';
            selectedFiles.push({ file, previewUrl });
            addedAny = true;
        }
        renderSelectedFiles();
        return addedAny;
    }

    async function setFile(rawFile) {
        return addFiles(rawFile ? [rawFile] : []);
    }

    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    miniDropZone?.addEventListener('click', () => {
        if (selectedFiles.length < MAX_RECEIPT_ATTACHMENTS) fileInput?.click();
    });
    modalCameraBtn?.addEventListener('click', () => {
        if (selectedFiles.length < MAX_RECEIPT_ATTACHMENTS) modalCameraInput?.click();
    });
    filesListEl?.addEventListener('click', (e) => {
        const rmBtn = e.target.closest('[data-remove-file-idx]');
        if (!rmBtn) return;
        const idx = parseInt(rmBtn.dataset.removeFileIdx, 10);
        if (!isNaN(idx) && idx >= 0 && idx < selectedFiles.length) {
            const [removed] = selectedFiles.splice(idx, 1);
            if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
            renderSelectedFiles();
        }
    });

    fileInput?.addEventListener('change', async () => {
        if (fileInput.files.length > 0) {
            await addFiles(fileInput.files);
            fileInput.value = '';
        }
    });

    modalCameraInput?.addEventListener('change', async () => {
        if (modalCameraInput.files.length > 0) {
            await addFiles(modalCameraInput.files);
            modalCameraInput.value = '';
        }
    });

    quickCameraBtn?.addEventListener('click', () => quickCameraInput?.click());
    quickCameraInput?.addEventListener('change', async () => {
        if (quickCameraInput.files.length > 0) {
            const captured = quickCameraInput.files[0];
            quickCameraInput.value = '';
            open();
            await addFiles([captured]);
        }
    });

    if (linkedItemSelect) {
        linkedItemSelect.addEventListener('change', () => {
            const selected = linkedItemSelect.options[linkedItemSelect.selectedIndex];
            if (!selected || !selected.value) {
                clearLockedFields();
                setFieldsLocked(false);
                return;
            }
            fillFromItem(selected);
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (isSubmitting) return;

        const btn = form.querySelector('button[type="submit"]');
        const originalHTML = btn.innerHTML;
        const lang = getLang();

        const purchaseDateVal = form.querySelector('[name="purchase_date"]')?.value || '';
        const nowDate = new Date();
        const todayIso = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`;
        if (purchaseDateVal && purchaseDateVal > todayIso) {
            showToast(lang === 'ru' ? 'Дата покупки не может быть в будущем' : 'Purchase date cannot be in the future', 'warning');
            return;
        }

        if (selectedFiles.length === 0) {
            showToast(lang === 'ru' ? 'Прикрепите файл чека' : 'Please attach a receipt file', 'warning');
            return;
        }

        const filesToUpload = selectedFiles.slice(0, MAX_RECEIPT_ATTACHMENTS).map(e => e.file);
        for (const f of filesToUpload) {
            if (!validateReceiptFile(f)) return;
        }

        isSubmitting = true;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        const uploadedPaths = [];
        try {
            for (const f of filesToUpload) {
                const magicOk = await verifyReceiptMagicBytes(f);
                if (!magicOk) {
                    showToast(
                        lang === 'ru'
                            ? 'Содержимое файла не соответствует формату JPG, PNG, WebP или PDF.'
                            : 'File contents do not match a valid JPG, PNG, WebP, or PDF file.',
                        'error'
                    );
                    return;
                }
            }

            const preCheckItemId = form.querySelector('[name="item_id"]')?.value || null;
            if (preCheckItemId) {
                const { data: existingLink } = await client
                    .from('receipts')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('item_id', preCheckItemId)
                    .limit(1);
                if (existingLink && existingLink.length > 0) {
                    showToast(
                        lang === 'ru'
                            ? 'К этому товару уже привязан чек.'
                            : 'A receipt is already linked to this item.',
                        'warning'
                    );
                    await populateItemSelect(userId, client);
                    return;
                }
            }

            const ts = Date.now();
            const uploadedAttachments = await Promise.all(filesToUpload.map(async (file, idx) => {
                const ext = ALLOWED_RECEIPT_MIME_EXT[file.type];
                const baseName = file.name
                    .replace(/\.[^/.]+$/, '')
                    .normalize('NFKD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-zA-Z0-9_-]/g, '_')
                    .replace(/_+/g, '_')
                    .replace(/^_|_$/g, '')
                    .slice(0, 50)
                    .toLowerCase() || 'receipt';
                const filePath = `${userId}/${ts}_${idx + 1}_${baseName}.${ext}`;

                const { error: uploadError } = await client.storage
                    .from('receipts')
                    .upload(filePath, file, { upsert: false, contentType: file.type });
                if (uploadError) throw uploadError;
                uploadedPaths.push(filePath);

                const { data: signedData, error: signError } = await client.storage
                    .from('receipts')
                    .createSignedUrl(filePath, SIGNED_URL_TTL);
                if (signError) throw signError;

                return {
                    path: filePath,
                    url: signedData.signedUrl,
                    type: file.type,
                    name: file.name,
                };
            }));

            const primary = uploadedAttachments[0];
            const receiptName = form.querySelector('[name="receipt_name"]').value.trim();
            const amount = form.querySelector('[name="amount"]').value;
            const purchaseDate = form.querySelector('[name="purchase_date"]').value;
            const storeName = form.querySelector('[name="store_name"]').value.trim();
            const rawItemId = form.querySelector('[name="item_id"]').value;
            const itemId = rawItemId || null;
            const rawAmount = parseFloat(amount);
            const parsedAmount = isNaN(rawAmount) ? null : Math.max(0, rawAmount);

            const { error: dbError } = await client.from('receipts').insert({
                user_id: userId,
                item_id: itemId,
                receipt_name: receiptName,
                file_url: primary.url,
                file_path: primary.path,
                file_type: primary.type,
                attachments: uploadedAttachments.map(({ path, type, name }) => ({ path, type, name })),
                amount: parsedAmount,
                purchase_date: purchaseDate,
                store_name: storeName,
                currency: currencySelect?.value || userDefaultCurrency
            });

            if (dbError) {
                if (uploadedPaths.length > 0) {
                    await client.storage.from('receipts').remove(uploadedPaths).catch(() => { });
                }
                throw dbError;
            }

            showToast(lang === 'ru' ? 'Чек успешно загружен!' : 'Receipt uploaded successfully!', 'success');
            close(true);
            activateReceiptsTab('personal');
            await loadAllReceipts(currentUserEmail, userId, client);
            await populateItemSelect(userId, client);

        } catch (err) {
            logError('receipts:upload', err);
            showToast(
                lang === 'ru'
                    ? 'Не удалось загрузить чек. Попробуйте ещё раз.'
                    : 'Failed to upload receipt. Please try again.',
                'error'
            );
        } finally {
            isSubmitting = false;
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    });

    return { open, setFile };
}

let receiptsInitPromise = null;
let receiptsInitialized = false;

export async function ensureReceiptsLoaded() {
    if (receiptsInitialized) {
        if (typeof receiptsTabsIndicator !== 'undefined' && receiptsTabsIndicator?.update) {
            requestAnimationFrame(() => receiptsTabsIndicator.update(true));
        }
        return;
    }
    if (receiptsInitPromise) return receiptsInitPromise;
    receiptsInitPromise = initReceipts()
        .then(() => {
            receiptsInitialized = true;
        })
        .catch((e) => {
            receiptsInitPromise = null;
            logError('init:receipts', e);
            const lang = getLang();
            const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
            const msg = t.load_error || (lang === 'ru' ? 'Ошибка загрузки. Обновите страницу.' : 'Load error. Please refresh.');
            const errHtml = `<p class="empty-state error">${escapeHtml(msg)}</p>`;
            const pGrid = document.getElementById('receipts-grid-personal');
            const bGrid = document.getElementById('receipts-grid-business');
            if (pGrid) pGrid.innerHTML = errHtml;
            if (bGrid) bGrid.innerHTML = errHtml;
        });
    return receiptsInitPromise;
}

export async function highlightReceiptCard(receiptId) {
    if (!receiptId) return;
    await ensureReceiptsLoaded();
    const idStr = String(receiptId);
    const bizCard = document.querySelector(`#receipts-grid-business [data-receipt-id="${CSS.escape(idStr)}"], #receipts-grid-business [data-id="${CSS.escape(idStr)}"]`)?.closest('.receipt-card, .biz-receipt-card, .item-card');
    if (bizCard) {
        if (typeof activateReceiptsTab === 'function') activateReceiptsTab('business');
        setTimeout(() => pulseHighlight(bizCard), 120);
        return;
    }
    const persCard = document.querySelector(`#receipts-grid-personal [data-receipt-id="${CSS.escape(idStr)}"], #receipts-grid-personal [data-id="${CSS.escape(idStr)}"]`)?.closest('.receipt-card, .item-card');
    if (persCard) {
        if (typeof activateReceiptsTab === 'function') activateReceiptsTab('personal');
        setTimeout(() => pulseHighlight(persCard), 120);
    }
}

// Auto-run only if loaded on a standalone receipts page (not inside dashboard.html)
if (!document.getElementById('view-receipts')) {
    ensureReceiptsLoaded();
}