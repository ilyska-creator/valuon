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
const resultReceiptName = document.getElementById('result-receipt-name');
const resultReceiptDate = document.getElementById('result-receipt-date');
const resultReceiptAmount = document.getElementById('result-receipt-amount');
const resultReceiptStore = document.getElementById('result-receipt-store');
const resultSellerStatus = document.getElementById('result-seller-status');
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

function parseQRData(text) {
    const parts = text.split('|');
    const map = {};
    for (const part of parts) {
        const idx = part.indexOf(':');
        if (idx === -1) continue;
        map[part.slice(0, idx)] = part.slice(idx + 1);
    }
    return {
        serial: map['RECEIPT'] || '',
        date: map['DATE'] || '',
        vat: parseFloat(map['TAX']) || 0,
        total: parseFloat(map['TOTAL']) || 0,
        taxId: map['SELLER'] || '',
        shopId: map['SHOP_ID'] || '',
        signature: map['SIG'] || '',
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
            resultDetails.style.display = 'block';
            resultReceiptName.textContent = data.name || '—';
            resultReceiptDate.textContent = data.date || '—';
            resultReceiptAmount.textContent = data.amount || '—';
            resultReceiptStore.textContent = data.store || '—';
            resultSellerStatus.textContent = data.sellerStatus || '—';
        } else {
            resultDetails.style.display = 'none';
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
        resultDetails.style.display = 'none';
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

        const { data: shop, error: shopError } = await supabase
            .from('shops')
            .select('public_key, tax_id, shop_name')
            .eq('id', receipt.shop_id)
            .single();

        if (shopError || !shop) {
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
                    day: 'numeric', month: 'long', year: 'numeric'
                })
                : '—';
            const gross = parseFloat(receipt.gross_total);
            const amount = Number.isFinite(gross) ? '$' + gross.toFixed(2) : '—';
            const sellerStatus = receipt.status === 'verified'
                ? t('seller_verified')
                : t('seller_pending');

            showResult('success', {
                name: receipt.item_name || '—',
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
let cameraFacingMode = 'environment';
let torchOn = false;
let lastResultData = null;
const video = document.getElementById('scanner-video');
const canvas = document.getElementById('scanner-canvas');
const scanBtn = document.getElementById('verify-scan-btn');
const flashBtn = document.getElementById('camera-flash-btn');
const switchBtn = document.getElementById('camera-switch-btn');
const copyBtn = document.getElementById('verify-copy-btn');

async function startCamera() {
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: cameraFacingMode, width: { ideal: 640 }, height: { ideal: 640 } }
        });
        video.srcObject = mediaStream;
        await video.play();
        scanArea?.classList.add('active');
        scanBtn.innerHTML = '<i class="fa-solid fa-stop"></i> ' + t('scan_btn_stop');
        scanBtn.classList.remove('btn-primary');
        scanBtn.classList.add('btn-outline');
        resultBlockWrapper?.classList.remove('active');
        startScanLoop();
        setupCameraControls();
    } catch (err) {
        console.error('[verify] camera error:', err);
        scanFileInput?.click();
    }
}

function setupCameraControls() {
    const track = mediaStream?.getVideoTracks()[0];
    if (!track) return;

    switchBtn.hidden = false;

    const capabilities = track.getCapabilities?.();
    if (capabilities?.torch) {
        flashBtn.hidden = false;
        flashBtn.classList.remove('active');
        torchOn = false;
    } else {
        flashBtn.hidden = true;
    }
}

async function toggleFlash() {
    const track = mediaStream?.getVideoTracks()[0];
    if (!track) return;
    try {
        torchOn = !torchOn;
        await track.applyConstraints({ advanced: [{ torch: torchOn }] });
        flashBtn.classList.toggle('active', torchOn);
    } catch (err) {
        console.error('[verify] torch error:', err);
        torchOn = !torchOn;
    }
}

async function switchCamera() {
    stopCamera();
    cameraFacingMode = cameraFacingMode === 'environment' ? 'user' : 'environment';
    await startCamera();
}

function stopCamera() {
    if (scanInterval) {
        clearInterval(scanInterval);
        scanInterval = null;
    }
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
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    scanInterval = setInterval(() => {
        if (!mediaStream || video.readyState < 2) return;

        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) return;

        const maxSize = 640;
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
            stopCamera();
            navigator.vibrate?.(100);
            const icon = scanArea?.querySelector('.scanner-content i');
            const hint = document.getElementById('scan-hint');
            if (icon) icon.className = 'fa-solid fa-spinner fa-spin';
            if (hint) hint.textContent = t('scanning');
            verifyReceiptFromQRData(code.data).catch(err => {
                console.error('[verify] scan loop error:', err);
            });
        }
    }, 400);
}

flashBtn?.addEventListener('click', toggleFlash);
switchBtn?.addEventListener('click', switchCamera);

scanArea?.addEventListener('click', () => {
    if (!mediaStream) {
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

    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadZone.classList.add('drag-over');
    });

    uploadZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter--;
        if (dragCounter <= 0) {
            dragCounter = 0;
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
        if (file.size > 10 * 1024 * 1024) {
            alert(t('file_too_big'));
            return;
        }

        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change'));
    });

    uploadZone.addEventListener('dragenter', () => {
        dragCounter++;
    });
}

scanBtn?.addEventListener('click', () => {
    if (mediaStream) {
        stopCamera();
    } else {
        startCamera();
    }
});

copyBtn?.addEventListener('click', async () => {
    if (!lastResultData) return;
    const text = [
        t('detail_name') + ': ' + lastResultData.name,
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
        alert(t('file_too_big'));
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
        scanFileInput.value = '';
    }
});

fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
        alert(t('file_too_big'));
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

window.addEventListener('beforeunload', stopCamera);
document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopCamera();
});