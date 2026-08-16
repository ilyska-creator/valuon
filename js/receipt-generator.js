import { SUPABASE_URL } from './supabase-client.js';
import { logError } from './security.js';
import { buildReceiptCard, ensureReceiptFontsLoaded } from './receipt-template.js';

export function generateQRDataURL(text, size = 80) {
    if (typeof qrcode === 'undefined') {
        console.error('qrcode-generator library is not loaded');
        return null;
    }

    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();

    const moduleCount = qr.getModuleCount();
    const cellSize = Math.floor(size / moduleCount);
    const actualSize = cellSize * moduleCount;

    const canvas = document.createElement('canvas');
    canvas.width = actualSize + 10;
    canvas.height = actualSize + 10;
    const ctx = canvas.getContext('2d');


    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);


    ctx.fillStyle = '#000000';
    for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
            if (qr.isDark(row, col)) {
                ctx.fillRect(col * cellSize + 5, row * cellSize + 5, cellSize, cellSize);
            }
        }
    }
    return canvas.toDataURL('image/png');
}

async function fetchLogoDataUrl(shop) {
    if (!shop?.logo_path) return null;
    try {
        const logoUrl = `${SUPABASE_URL}/storage/v1/object/public/shop-logos/${shop.logo_path}`;
        const resp = await fetch(logoUrl);
        if (!resp.ok) return null;
        const blob = await resp.blob();
        return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        return null;
    }
}

function buildQrPayload(receipt) {
    const purchaseDate = new Date(receipt.purchase_date);
    const qrDate = Number.isNaN(purchaseDate.getTime()) ? '' : purchaseDate.toISOString();
    const receiptSerial = receipt.receipt_number
        ? `RCP-${receipt.receipt_number}`
        : `RCP-${String(receipt.id || '').slice(0, 8).toUpperCase()}`;
    const vatAmount = Number(receipt.vat_amount) || 0;
    const grossTotal = Number(receipt.gross_total) || 0;

    const esc = (v) => encodeURIComponent(String(v ?? ''));
    return {
        receiptSerial,
        data: `RECEIPT:${esc(receiptSerial)}|DATE:${esc(qrDate)}|TAX:${esc(vatAmount.toFixed(2))}|TOTAL:${esc(grossTotal.toFixed(2))}|SELLER:${esc(receipt.tax_id)}|SHOP_ID:${esc(receipt.shop_id)}|SIG:${esc(receipt.fiscal_hash)}`,
    };
}

// Finds elements marked data-page-atomic and returns their [top, bottom]
// bounds (in css px, relative to `root`), sorted by position. A PDF page
// break is never allowed to land strictly inside one of these ranges —
// that's what stops a table row (or the totals box, etc.) from being cut
// in half across two pages.
function findAtomicRanges(root) {
    const rootTop = root.getBoundingClientRect().top;
    return [...root.querySelectorAll('[data-page-atomic]')]
        .map((node) => {
            const r = node.getBoundingClientRect();
            return [r.top - rootTop, r.bottom - rootTop];
        })
        .sort((a, b) => a[0] - b[0]);
}

function nextSafeCut(atomicRanges, candidateY, maxY) {
    for (const [start, end] of atomicRanges) {
        if (candidateY > start && candidateY < end) return start;
    }
    return Math.min(candidateY, maxY);
}

// Splits the card into pages, each described as { top, bottom, repeatHeader }.
// `repeatHeader` is true for a continuation page (not the first) that opens
// mid-table — i.e. its top falls after the real header row but before the
// last item row ends — so the caller knows to prepend a cropped copy of the
// header band there. Such pages get a smaller height budget (pageHeight
// minus the header band) so the composited page still fits one physical
// A4 sheet once the repeated header is glued on top of it.
function computePages(totalHeight, pageHeight, atomicRanges, headerRange) {
    const pages = [];
    let cur = 0;
    let index = 0;
    while (cur < totalHeight - 0.5) {
        const repeatHeader = index > 0 && headerRange
            && cur >= headerRange[1] - 0.5 && cur < headerRange[2] - 0.5;
        const budget = repeatHeader ? Math.max(pageHeight - (headerRange[1] - headerRange[0]), 1) : pageHeight;

        let next = nextSafeCut(atomicRanges, cur + budget, totalHeight);
        if (next <= cur + 0.5) {
            // A single atomic block is taller than one page — fall back to a
            // hard cut rather than looping forever; content is still
            // complete, just split mid-block in this rare case.
            next = Math.min(cur + budget, totalHeight);
        }
        pages.push({ top: cur, bottom: next, repeatHeader });
        cur = next;
        index++;
    }
    return pages;
}

// JPEG rather than PNG: the card is a photograph-free UI (flat fills, text,
// a faint full-bleed watermark) but PNG's lossless run-length-ish encoding
// compresses that watermark's dithering badly — a 3-item receipt at scale 2
// came out to ~13MB as PNG. JPEG's DCT coding handles that texture far
// better; quality 0.92 keeps text crisp while landing in the hundreds of KB.
function sliceCanvas(sourceCanvas, sy, sh) {
    const slice = document.createElement('canvas');
    slice.width = sourceCanvas.width;
    slice.height = Math.max(1, Math.round(sh));
    const ctx = slice.getContext('2d');
    ctx.drawImage(sourceCanvas, 0, sy, sourceCanvas.width, slice.height, 0, 0, sourceCanvas.width, slice.height);
    return slice.toDataURL('image/jpeg', 0.92);
}

// Same as sliceCanvas, but with a copy of the table's header band (cropped
// from headerSy/headerSh, always the same source region) glued above the
// body slice — used for continuation pages that open mid-table.
function sliceCanvasWithHeader(sourceCanvas, headerSy, headerSh, bodySy, bodySh) {
    const headerH = Math.max(1, Math.round(headerSh));
    const bodyH = Math.max(1, Math.round(bodySh));
    const composite = document.createElement('canvas');
    composite.width = sourceCanvas.width;
    composite.height = headerH + bodyH;
    const ctx = composite.getContext('2d');
    ctx.drawImage(sourceCanvas, 0, headerSy, sourceCanvas.width, headerH, 0, 0, sourceCanvas.width, headerH);
    ctx.drawImage(sourceCanvas, 0, bodySy, sourceCanvas.width, bodyH, 0, headerH, sourceCanvas.width, bodyH);
    return composite.toDataURL('image/jpeg', 0.92);
}

export async function downloadReceiptPDF(receipt, shop) {
    const genLang = (typeof localStorage !== 'undefined' && localStorage.getItem('valuon-lang')) || 'ru';
    const toastError = (msg) => {
        if (typeof window.showToast === 'function') window.showToast(msg, 'error');
    };

    if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
        console.error('jsPDF or html2canvas is not loaded');
        toastError(genLang === 'en' ? 'PDF generation library not loaded. Please refresh the page.' : 'Библиотека генерации PDF не загружена. Попробуйте обновить страницу.');
        return;
    }

    let card = null;
    try {
        const { jsPDF } = window.jspdf;
        const { receiptSerial, data: qrData } = buildQrPayload({ ...receipt, tax_id: shop?.tax_id, shop_id: receipt.shop_id });

        const [logoDataUrl] = await Promise.all([
            fetchLogoDataUrl(shop),
            ensureReceiptFontsLoaded(),
        ]);
        const qrDataUrl = generateQRDataURL(qrData, 220);

        card = buildReceiptCard(receipt, shop, { logoDataUrl, qrDataUrl });

        // Layout must settle (webfonts swapped in, images sized) before we
        // measure atomic-block boundaries — otherwise the page-break math
        // below would be computed against stale positions. rAF normally
        // fires within a frame, but browsers can suspend it indefinitely
        // for a backgrounded/inactive tab, so race it against a timeout
        // rather than risk hanging the download forever.
        await Promise.race([
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
            new Promise((resolve) => setTimeout(resolve, 400)),
        ]);

        const cardWidthCss = card.offsetWidth;
        const cardHeightCss = card.offsetHeight;
        const atomicRanges = findAtomicRanges(card);

        const canvas = await window.html2canvas(card, {
            scale: 2,
            backgroundColor: '#FAFAF9',
            useCORS: true,
            logging: false,
        });
        const scaleFactor = canvas.width / cardWidthCss;

        const PDF_WIDTH_MM = 200;
        const PDF_MARGIN_MM = 5;
        const pxPerMm = cardWidthCss / PDF_WIDTH_MM;
        const cardHeightMm = cardHeightCss / pxPerMm;

        // The mockup's generous whitespace means even a 2-3 item receipt
        // often runs a few mm past one A4 page — forcing real pagination
        // there would produce a near-empty second page for every receipt.
        // Anything under this cap just gets one custom-sized PDF page fit
        // to the content instead; only genuinely long receipts (many
        // items) fall through to real multi-page A4 pagination below.
        const SINGLE_PAGE_CAP_MM = 400;
        let doc;
        if (cardHeightMm + PDF_MARGIN_MM * 2 <= SINGLE_PAGE_CAP_MM) {
            const pageHeightMm = cardHeightMm + PDF_MARGIN_MM * 2;
            doc = new jsPDF({ unit: 'mm', format: [PDF_WIDTH_MM + PDF_MARGIN_MM * 2, pageHeightMm] });
            const sliceDataUrl = sliceCanvas(canvas, 0, canvas.height);
            doc.addImage(sliceDataUrl, 'JPEG', PDF_MARGIN_MM, PDF_MARGIN_MM, PDF_WIDTH_MM, cardHeightMm);
        } else {
            doc = new jsPDF({ unit: 'mm', format: 'a4' });
            const PDF_PAGE_HEIGHT_MM = 297 - PDF_MARGIN_MM * 2;
            const pageHeightCss = PDF_PAGE_HEIGHT_MM * pxPerMm;

            const theadEl = card.querySelector('table thead');
            const tbodyRows = [...card.querySelectorAll('table tbody tr')];
            let headerRange = null;
            if (theadEl && tbodyRows.length) {
                const cardTop = card.getBoundingClientRect().top;
                const theadRect = theadEl.getBoundingClientRect();
                const lastRowRect = tbodyRows[tbodyRows.length - 1].getBoundingClientRect();
                headerRange = [theadRect.top - cardTop, theadRect.bottom - cardTop, lastRowRect.bottom - cardTop];
            }

            const pages = computePages(cardHeightCss, pageHeightCss, atomicRanges, headerRange);

            pages.forEach((page, i) => {
                const bodyHeightCss = page.bottom - page.top;
                if (bodyHeightCss <= 0) return;

                let sliceDataUrl;
                let totalHeightCss;
                if (page.repeatHeader) {
                    const headerHeightCss = headerRange[1] - headerRange[0];
                    sliceDataUrl = sliceCanvasWithHeader(
                        canvas,
                        headerRange[0] * scaleFactor, headerHeightCss * scaleFactor,
                        page.top * scaleFactor, bodyHeightCss * scaleFactor,
                    );
                    totalHeightCss = headerHeightCss + bodyHeightCss;
                } else {
                    sliceDataUrl = sliceCanvas(canvas, page.top * scaleFactor, bodyHeightCss * scaleFactor);
                    totalHeightCss = bodyHeightCss;
                }
                const imgHeightMm = totalHeightCss / pxPerMm;

                if (i > 0) doc.addPage();
                doc.addImage(sliceDataUrl, 'JPEG', PDF_MARGIN_MM, PDF_MARGIN_MM, PDF_WIDTH_MM, imgHeightMm);
            });
        }

        doc.setProperties({
            title: `Receipt ${receiptSerial}`,
            subject: 'Valuon Digital Receipt',
            author: shop?.shop_name || 'Valuon',
            creator: 'Valuon',
        });

        doc.save(`${receiptSerial}_receipt.pdf`);
    } catch (e) {
        logError('receiptGen:pdf', e);
        toastError(genLang === 'en' ? 'Error creating PDF' : 'Ошибка при создании PDF');
    } finally {
        if (card) card.remove();
    }
}
