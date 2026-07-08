import ReceiptVerifier from './crypto-verification.js';
import Ed25519Signer from './crypto-signature.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

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
    });
});

function resetAll() {
    stopCamera();
    Object.values(panels).forEach(p => p?.classList.remove('done'));
    resultBlockWrapper?.classList.remove('active');
    tabs.forEach(t => t.classList.remove('active'));
    tabs[0]?.classList.add('active');
    Object.values(panels).forEach(p => p?.classList.remove('active'));
    panels.scan?.classList.add('active');
    uploadZone?.classList.remove('has-file');
    uploadPreview?.classList.remove('active');
    fileInput.value = '';
    scanFileInput.value = '';
    scanArea?.classList.remove('has-qr');
    const icon = scanArea?.querySelector('.scanner-content i');
    if (icon) icon.className = 'fa-solid fa-qrcode';
    if (scanHint) scanHint.textContent = 'Наведите камеру на QR-код';
}

retryBtn?.addEventListener('click', resetAll);

function showLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
        if (!btn.dataset.original) btn.dataset.original = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Проверяем...';
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
    resultBlock.className = 'verify-result';

    if (status === 'success') {
        resultBlock.classList.add('success');
        resultBlock.classList.remove('failure');
        resultIcon.className = 'fa-solid fa-circle-check';
        resultTitle.textContent = 'Чек верифицирован';
        resultDesc.textContent = 'Подпись чека действительна. Данные не были изменены.';
        resultBadge.className = 'verify-badge verified';
        resultBadge.textContent = 'Подлинный';

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
            resultTitle.textContent = 'Чек не найден';
            resultDesc.textContent = 'Чек с указанными данными не обнаружен в реестре. Возможно, он был выдан в другой системе.';
            resultBadge.textContent = 'Не найден';
        } else if (status === 'invalid') {
            resultTitle.textContent = 'Подпись недействительна';
            resultDesc.textContent = 'Криптографическая подпись чека не прошла проверку. Данные были изменены после подписания.';
            resultBadge.textContent = 'Недействителен';
        } else if (status === 'no-qr') {
            resultTitle.textContent = 'QR-код не найден';
            resultDesc.textContent = data || 'На изображении не удалось обнаружить QR-код. Попробуйте другое фото.';
            resultBadge.textContent = 'Ошибка';
        } else if (status === 'error') {
            resultTitle.textContent = 'Ошибка проверки';
            resultDesc.textContent = data || 'Произошла ошибка при проверке чека.';
            resultBadge.textContent = 'Ошибка';
        } else {
            resultTitle.textContent = 'Ошибка проверки';
            resultDesc.textContent = data || 'Произошла ошибка при проверке чека.';
            resultBadge.textContent = 'Ошибка';
        }
        resultDetails.style.display = 'none';
    }
}

async function verifyReceiptFromQRData(qrRaw) {
    if (verifying) return;
    verifying = true;
    try {
        const parsed = parseQRData(qrRaw);
        console.log('[verify] QR parsed:', parsed);

        if (!parsed.signature || !parsed.taxId) {
            console.error('[verify] Missing signature or taxId in QR');
            showResult('invalid');
            return;
        }

        const { data, error } = await supabase
            .rpc('verify_get_receipt', { p_fiscal_hash: parsed.signature })
            .maybeSingle();

        if (error) {
            console.error('[verify] RPC error:', error);
            showResult('error', 'Ошибка доступа к реестру: ' + error.message);
            return;
        }

        if (!data?.found) {
            console.error('[verify] Receipt not found for fiscal_hash:', parsed.signature);
            showResult('not-found');
            return;
        }

        const receipt = data.receipt;
        const shop = data.shop;
        console.log('[verify] Receipt found, shop:', shop.shop_name);

        if (!Ed25519Signer.isSupported()) {
            console.error('[verify] Ed25519 not supported in this browser');
            showResult('error', 'Ваш браузер не поддерживает криптографию Ed25519.');
            return;
        }

        const verifier = new ReceiptVerifier();
        const result = await verifier.verifyReceipt(receipt, shop);
        console.log('[verify] Verification result:', result);

        if (result.valid) {
            const dateStr = receipt.purchase_date
                ? new Date(receipt.purchase_date).toLocaleDateString('ru-RU', {
                    day: 'numeric', month: 'long', year: 'numeric'
                  })
                : '—';
            const gross = parseFloat(receipt.gross_total);
            const amount = Number.isFinite(gross) ? '$' + gross.toFixed(2) : '—';
            const sellerStatus = receipt.status === 'verified'
                ? 'Email подтверждён'
                : 'Ожидает подтверждения';

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
        showResult('error', 'Внутренняя ошибка при проверке');
    } finally {
        verifying = false;
    }
}

let mediaStream = null;
let scanInterval = null;
let verifying = false;
const video = document.getElementById('scanner-video');
const canvas = document.getElementById('scanner-canvas');
const scanBtn = document.getElementById('verify-scan-btn');

async function startCamera() {
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 640 } }
        });
        video.srcObject = mediaStream;
        await video.play();
        scanArea?.classList.add('active');
        scanBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Остановить';
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
    if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
    }
    video.srcObject = null;
    scanArea?.classList.remove('active');
    scanBtn.innerHTML = '<i class="fa-solid fa-camera"></i> Открыть камеру';
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
            const icon = scanArea?.querySelector('.scanner-content i');
            const hint = document.getElementById('scan-hint');
            if (icon) icon.className = 'fa-solid fa-spinner fa-spin';
            if (hint) hint.textContent = 'QR найден, проверяем...';
            verifyReceiptFromQRData(code.data).catch(err => {
                console.error('[verify] scan loop error:', err);
            });
        }
    }, 400);
}

scanArea?.addEventListener('click', () => {
    if (!mediaStream) {
        startCamera();
    }
});

uploadZone?.addEventListener('click', () => {
    fileInput?.click();
});

scanBtn?.addEventListener('click', () => {
    if (mediaStream) {
        stopCamera();
    } else {
        startCamera();
    }
});

scanFileInput?.addEventListener('change', async () => {
    const file = scanFileInput.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
        alert('Файл слишком большой. Максимум 10 МБ.');
        scanFileInput.value = '';
        return;
    }

    scanArea?.classList.add('has-qr');
    const icon = scanArea?.querySelector('.scanner-content i');
    if (icon) icon.className = 'fa-solid fa-spinner fa-spin';
    if (scanHint) scanHint.textContent = 'Декодируем QR...';

    try {
        const qrData = await decodeQR(file);

        if (!qrData) {
            if (icon) icon.className = 'fa-solid fa-circle-xmark';
            if (scanHint) scanHint.textContent = 'QR-код не найден';
            showResult('no-qr');
            return;
        }

        if (icon) icon.className = 'fa-solid fa-check-circle';
        if (scanHint) scanHint.textContent = 'QR найден, проверяем...';

        await verifyReceiptFromQRData(qrData);
    } catch (err) {
        console.error('[verify] scan error:', err);
        showResult('error', 'Ошибка при обработке изображения');
    } finally {
        scanFileInput.value = '';
    }
});

fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
        alert('Файл слишком большой. Максимум 10 МБ.');
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
        showResult('error', 'Ошибка при обработке файла');
    } finally {
        showLoading(btn, false);
    }
});
