import { supabase, SUPABASE_URL } from './supabase-client.js';
import { logError } from './security.js';
import { createSegmentedIndicator } from './segmented-indicator.js';

const verifyTabsWrap = document.querySelector('.verify-tabs');
const verifyTabIndicatorEl = document.getElementById('verify-tab-indicator');
const tabs = document.querySelectorAll('.verify-tab');
const panels = {
    scan: document.getElementById('scan-panel'),
    upload: document.getElementById('upload-panel'),
};
const hashLoadingBlock = document.getElementById('hash-loading-block');
const hashLoadingLoader = document.getElementById('hash-loading-loader');
const resultBlock = document.getElementById('verify-result');
const resultBlockWrapper = document.getElementById('result-block');
const retryBtn = document.getElementById('verify-retry-btn');
const ctaBtn = document.getElementById('verify-cta-btn');
const ctaIcon = document.getElementById('verify-cta-icon');
const ctaLabel = document.getElementById('verify-cta-label');
let isUserSignedIn = false;

const refreshAuthState = async () => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        isUserSignedIn = Boolean(session);
    } catch (_) {
        isUserSignedIn = false;
    }
    return isUserSignedIn;
};

function updateVerifyCta(visible) {
    if (!ctaBtn) return;
    if (!visible) {
        ctaBtn.style.display = 'none';
        return;
    }
    if (isUserSignedIn) {
        ctaBtn.href = 'dashboard.html';
        if (ctaIcon) ctaIcon.className = 'fa-solid fa-table-columns';
        if (ctaLabel) ctaLabel.textContent = window.t('cta_open_dashboard');
    } else {
        ctaBtn.href = 'login.html?redirect=%2Fdashboard.html';
        if (ctaIcon) ctaIcon.className = 'fa-solid fa-right-to-bracket';
        if (ctaLabel) ctaLabel.textContent = window.t('cta_login_track');
    }
    ctaBtn.style.display = '';
}

refreshAuthState();
const resultIcon = document.getElementById('result-icon');
const resultTitle = document.getElementById('result-title');
const resultDesc = document.getElementById('result-desc');
const resultBadge = document.getElementById('result-badge');
const resultDetails = document.getElementById('result-details');
const resultReceiptNumber = document.getElementById('result-receipt-number');
const resultReceiptDate = document.getElementById('result-receipt-date');
const resultRegisterSerial = document.getElementById('result-register-serial');
const resultReceiptAmount = document.getElementById('result-receipt-amount');
const resultReceiptStore = document.getElementById('result-receipt-store');
const resultSellerStatus = document.getElementById('result-seller-status');
const resultItemsRow = document.getElementById('result-items-row');
const resultItemsWrap = document.getElementById('result-items-wrap');
const resultItemsList = document.getElementById('result-items-list');
const resultLifecycleDt = document.getElementById('result-lifecycle-dt');
const resultLifecycleDd = document.getElementById('result-lifecycle-dd');
const resultReasonDt = document.getElementById('result-reason-dt');
const resultReasonDd = document.getElementById('result-reason-dd');
const resultRefundedDt = document.getElementById('result-refunded-dt');
const resultRefundedDd = document.getElementById('result-refunded-dd');
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('receipt-file');
const uploadPreview = document.getElementById('upload-preview');
const previewImg = document.getElementById('preview-img');
const previewRemoveBtn = document.getElementById('preview-remove-btn');
const scanArea = document.getElementById('scan-area');
const scanFileInput = document.getElementById('scan-file-input');
const scanHint = document.getElementById('scan-hint');

let scanLoader = null;
let hashLoader = null;
let activePreviewObjectUrl = null;

function revokePreviewObjectUrl() {
    if (activePreviewObjectUrl) {
        URL.revokeObjectURL(activePreviewObjectUrl);
        activePreviewObjectUrl = null;
    }
}
window.addEventListener('pagehide', revokePreviewObjectUrl);

function setScanLoader(phrases) {
    clearScanLoader();
    if (!scanHint) return;
    scanLoader = new RotatingTextLoader(scanHint, phrases, { interval: 800 });
}

function clearScanLoader() {
    if (scanHint && scanHint._rotatingLoader) {
        scanHint._rotatingLoader.destroy();
    }
    scanLoader = null;
}

function setHashLoading(active) {
    if (active) {
        verifyTabsWrap?.classList.add('is-hidden');
        Object.values(panels).forEach(p => p?.classList.add('done'));
        resultBlockWrapper?.classList.remove('active');
    updateVerifyCta(false);
        hashLoadingBlock?.classList.add('active');
        if (hashLoadingLoader) {
            if (hashLoadingLoader._rotatingLoader) {
                hashLoadingLoader._rotatingLoader.destroy();
            }
            if (typeof RotatingTextLoader !== 'undefined') {
                hashLoader = new RotatingTextLoader(hashLoadingLoader, [
                    window.t('checking_sig'),
                    window.t('forming_result'),
                ], { interval: 900 });
            }
        }
    } else {
        if (hashLoadingLoader && hashLoadingLoader._rotatingLoader) {
            hashLoadingLoader._rotatingLoader.destroy();
        }
        hashLoader = null;
        hashLoadingBlock?.classList.remove('active');
        document.documentElement.classList.remove('verify-auto-hash');
    }
}

const savedTab = sessionStorage.getItem('verify-active-tab');
if (savedTab && savedTab !== 'scan' && panels[savedTab]) {
    tabs.forEach(t => t.classList.remove('active'));
    Object.values(panels).forEach(p => p?.classList.remove('active'));
    const tab = [...tabs].find(t => t.dataset.tab === savedTab);
    if (tab) tab.classList.add('active');
    if (panels[savedTab]) panels[savedTab].classList.add('active');
}

const verifyTabsIndicator = createSegmentedIndicator(verifyTabsWrap, verifyTabIndicatorEl, {
    itemSelector: '.verify-tab',
});

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        stopCamera();
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        verifyTabsIndicator.update();
        Object.values(panels).forEach(p => {
            p?.classList.remove('active', 'done');
        });
        const target = panels[tab.dataset.tab];
        if (target) target.classList.add('active');
        resultBlockWrapper?.classList.remove('active');
    updateVerifyCta(false);
        lastResultState = null;
        lastResultData = null;
        sessionStorage.setItem('verify-active-tab', tab.dataset.tab);
    });
});

function resetAll() {
    stopCamera();
    setHashLoading(false);
    verifyTabsWrap?.classList.remove('is-hidden');
    lastResultState = null;
    lastResultData = null;
    Object.values(panels).forEach(p => p?.classList.remove('done'));
    resultBlockWrapper?.classList.remove('active');
    updateVerifyCta(false);
    if (copyBtn) {
        copyBtn.style.display = 'none';
        copyBtn.classList.remove('copied');
        const span = copyBtn.querySelector('span');
        if (span) span.textContent = window.t('copy_btn');
    }
    const lastTab = sessionStorage.getItem('verify-active-tab') || 'scan';
    tabs.forEach(t => t.classList.remove('active'));
    Object.values(panels).forEach(p => p?.classList.remove('active'));
    const tab = [...tabs].find(t => t.dataset.tab === lastTab);
    if (tab) tab.classList.add('active');
    if (panels[lastTab]) panels[lastTab].classList.add('active');
    verifyTabsIndicator.update(true);
    uploadZone?.classList.remove('has-file');
    uploadPreview?.classList.remove('active');
    revokePreviewObjectUrl();
    previewImg?.removeAttribute('src');
    fileInput.value = '';
    scanFileInput.value = '';
    scanArea?.classList.remove('has-qr');
    const icon = scanArea?.querySelector('.scanner-content i');
    if (icon) icon.className = 'fa-solid fa-qrcode';
    if (scanHint) {
        clearScanLoader();
        scanHint.textContent = window.t('scan_hint');
    }
}

retryBtn?.addEventListener('click', resetAll);

function showLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
        if (!btn.dataset.original) btn.dataset.original = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> ' + window.t('verifying');
    } else {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.original || btn.innerHTML;
        btn.querySelectorAll('[data-i18n]').forEach((el) => {
            const key = el.getAttribute('data-i18n');
            if (key && typeof window.t === 'function') el.textContent = window.t(key);
        });
    }
}

function safeDecode(v) {
    try { return decodeURIComponent(v); } catch { return v; }
}

function extractFiscalSignature(raw) {
    if (!raw || typeof raw !== 'string') return '';
    const text = raw.trim();
    if (!text) return '';

    // 1. URL format (e.g. https://valuon.app/verify.html?sig=... or ?seg=...)
    if (text.includes('?') || text.includes('#') || text.startsWith('http://') || text.startsWith('https://')) {
        const queryMatch = text.match(/[?&](?:sig|seg|signature|hash)=([^&#]+)/i);
        if (queryMatch && queryMatch[1]) {
            return safeDecode(queryMatch[1]).trim();
        }
        const hashMatch = text.match(/#(?:[^&]*&)?(?:sig|seg|signature|hash)=([^&#]+)/i);
        if (hashMatch && hashMatch[1]) {
            return safeDecode(hashMatch[1]).trim();
        }
    }

    // 2. JSON format (e.g. {"fiscal_hash":"..."})
    if (text.startsWith('{') && text.endsWith('}')) {
        try {
            const parsed = JSON.parse(text);
            const val = parsed.fiscal_hash || parsed.sig || parsed.signature || parsed.hash;
            if (val) return String(val).trim();
        } catch (_) {}
    }

    // 3. Legacy pipe-delimited format (RECEIPT:...|SELLER:...|SIG:...)
    if (text.includes('|') && /SIG:/i.test(text)) {
        const parts = text.split('|');
        for (const part of parts) {
            const idx = part.indexOf(':');
            if (idx === -1) continue;
            const k = part.slice(0, idx).trim().toUpperCase();
            if (k === 'SIG' || k === 'SIGNATURE') {
                return safeDecode(part.slice(idx + 1)).trim();
            }
        }
    }

    // 4. Raw base64 Ed25519 signature
    if (/^[A-Za-z0-9+/=_-]{40,128}$/.test(text)) {
        return text;
    }

    return '';
}

function parseQRData(text) {
    if (!text || typeof text !== 'string') {
        return { serial: '', date: '', vat: 0, total: 0, taxId: '', shopId: '', signature: '' };
    }
    const clean = text.trim();
    const signature = extractFiscalSignature(clean);

    // Parse legacy fields for backward compatibility if present
    const map = {};
    if (clean.includes('|')) {
        const parts = clean.split('|');
        for (const part of parts) {
            const idx = part.indexOf(':');
            if (idx === -1) continue;
            map[part.slice(0, idx).trim().toUpperCase()] = part.slice(idx + 1);
        }
    }

    return {
        serial: safeDecode(map['RECEIPT'] || ''),
        date: safeDecode(map['DATE'] || ''),
        vat: parseFloat(map['TAX']) || 0,
        total: parseFloat(map['TOTAL']) || 0,
        taxId: safeDecode(map['SELLER'] || ''),
        shopId: safeDecode(map['SHOP_ID'] || ''),
        signature: signature || safeDecode(map['SIG'] || ''),
    };
}

async function decodeQRFromImage(img, maxSize = 1024) {
    const canvas = document.createElement('canvas');
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    if (w > maxSize || h > maxSize) {
        const scale = maxSize / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    if (!window.jsQR) return null;
    const code = window.jsQR(imageData.data, w, h, { inversionAttempts: 'attemptBoth' });
    return code ? code.data : null;
}

async function decodeQR(file) {
    if (file.type === 'application/pdf') {
        try {
            if (typeof pdfjsLib === 'undefined') {
                console.warn('[verify] pdfjsLib not loaded');
                return null;
            }
            const buf = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
            const maxPages = Math.min(pdf.numPages, 20);
            const pagesToScan = [];
            for (let i = pdf.numPages; i >= 1 && pagesToScan.length < maxPages; i--) {
                pagesToScan.push(i);
            }
            for (const pageNum of pagesToScan) {
                const page = await pdf.getPage(pageNum);
                const scale = 2;
                const viewport = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                await page.render({ canvasContext: ctx, viewport }).promise;
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                if (window.jsQR) {
                    const code = window.jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' });
                    if (code && code.data) return code.data;
                }
            }
            return null;
        } catch (e) {
            logError('verify:pdfDecode', e);
            return null;
        }
    }

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;

    return new Promise((resolve) => {
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(decodeQRFromImage(img));
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(null);
        };
    });
}

function normalizeLifecycleStatus(raw) {
    return raw === 'voided' || raw === 'refunded' || raw === 'partially_refunded'
        ? raw
        : 'active';
}

function formatVerifyDate(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(window.getVerifyLocale(), {
        day: 'numeric', month: 'numeric', year: 'numeric',
    });
}

function setRowVisibility(dtEl, ddEl, visible, text = '—') {
    if (dtEl) dtEl.style.display = visible ? '' : 'none';
    if (ddEl) {
        ddEl.style.display = visible ? '' : 'none';
        if (visible) ddEl.textContent = text;
    }
}

function buildViewDataFromVerified(receipt, shop) {
    const locale = window.getVerifyLocale();
    const currency = receipt.currency || 'EUR';
    const lifecycleStatus = normalizeLifecycleStatus(receipt.lifecycleStatus ?? receipt.lifecycle_status);
    const statusChangedAt = receipt.statusChangedAt ?? receipt.status_changed_at ?? null;
    const statusReason = String(receipt.statusReason ?? receipt.status_reason ?? '').trim() || null;
    const refundedNum = parseFloat(receipt.refundedAmount ?? receipt.refunded_amount ?? 0);
    const refundedAmountNum = Number.isFinite(refundedNum) && refundedNum > 0 ? refundedNum : 0;

    const dateStr = formatVerifyDate(receipt.purchaseDate) || '—';
    const statusDateStr = formatVerifyDate(statusChangedAt);
    const gross = parseFloat(receipt.grossTotal);
    const amount = Number.isFinite(gross) ? window.formatCurrency(gross, currency, locale) : '—';
    const refundedFormatted = refundedAmountNum > 0
        ? `−${window.formatCurrency(refundedAmountNum, currency, locale)}`
        : null;

    const sellerStatus = receipt.status === 'verified'
        ? window.t('seller_verified')
        : window.t('seller_pending');

    const items = Array.isArray(receipt.items) ? receipt.items : [];
    const receiptNum = receipt.receiptNumber ? `#RCP-${receipt.receiptNumber}` : null;
    const registerSerial = receipt.posSerial || receipt.pos_serial || null;
    const shopLogoUrl = shop?.logoPath
        ? `${SUPABASE_URL}/storage/v1/object/public/shop-logos/${shop.logoPath}`
        : null;

    let lifecycleLabel = null;
    if (lifecycleStatus === 'voided') {
        lifecycleLabel = window.t('lifecycle_status_voided');
    } else if (lifecycleStatus === 'refunded') {
        lifecycleLabel = window.t('lifecycle_status_refunded');
    } else if (lifecycleStatus === 'partially_refunded') {
        lifecycleLabel = window.t('lifecycle_status_partially_refunded');
    }
    if (lifecycleLabel && statusDateStr) {
        lifecycleLabel = `${lifecycleLabel} · ${statusDateStr}`;
    }

    return {
        receiptNumber: receiptNum || '—',
        items,
        date: dateStr,
        amount,
        store: shop?.shopName || '—',
        sellerStatus,
        shopLogo: shopLogoUrl,
        registerSerial,
        lifecycleStatus,
        lifecycleLabel,
        statusReason,
        refundedFormatted,
    };
}

function showResult(status, data) {
    if (!resultBlock) return;
    stopCamera();
    clearScanLoader();
    setHashLoading(false);

    Object.values(panels).forEach(p => p?.classList.add('done'));
    resultBlockWrapper?.classList.add('active');
    retryBtn && (retryBtn.style.display = '');
    copyBtn && (copyBtn.style.display = '');
    resultBlock.className = 'verify-result';

    lastResultState = { status, raw: data };

    if (status === 'success' && data && data.receipt) {
        const view = buildViewDataFromVerified(data.receipt, data.shop);
        lastResultData = view;

        const lc = view.lifecycleStatus;
        if (lc === 'voided') {
            resultBlock.classList.add('voided');
            resultIcon.className = 'fa-solid fa-ban';
            resultTitle.textContent = window.t('result_voided_title');
            resultDesc.textContent = window.t('result_voided_desc');
            resultBadge.className = 'verify-badge voided';
            resultBadge.textContent = window.t('result_voided_badge');
        } else if (lc === 'refunded') {
            resultBlock.classList.add('refunded');
            resultIcon.className = 'fa-solid fa-rotate-left';
            resultTitle.textContent = window.t('result_refunded_title');
            resultDesc.textContent = window.t('result_refunded_desc');
            resultBadge.className = 'verify-badge refunded';
            resultBadge.textContent = window.t('result_refunded_badge');
        } else if (lc === 'partially_refunded') {
            resultBlock.classList.add('partial');
            resultIcon.className = 'fa-solid fa-rotate-left';
            resultTitle.textContent = window.t('result_partial_title');
            resultDesc.textContent = window.t('result_partial_desc');
            resultBadge.className = 'verify-badge partial';
            resultBadge.textContent = window.t('result_partial_badge');
        } else {
            resultBlock.classList.add('success');
            resultIcon.className = 'fa-solid fa-circle-check';
            resultTitle.textContent = window.t('result_success_title');
            resultDesc.textContent = window.t('result_success_desc');
            resultBadge.className = 'verify-badge verified';
            resultBadge.textContent = window.t('result_success_badge');
        }

        if (resultDetails) resultDetails.style.display = 'block';
        setRowVisibility(resultLifecycleDt, resultLifecycleDd, lc !== 'active' && !!view.lifecycleLabel, view.lifecycleLabel || '—');
        setRowVisibility(resultReasonDt, resultReasonDd, lc !== 'active' && !!view.statusReason, view.statusReason || '—');
        setRowVisibility(
            resultRefundedDt,
            resultRefundedDd,
            (lc === 'partially_refunded' || lc === 'refunded') && !!view.refundedFormatted,
            view.refundedFormatted || '—'
        );

        resultReceiptNumber.textContent = view.receiptNumber || '—';
        resultReceiptDate.textContent = view.date || '—';
        if (resultRegisterSerial) resultRegisterSerial.textContent = view.registerSerial || '—';
        resultReceiptAmount.textContent = view.amount || '—';
        resultReceiptAmount.classList.toggle('amount-struck', lc === 'voided' || lc === 'refunded');

        const storeSpan = resultReceiptStore.querySelector('span');
        if (storeSpan) storeSpan.textContent = view.store || '—';
        resultSellerStatus.textContent = view.sellerStatus || '—';

        // Shop logo
        const logoImg = document.getElementById('result-shop-logo');
        if (logoImg && view.shopLogo) {
            logoImg.onerror = () => { logoImg.style.display = 'none'; };
            logoImg.src = view.shopLogo;
            logoImg.style.display = 'inline-block';
        } else if (logoImg) {
            logoImg.style.display = 'none';
        }

        const lineItems = Array.isArray(view.items) ? view.items : [];
        if (resultItemsList && resultItemsRow && resultItemsWrap) {
            resultItemsList.innerHTML = '';
            if (lineItems.length > 0) {
                lineItems.forEach(it => {
                    const qty = Math.max(1, parseInt(it.qty, 10) || 1);
                    const refundedQty = Math.max(0, parseInt(it.refunded_qty, 10) || 0);
                    const isItemVoided = lc === 'voided';
                    const isItemFullyReturned = lc === 'refunded' || refundedQty >= qty;
                    const isItemPartiallyReturned = !isItemVoided && !isItemFullyReturned && refundedQty > 0;
                    const isStruck = isItemVoided || isItemFullyReturned;

                    const li = document.createElement('li');
                    li.className = 'verify-item-li' + (isStruck ? ' is-struck' : '');

                    const mainRow = document.createElement('div');
                    mainRow.className = 'verify-item-main';

                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'verify-item-name';
                    nameSpan.textContent = `${it.item_name || '—'} × ${qty}`;
                    mainRow.appendChild(nameSpan);

                    if (isItemVoided) {
                        const pill = document.createElement('span');
                        pill.className = 'verify-item-pill is-void';
                        pill.textContent = window.t('item_status_voided');
                        mainRow.appendChild(pill);
                    } else if (isItemFullyReturned) {
                        const pill = document.createElement('span');
                        pill.className = 'verify-item-pill is-refunded';
                        pill.textContent = window.t('item_status_returned');
                        mainRow.appendChild(pill);
                    } else if (isItemPartiallyReturned) {
                        const pill = document.createElement('span');
                        pill.className = 'verify-item-pill is-partial';
                        pill.textContent = window.t('item_status_partial').replace('{n}', String(refundedQty));
                        mainRow.appendChild(pill);
                    }

                    li.appendChild(mainRow);

                    if (it.warranty_months) {
                        const wSpan = document.createElement('span');
                        wSpan.className = 'verify-item-warranty' + (isStruck ? ' is-void' : '');
                        wSpan.textContent = isStruck
                            ? `${it.warranty_months} ${window.t('items_warranty_suffix')} · ${window.t('item_warranty_void')}`
                            : `${it.warranty_months} ${window.t('items_warranty_suffix')}`;
                        li.appendChild(wSpan);
                    }

                    resultItemsList.appendChild(li);
                });
                resultItemsRow.style.display = '';
                resultItemsWrap.style.display = '';
            } else {
                resultItemsRow.style.display = 'none';
                resultItemsWrap.style.display = 'none';
            }
        }
    } else {
        lastResultData = null;
        resultBlock.classList.add('failure');
        resultIcon.className = 'fa-solid fa-circle-xmark';
        resultBadge.className = 'verify-badge invalid';

        if (status === 'not-found') {
            resultTitle.textContent = window.t('result_not_found_title');
            resultDesc.textContent = window.t('result_not_found_desc');
            resultBadge.textContent = window.t('result_not_found_badge');
        } else if (status === 'invalid') {
            resultTitle.textContent = window.t('result_invalid_title');
            resultDesc.textContent = window.t('result_invalid_desc');
            resultBadge.textContent = window.t('result_invalid_badge');
        } else if (status === 'no-qr') {
            resultTitle.textContent = window.t('result_no_qr_title');
            resultDesc.textContent = (typeof data === 'string' && data) || window.t('result_no_qr_desc');
            resultBadge.textContent = window.t('result_error_badge');
        } else {
            resultTitle.textContent = window.t('result_error_title');
            resultDesc.textContent = (typeof data === 'string' && data) || window.t('result_error_desc');
            resultBadge.textContent = window.t('result_error_badge');
        }
        if (resultDetails) resultDetails.style.display = 'none';
    }
    if (status !== 'success') {
        copyBtn && (copyBtn.style.display = 'none');
        updateVerifyCta(false);
    } else {
        updateVerifyCta(true);
        refreshAuthState().then(() => {
            if (lastResultState?.status === 'success' && resultBlockWrapper?.classList.contains('active')) {
                updateVerifyCta(true);
            }
        });
    }
}

async function verifyReceiptFromQRData(qrRaw) {
    if (verifying) return;
    try {
        const parsed = parseQRData(qrRaw);

        if (!parsed.signature) {
            showResult('invalid');
            return;
        }

        // Delegate to unified verifyReceiptByHash, which manages loading states,
        // performs the verification request and renders the result.
        await verifyReceiptByHash(parsed.signature);
    } catch (err) {
        logError('verify:unexpected', err);
        showResult('error', window.t('internal_error'));
    }
}

let mediaStream = null;
let scanInterval = null;
let verifying = false;
let lastResultData = null;
let lastResultState = null;
const video = document.getElementById('scanner-video');
const canvas = document.getElementById('scanner-canvas');
const qrOverlay = document.getElementById('qr-overlay');
const qrOverlayCtx = qrOverlay?.getContext('2d');
const scanBtn = document.getElementById('verify-scan-btn');
const copyBtn = document.getElementById('verify-copy-btn');

async function startCamera() {
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 640 } }
        });
        video.srcObject = mediaStream;
        await video.play();
        scanArea?.classList.add('active');
        scanBtn.innerHTML = '<i class="fa-solid fa-stop"></i> ' + window.t('scan_btn_stop');
        scanBtn.classList.remove('btn-primary');
        scanBtn.classList.add('btn-outline');
        resultBlockWrapper?.classList.remove('active');
    updateVerifyCta(false);
        startScanLoop();
    } catch (err) {
        logError('verify:camera', err);
        const isEn = ((window.getValuonLang ? window.getValuonLang() : 'en')) === 'en';
        window.showToast?.(
            isEn ? 'Camera unavailable — choose a photo instead' : 'Камера недоступна — выберите фото чека',
            'warning'
        );
        scanFileInput?.click();
    }
}


function stopCamera() {
    if (scanInterval) {
        clearInterval(scanInterval);
        scanInterval = null;
    }
    if (qrOverlayCtx) qrOverlayCtx.clearRect(0, 0, qrOverlay.width, qrOverlay.height);
    if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
    }
    video.srcObject = null;
    scanArea?.classList.remove('active');
    scanBtn.innerHTML = '<i class="fa-solid fa-camera"></i> ' + window.t('scan_btn_open');
    scanBtn.classList.remove('btn-outline');
    scanBtn.classList.add('btn-primary');
}

function startScanLoop() {
    if (!mediaStream) return;
    if (!window.jsQR) {
        console.warn('[verify] jsQR not loaded, cannot start scan loop');
        stopCamera();
        const isEn = ((window.getValuonLang ? window.getValuonLang() : 'en')) === 'en';
        window.showToast?.(
            isEn ? 'QR scanner failed to load. Please refresh the page.' : 'Сканер QR не загрузился. Обновите страницу.',
            'error'
        );
        return;
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    scanInterval = setInterval(() => {
        if (!mediaStream || video.readyState < 2 || document.hidden) {
            if (!mediaStream) {
                clearInterval(scanInterval);
                scanInterval = null;
            }
            return;
        }

        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) return;

        const maxSize = 480;
        let sw = w;
        let sh = h;
        if (sw > maxSize || sh > maxSize) {
            const scale = maxSize / Math.max(sw, sh);
            sw = Math.round(sw * scale);
            sh = Math.round(sh * scale);
        }

        canvas.width = sw;
        canvas.height = sh;
        ctx.drawImage(video, 0, 0, sw, sh);
        const imageData = ctx.getImageData(0, 0, sw, sh);
        const code = window.jsQR(imageData.data, sw, sh, { inversionAttempts: 'attemptBoth' });

        if (code) {
            clearInterval(scanInterval);
            scanInterval = null;

            if (qrOverlayCtx) {
                qrOverlay.width = sw;
                qrOverlay.height = sh;
                const loc = code.location;
                qrOverlayCtx.fillStyle = 'rgba(16, 185, 129, 0.12)';
                qrOverlayCtx.strokeStyle = '#10b981';
                qrOverlayCtx.lineWidth = 3;
                qrOverlayCtx.setLineDash([6, 4]);
                qrOverlayCtx.beginPath();
                qrOverlayCtx.moveTo(loc.topLeftCorner.x, loc.topLeftCorner.y);
                qrOverlayCtx.lineTo(loc.topRightCorner.x, loc.topRightCorner.y);
                qrOverlayCtx.lineTo(loc.bottomRightCorner.x, loc.bottomRightCorner.y);
                qrOverlayCtx.lineTo(loc.bottomLeftCorner.x, loc.bottomLeftCorner.y);
                qrOverlayCtx.closePath();
                qrOverlayCtx.fill();
                qrOverlayCtx.stroke();

                qrOverlayCtx.setLineDash([]);
                qrOverlayCtx.fillStyle = '#10b981';
                [
                    loc.topLeftCorner, loc.topRightCorner,
                    loc.bottomRightCorner, loc.bottomLeftCorner
                ].forEach(p => {
                    qrOverlayCtx.beginPath();
                    qrOverlayCtx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                    qrOverlayCtx.fill();
                });
            }

            navigator.vibrate?.(100);

            if (scanHint) setScanLoader([
                window.t('scanning'),
                window.t('checking_sig'),
                window.t('forming_result')
            ]);

            setTimeout(() => {
                stopCamera();
                verifyReceiptFromQRData(code.data).catch(err => {
                    logError('verify:scanLoop', err);
                });
            }, 350);
        }
    }, 250);
}

scanArea?.addEventListener('click', () => {
    if (!mediaStream && !resultBlockWrapper?.classList.contains('active')) {
        startCamera();
    }
});

uploadZone?.addEventListener('click', () => {
    if (!uploadZone.classList.contains('has-file')) {
        fileInput?.click();
    }
});

if (uploadZone) {
    let dragCounter = 0;

    uploadZone.addEventListener('dragenter', () => {
        dragCounter++;
    });

    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadZone.classList.add('drag-over');
    });

    uploadZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter = Math.max(0, dragCounter - 1);
        if (dragCounter === 0) {
            uploadZone.classList.remove('drag-over');
        }
    });

    uploadZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadZone.classList.remove('drag-over');
        dragCounter = 0;

        const files = e.dataTransfer?.files;
        if (!files?.length) return;

        const file = files[0];
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            window.showToast(window.t('file_type_not_supported') || 'Unsupported file type. Please upload an image or PDF.', 'error');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            window.showToast(window.t('file_too_big'), 'error');
            return;
        }

        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change'));
    });
}

previewRemoveBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.value = '';
    uploadPreview?.classList.remove('active');
    revokePreviewObjectUrl();
    previewImg.removeAttribute('src');
    uploadZone?.classList.remove('has-file');
});

function updatePreviewRemoveLabel() {
    if (!previewRemoveBtn) return;
    previewRemoveBtn.setAttribute('aria-label', window.t('preview_remove'));
    previewRemoveBtn.setAttribute('title', window.t('preview_remove'));
}
updatePreviewRemoveLabel();

scanBtn?.addEventListener('click', () => {
    if (mediaStream) {
        stopCamera();
    } else if (!resultBlockWrapper?.classList.contains('active')) {
        startCamera();
    }
});

copyBtn?.addEventListener('click', async () => {
    if (!lastResultData) return;
    const lines = [
        window.t('detail_receipt_number') + ': ' + lastResultData.receiptNumber,
    ];
    if (lastResultData.lifecycleStatus !== 'active' && lastResultData.lifecycleLabel) {
        lines.push(window.t('detail_lifecycle_status') + ': ' + lastResultData.lifecycleLabel);
    }
    if (lastResultData.lifecycleStatus !== 'active' && lastResultData.statusReason) {
        lines.push(window.t('detail_reason') + ': ' + lastResultData.statusReason);
    }
    if (lastResultData.registerSerial) {
        lines.push(window.t('detail_register') + ': ' + lastResultData.registerSerial);
    }
    lines.push(
        window.t('detail_date') + ': ' + lastResultData.date,
        window.t('detail_amount') + ': ' + lastResultData.amount
    );
    if (lastResultData.refundedFormatted && (lastResultData.lifecycleStatus === 'partially_refunded' || lastResultData.lifecycleStatus === 'refunded')) {
        lines.push(window.t('detail_refunded') + ': ' + lastResultData.refundedFormatted);
    }
    lines.push(
        window.t('detail_store') + ': ' + lastResultData.store,
        window.t('detail_status') + ': ' + lastResultData.sellerStatus
    );
    if (Array.isArray(lastResultData.items) && lastResultData.items.length > 0) {
        const warrantySuffix = window.t('items_warranty_suffix');
        lines.push(window.t('detail_items') + ':');
        lastResultData.items.forEach((it) => {
            const name = it.name || it.item_name || '—';
            const qty = Math.max(1, parseInt(it.qty, 10) || 1);
            const w = parseInt(it.warrantyMonths ?? it.warranty_months, 10) || 0;
            const parts = [`- ${name}`, qty > 1 ? `×${qty}` : null, w > 0 ? `(${w} ${warrantySuffix})` : null].filter(Boolean);
            lines.push(parts.join(' '));
        });
    }
    const text = lines.join('\n');
    try {
        await navigator.clipboard.writeText(text);
        const span = copyBtn.querySelector('span') || copyBtn;
        const original = span.textContent;
        span.textContent = window.t('copied');
        copyBtn.classList.add('copied');
        setTimeout(() => {
            span.textContent = original;
            copyBtn.classList.remove('copied');
        }, 2000);
    } catch (err) {
        logError('verify:copy', err);
    }
});

scanFileInput?.addEventListener('change', async () => {
    const file = scanFileInput.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
        window.showToast(window.t('file_too_big'), 'error');
        scanFileInput.value = '';
        return;
    }

    scanArea?.classList.add('has-qr');
    const icon = scanArea?.querySelector('.scanner-content i');
    if (icon) icon.className = 'fa-solid fa-spinner fa-spin';
    if (scanHint) setScanLoader([
        window.t('decoding'),
        window.t('scanning'),
        window.t('checking_sig'),
        window.t('forming_result')
    ]);

    try {
        const qrData = await decodeQR(file);

        if (!qrData) {
            if (icon) icon.className = 'fa-solid fa-circle-xmark';
            if (scanHint) {
                clearScanLoader();
                scanHint.textContent = window.t('qr_not_found_text');
            }
            showResult('no-qr');
            return;
        }

        if (icon) icon.className = 'fa-solid fa-check-circle';
        if (scanHint) setScanLoader([
            window.t('scanning'),
            window.t('checking_sig'),
            window.t('forming_result')
        ]);
        navigator.vibrate?.(100);
        await verifyReceiptFromQRData(qrData);
    } catch (err) {
        logError('verify:scan', err);
        showResult('error', window.t('scan_error'));
    } finally {
        if (scanFileInput) scanFileInput.value = '';
    }
});

fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const isAllowedType = file.type === 'application/pdf' || file.type.startsWith('image/');
    if (!isAllowedType) {
        window.showToast(window.t('file_type_not_supported'), 'error');
        fileInput.value = '';
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        window.showToast(window.t('file_too_big'), 'error');
        fileInput.value = '';
        return;
    }

    if (file.type === 'application/pdf' && typeof pdfjsLib === 'undefined') {
        console.warn('[verify] pdfjsLib not loaded, cannot preview PDF');
        const isEn = ((window.getValuonLang ? window.getValuonLang() : 'en')) === 'en';
        window.showToast(
            isEn ? 'PDF library failed to load. Please refresh the page.' : 'Не удалось загрузить обработчик PDF. Обновите страницу.',
            'error'
        );
        fileInput.value = '';
        return;
    }

    uploadZone?.classList.add('has-file');

    revokePreviewObjectUrl();

    if (file.type === 'application/pdf') {
        try {
            const buf = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
            const page = await pdf.getPage(1);
            const vp = page.getViewport({ scale: 1.5 });
            const c = document.createElement('canvas');
            c.width = vp.width;
            c.height = vp.height;
            const ctx = c.getContext('2d');
            await page.render({ canvasContext: ctx, viewport: vp }).promise;
            previewImg.src = c.toDataURL();
        } catch (e) {
            logError('verify:pdfPreview', e);
            previewImg.removeAttribute('src');
        }
    } else {
        activePreviewObjectUrl = URL.createObjectURL(file);
        previewImg.src = activePreviewObjectUrl;
    }

    uploadPreview?.classList.add('active');
});

document.getElementById('verify-upload-btn')?.addEventListener('click', async () => {
    const file = fileInput?.files?.[0];
    if (!file) {
        fileInput?.click();
        return;
    }

    const btn = document.getElementById('verify-upload-btn');
    showLoading(btn, true);

    try {
        const qrData = await decodeQR(file);

        if (!qrData) {
            showResult('no-qr');
            return;
        }

        await verifyReceiptFromQRData(qrData);
    } catch (err) {
        logError('verify:upload', err);
        showResult('error', window.t('file_error'));
    } finally {
        showLoading(btn, false);
    }
});

window.addEventListener('verify-lang-changed', () => {
    window.applyVerifyTranslations();
    updatePreviewRemoveLabel();
    verifyTabsIndicator.update(true);
    if (hashLoadingBlock?.classList.contains('active') && hashLoadingLoader && typeof RotatingTextLoader !== 'undefined') {
        if (hashLoadingLoader._rotatingLoader) hashLoadingLoader._rotatingLoader.destroy();
        hashLoader = new RotatingTextLoader(hashLoadingLoader, [
            window.t('checking_sig'),
            window.t('forming_result'),
        ], { interval: 900 });
    }
    if (scanBtn) {
        scanBtn.innerHTML = mediaStream
            ? '<i class="fa-solid fa-stop"></i> ' + window.t('scan_btn_stop')
            : '<i class="fa-solid fa-camera"></i> ' + window.t('scan_btn_open');
    }
    if (lastResultState && resultBlockWrapper?.classList.contains('active')) {
        showResult(lastResultState.status, lastResultState.raw);
    }
    if (copyBtn && lastResultData) {
        copyBtn.style.display = '';
        const span = copyBtn.querySelector('span');
        if (span) span.textContent = window.t('copy_btn');
    }
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopCamera();
});

const backBtn = document.getElementById('verify-back-btn');
if (backBtn) {
    const allowedRoots = new Set(['/dashboard', '/business', '/receipts', '/index', '/']);
    const resolveSafeBackPath = (rawUrl) => {
        try {
            const parsed = new URL(rawUrl, window.location.origin);
            if (parsed.origin !== window.location.origin) return null;
            const trimmed = parsed.pathname.replace(/\/+$/, '') || '/';
            const canonical = trimmed === '/' ? '/' : trimmed.replace(/\.html$/i, '');
            if (!allowedRoots.has(canonical)) return null;
            return trimmed === '/' ? 'index.html' : trimmed;
        } catch (_) {
            return null;
        }
    };

    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get('from');
    const safePath = fromParam
        ? resolveSafeBackPath(fromParam)
        : (document.referrer ? resolveSafeBackPath(document.referrer) : null);

    if (safePath) {
        backBtn.href = safePath;
    }
}

// Auto-verify receipt when opened via quick action link (#sig=<fiscal_hash>)
async function verifyReceiptByHash(fiscalHash) {
    if (!fiscalHash || verifying) return;
    verifying = true;
    setHashLoading(true);
    try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/verify-receipt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fiscal_hash: fiscalHash }),
        });
        if (!resp.ok) {
            const errData = await resp.json().catch(() => null);
            if (errData?.error === 'not_found') {
                showResult('not-found');
                return;
            }
            if (errData?.error === 'rate_limited') {
                showResult('error', window.t('rate_limited'));
                return;
            }
            if (errData?.error === 'shop_key_missing') {
                showResult('error', window.t('shop_not_found'));
                return;
            }
            showResult('error', window.t('rpc_error') + ': HTTP ' + resp.status);
            return;
        }
        const data = await resp.json();
        if (data?.error === 'not_found') {
            showResult('not-found');
            return;
        }
        if (data?.error === 'rate_limited') {
            showResult('error', window.t('rate_limited'));
            return;
        }
        if (data?.error === 'shop_key_missing') {
            showResult('error', window.t('shop_not_found'));
            return;
        }
        if (!data?.valid) {
            showResult('invalid');
            return;
        }
        showResult('success', {
            receipt: data.receipt,
            shop: data.shop || {},
        });
    } catch (err) {
        logError('verify:autoHash', err);
        showResult('error', window.t('internal_error'));
    } finally {
        setHashLoading(false);
        verifying = false;
    }
}

(() => {
    const rawSearch = window.location.search || '';
    const queryMatch = rawSearch.match(/[?&](?:sig|seg|signature|hash)=([^&#]+)/i);
    const querySig = queryMatch ? safeDecode(queryMatch[1]).trim() : null;

    const rawHash = window.location.hash || '';
    const hashMatch = rawHash.match(/#(?:[^&]*&)?(?:sig|seg|signature|hash)=([^&#]+)/i);
    const hashSig = hashMatch ? safeDecode(hashMatch[1]).trim() : null;

    const sig = querySig || hashSig;

    if (!sig) {
        document.documentElement.classList.remove('verify-auto-hash');
        return;
    }
    try {
        const cleanParams = new URLSearchParams(window.location.search);
        ['sig', 'seg', 'signature', 'hash'].forEach((k) => cleanParams.delete(k));
        const nextSearch = cleanParams.toString();
        const nextUrl = window.location.pathname + (nextSearch ? `?${nextSearch}` : '');
        window.history.replaceState(null, '', nextUrl);
    } catch (_) { /* ignore */ }
    verifyReceiptByHash(sig);
})();