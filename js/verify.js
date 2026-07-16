import ReceiptVerifier from './crypto-verification.js';
import Ed25519Signer from './crypto-signature.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { t, getVerifyLocale, applyVerifyTranslations, initVerifyLang } from './verify-lang.js';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL)
    || 'https://qjnzawjivqvgupbgxdao.supabase.co';
const supabaseKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY)
    || 'sb_publishable_AwSiUBE-lYKiQAvA_T5ryw_2r_JOOH8';
const supabase = createClient(supabaseUrl, supabaseKey);

const tabs = document.querySelectorAll('.verify-tab');
const panels = {
    scan: document.getElementById('scan-panel'),
    upload: document.getElementById('upload-panel'),
};
const resultBlock = document.getElementById('verify-result');
const resultBlockWrapper = document.getElementById('result-block');
const retryBtn = document.getElementById('verify-retry-btn');
const resultIcon = document.getElementById('result-icon');
const resultTitle = document.getElementById('result-title');
const resultDesc = document.getElementById('result-desc');
const resultBadge = document.getElementById('result-badge');
const resultDetails = document.getElementById('result-details');
const resultReceiptNumber = document.getElementById('result-receipt-number');
const resultReceiptDate = document.getElementById('result-receipt-date');
const resultReceiptAmount = document.getElementById('result-receipt-amount');
const resultReceiptStore = document.getElementById('result-receipt-store');
const resultSellerStatus = document.getElementById('result-seller-status');
const resultItemsRow = document.getElementById('result-items-row');
const resultItemsWrap = document.getElementById('result-items-wrap');
const resultItemsList = document.getElementById('result-items-list');
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('receipt-file');
const uploadPreview = document.getElementById('upload-preview');
const previewImg = document.getElementById('preview-img');
const scanArea = document.getElementById('scan-area');
const scanFileInput = document.getElementById('scan-file-input');
const scanHint = document.getElementById('scan-hint');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        stopCamera();
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        Object.values(panels).forEach(p => {
            p?.classList.remove('active', 'done');
        });
        const target = panels[tab.dataset.tab];
        if (target) target.classList.add('active');
        resultBlockWrapper?.classList.remove('active');
        sessionStorage.setItem('verify-active-tab', tab.dataset.tab);
    });
});

const savedTab = sessionStorage.getItem('verify-active-tab');
if (savedTab && savedTab !== 'scan' && panels[savedTab]) {
    tabs.forEach(t => t.classList.remove('active'));
    Object.values(panels).forEach(p => p?.classList.remove('active'));
    const tab = [...tabs].find(t => t.dataset.tab === savedTab);
    if (tab) tab.classList.add('active');
    if (panels[savedTab]) panels[savedTab].classList.add('active');
}

function resetAll() {
    stopCamera();
    Object.values(panels).forEach(p => p?.classList.remove('done'));
    resultBlockWrapper?.classList.remove('active');
    if (copyBtn) {
        copyBtn.style.display = 'none';
        copyBtn.classList.remove('copied');
        const span = copyBtn.querySelector('span');
        if (span) span.textContent = t('copy_btn');
    }
    const lastTab = sessionStorage.getItem('verify-active-tab') || 'scan';
    tabs.forEach(t => t.classList.remove('active'));
    Object.values(panels).forEach(p => p?.classList.remove('active'));
    const tab = [...tabs].find(t => t.dataset.tab === lastTab);
    if (tab) tab.classList.add('active');
    if (panels[lastTab]) panels[lastTab].classList.add('active');
    uploadZone?.classList.remove('has-file');
    uploadPreview?.classList.remove('active');
    fileInput.value = '';
    scanFileInput.value = '';
    scanArea?.classList.remove('has-qr');
    const icon = scanArea?.querySelector('.scanner-content i');
    if (icon) icon.className = 'fa-solid fa-qrcode';
    if (scanHint) scanHint.textContent = t('scan_hint');
}

retryBtn?.addEventListener('click', resetAll);

function showLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
        if (!btn.dataset.original) btn.dataset.original = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> ' + t('verifying');
    } else {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.original || btn.innerHTML;
    }
}

function safeDecode(v) {
    try { return decodeURIComponent(v); } catch { return v; }
}

function parseQRData(text) {
    const parts = text.split('|');
    const map = {};
    for (const part of parts) {
        const idx = part.indexOf(':');
        if (idx === -1) continue;
        map[part.slice(0, idx)] = part.slice(idx + 1);
    }
    return {
        serial: safeDecode(map['RECEIPT'] || ''),
        date: safeDecode(map['DATE'] || ''),
        vat: parseFloat(map['TAX']) || 0,
        total: parseFloat(map['TOTAL']) || 0,
        taxId: safeDecode(map['SELLER'] || ''),
        shopId: safeDecode(map['SHOP_ID'] || ''),
        signature: safeDecode(map['SIG'] || ''),
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
    const code = window.jsQR(imageData.data, w, h, { inversionAttempts: 'dontInvert' });
    return code ? code.data : null;
}

async function decodeQR(file) {
    if (file.type === 'application/pdf') {
        try {
            const buf = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
            const page = await pdf.getPage(1);
            const scale = 2;
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            await page.render({ canvasContext: ctx, viewport }).promise;
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = window.jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
            return code ? code.data : null;
        } catch (e) {
            console.error('[verify] PDF decode error:', e);
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

function showResult(status, data) {
    if (!resultBlock) return;
    stopCamera();

    Object.values(panels).forEach(p => p?.classList.add('done'));
    resultBlockWrapper?.classList.add('active');
    retryBtn && (retryBtn.style.display = '');
    copyBtn && (copyBtn.style.display = '');
    resultBlock.className = 'verify-result';

    lastResultData = status === 'success' ? data : null;

    if (status === 'success') {
        resultBlock.classList.add('success');
        resultBlock.classList.remove('failure');
        resultIcon.className = 'fa-solid fa-circle-check';
        resultTitle.textContent = t('result_success_title');
        resultDesc.textContent = t('result_success_desc');
        resultBadge.className = 'verify-badge verified';
        resultBadge.textContent = t('result_success_badge');

        if (data) {
            if (resultDetails) resultDetails.style.display = 'block';
            resultReceiptNumber.textContent = data.receiptNumber || '—';
            resultReceiptDate.textContent = data.date || '—';
            resultReceiptAmount.textContent = data.amount || '—';
            resultReceiptStore.textContent = data.store || '—';
            resultSellerStatus.textContent = data.sellerStatus || '—';

            const lineItems = Array.isArray(data.items) ? data.items : [];
            if (resultItemsList && resultItemsRow && resultItemsWrap) {
                resultItemsList.innerHTML = '';
                if (lineItems.length > 0) {
                    lineItems.forEach(it => {
                        const li = document.createElement('li');
                        const qty = it.qty ?? 1;
                        let text = `${it.item_name} × ${qty}`;
                        if (it.warranty_months) {
                            text += ` — ${it.warranty_months} ${t('items_warranty_suffix')}`;
                        }
                        li.textContent = text;
                        resultItemsList.appendChild(li);
                    });
                    resultItemsRow.style.display = '';
                    resultItemsWrap.style.display = '';
                }
            }
        } else {
            if (resultDetails) resultDetails.style.display = 'none';
            if (resultItemsRow) resultItemsRow.style.display = 'none';
            if (resultItemsWrap) resultItemsWrap.style.display = 'none';
        }
    } else {
        resultBlock.classList.add('failure');
        resultBlock.classList.remove('success');
        resultIcon.className = 'fa-solid fa-circle-xmark';
        resultBadge.className = 'verify-badge invalid';

        if (status === 'not-found') {
            resultTitle.textContent = t('result_not_found_title');
            resultDesc.textContent = t('result_not_found_desc');
            resultBadge.textContent = t('result_not_found_badge');
        } else if (status === 'invalid') {
            resultTitle.textContent = t('result_invalid_title');
            resultDesc.textContent = t('result_invalid_desc');
            resultBadge.textContent = t('result_invalid_badge');
        } else if (status === 'no-qr') {
            resultTitle.textContent = t('result_no_qr_title');
            resultDesc.textContent = data || t('result_no_qr_desc');
            resultBadge.textContent = t('result_error_badge');
        } else if (status === 'error') {
            resultTitle.textContent = t('result_error_title');
            resultDesc.textContent = data || t('result_error_desc');
            resultBadge.textContent = t('result_error_badge');
        } else {
            resultTitle.textContent = t('result_error_title');
            resultDesc.textContent = data || t('result_error_desc');
            resultBadge.textContent = t('result_error_badge');
        }
        if (resultDetails) resultDetails.style.display = 'none';
    }
    if (status !== 'success') {
        copyBtn && (copyBtn.style.display = 'none');
    }
}

async function verifyReceiptFromQRData(qrRaw) {
    if (verifying) return;
    verifying = true;
    try {
        const parsed = parseQRData(qrRaw);

        if (!parsed.signature || !parsed.taxId) {
            showResult('invalid');
            return;
        }

        const { data, error } = await supabase
            .rpc('verify_get_receipt', { p_fiscal_hash: parsed.signature })
            .maybeSingle();

        if (error) {
            showResult('error', t('rpc_error') + ': ' + error.message);
            return;
        }

        if (!data?.found) {
            showResult('not-found');
            return;
        }

        const receipt = data.receipt;
        const shop = data.shop;

        if (!shop) {
            showResult('error', t('shop_not_found') || 'Магазин не найден');
            return;
        }

        if (!Ed25519Signer.isSupported()) {
            console.error('[verify] Ed25519 not supported in this browser');
            showResult('error', t('crypto_error'));
            return;
        }

        const verifier = new ReceiptVerifier();
        const result = await verifier.verifyReceipt(receipt, shop);

        if (result.valid) {
            const dateStr = receipt.purchase_date
                ? new Date(receipt.purchase_date).toLocaleDateString(getVerifyLocale(), {
                    day: 'numeric', month: 'numeric', year: 'numeric'
                })
                : '—';
            const gross = parseFloat(receipt.gross_total);
            const amount = Number.isFinite(gross) ? '$' + gross.toFixed(2) : '—';
            const sellerStatus = receipt.status === 'verified'
                ? t('seller_verified')
                : t('seller_pending');

            const items = Array.isArray(receipt.items) ? receipt.items : [];
            const receiptNum = receipt.receipt_number ? `#RCP-${receipt.receipt_number}` : null;

            showResult('success', {
                receiptNumber: receiptNum || '—',
                items,
                date: dateStr,
                amount,
                store: shop.shop_name || '—',
                sellerStatus,
            });
        } else {
            console.error('[verify] Signature invalid:', result.error || 'no error detail');
            showResult('invalid');
        }
    } catch (err) {
        console.error('[verify] Unexpected error:', err);
        showResult('error', t('internal_error'));
    } finally {
        verifying = false;
    }
}

let mediaStream = null;
let scanInterval = null;
let verifying = false;
let lastResultData = null;
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
        scanBtn.innerHTML = '<i class="fa-solid fa-stop"></i> ' + t('scan_btn_stop');
        scanBtn.classList.remove('btn-primary');
        scanBtn.classList.add('btn-outline');
        resultBlockWrapper?.classList.remove('active');
        startScanLoop();
    } catch (err) {
        console.error('[verify] camera error:', err);
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
    scanBtn.innerHTML = '<i class="fa-solid fa-camera"></i> ' + t('scan_btn_open');
    scanBtn.classList.remove('btn-outline');
    scanBtn.classList.add('btn-primary');
}

function startScanLoop() {
    if (!mediaStream) return;
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
        const code = window.jsQR(imageData.data, sw, sh, { inversionAttempts: 'dontInvert' });

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

            if (scanHint) scanHint.textContent = t('scanning');

            setTimeout(() => {
                stopCamera();
                verifyReceiptFromQRData(code.data).catch(err => {
                    console.error('[verify] scan loop error:', err);
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

if (uploadZone && !('ontouchstart' in window)) {
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
            window.showToast(t('file_type_not_supported') || 'Unsupported file type. Please upload an image or PDF.', 'error');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            window.showToast(t('file_too_big'), 'error');
            return;
        }

        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change'));
    });
}

scanBtn?.addEventListener('click', () => {
    if (mediaStream) {
        stopCamera();
    } else if (!resultBlockWrapper?.classList.contains('active')) {
        startCamera();
    }
});

copyBtn?.addEventListener('click', async () => {
    if (!lastResultData) return;
    const text = [
        t('detail_receipt_number') + ': ' + lastResultData.receiptNumber,
        t('detail_date') + ': ' + lastResultData.date,
        t('detail_amount') + ': ' + lastResultData.amount,
        t('detail_store') + ': ' + lastResultData.store,
        t('detail_status') + ': ' + lastResultData.sellerStatus,
    ].join('\n');
    try {
        await navigator.clipboard.writeText(text);
        const span = copyBtn.querySelector('span') || copyBtn;
        const original = span.textContent;
        span.textContent = t('copied');
        copyBtn.classList.add('copied');
        setTimeout(() => {
            span.textContent = original;
            copyBtn.classList.remove('copied');
        }, 2000);
    } catch (err) {
        console.error('[verify] copy error:', err);
    }
});

scanFileInput?.addEventListener('change', async () => {
    const file = scanFileInput.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
        window.showToast(t('file_too_big'), 'error');
        scanFileInput.value = '';
        return;
    }

    scanArea?.classList.add('has-qr');
    const icon = scanArea?.querySelector('.scanner-content i');
    if (icon) icon.className = 'fa-solid fa-spinner fa-spin';
    if (scanHint) scanHint.textContent = t('decoding');

    try {
        const qrData = await decodeQR(file);

        if (!qrData) {
            if (icon) icon.className = 'fa-solid fa-circle-xmark';
            if (scanHint) scanHint.textContent = t('qr_not_found_text');
            showResult('no-qr');
            return;
        }

        if (icon) icon.className = 'fa-solid fa-check-circle';
        if (scanHint) scanHint.textContent = t('scanning');
        navigator.vibrate?.(100);
        await verifyReceiptFromQRData(qrData);
    } catch (err) {
        console.error('[verify] scan error:', err);
        showResult('error', t('scan_error'));
    } finally {
        if (scanFileInput) scanFileInput.value = '';
    }
});

fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
        window.showToast(t('file_too_big'), 'error');
        fileInput.value = '';
        return;
    }

    uploadZone?.classList.add('has-file');

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
            console.error('[verify] PDF preview error:', e);
            previewImg.src = '';
        }
    } else {
        previewImg.src = URL.createObjectURL(file);
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
        console.error('[verify] upload error:', err);
        showResult('error', t('file_error'));
    } finally {
        showLoading(btn, false);
    }
});

initVerifyLang();

window.addEventListener('verify-lang-changed', () => {
    applyVerifyTranslations();
    if (scanBtn) {
        scanBtn.innerHTML = mediaStream
            ? '<i class="fa-solid fa-stop"></i> ' + t('scan_btn_stop')
            : '<i class="fa-solid fa-camera"></i> ' + t('scan_btn_open');
    }
    if (copyBtn && lastResultData) {
        copyBtn.style.display = '';
        const span = copyBtn.querySelector('span');
        if (span) span.textContent = t('copy_btn');
    }
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopCamera();
});

const backBtn = document.getElementById('verify-back-btn');
if (backBtn) {
    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get('from');
    if (fromParam) {
        backBtn.href = fromParam;
    } else if (document.referrer) {
        try {
            const refUrl = new URL(document.referrer);
            if (['/dashboard.html', '/business.html', '/receipts.html', '/index.html'].includes(refUrl.pathname)) {
                backBtn.href = document.referrer;
            }
        } catch (_) { }
    }
}