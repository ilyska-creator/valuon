// js/receipt-generator.js

/**
 * Генерирует Base64 изображение QR-кода для PDF
 */
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

    // Белый фон с серой рамкой
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);

    // Рисуем модули QR
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

/**
 * Генерирует и скачивает PDF чек
 * @param {Object} receipt - Данные чека из БД
 * @param {Object} shop - Данные магазина (текущийShop)
 */
export function downloadReceiptPDF(receipt, shop) {
    if (typeof window.jspdf === 'undefined') {
        console.error('jsPDF library is not loaded');
        alert('Библиотека генерации PDF не загружена. Попробуйте обновить страницу.');
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const sellerName = shop?.shop_name || 'Valuon Seller';
        const sellerAddress = shop?.address || '';
        const taxId = shop?.tax_id || '';
        const registerSerial = `CR-${new Date().getFullYear()}-001`;

        const purchaseDate = new Date(receipt.purchase_date).toLocaleString('ru-RU');
        const receiptSerial = `RCP-${receipt.id.slice(0, 8).toUpperCase()}`;

        const netTotal = receipt.net_total;
        const vatAmount = receipt.vat_amount;
        const grossTotal = receipt.gross_total;

        // Формируем данные для QR (фискальная подпись)
        const qrData = `RECEIPT:${receiptSerial}|DATE:${purchaseDate}|TAX:${vatAmount.toFixed(2)}|TOTAL:${grossTotal.toFixed(2)}|SELLER:${taxId}|HASH:${receipt.fiscal_hash}`;

        let y = 0;
        const leftCol = 20;
        const rightCol = 120;

        // 1. Брендированная шапка
        doc.setFillColor(59, 130, 246);
        doc.rect(0, 0, 210, 18, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text("VALUON DIGITAL RECEIPT SYSTEM", 20, 11);

        y = 28;
        doc.setTextColor(0, 0, 0);

        // 2. Данные продавца
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text(sellerName, leftCol, y);
        y += 7;

        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(60, 60, 60);
        doc.text(sellerAddress, leftCol, y);
        y += 5;
        doc.text(`Tax ID: ${taxId}   |   Reg. S/N: ${registerSerial}`, leftCol, y);
        y += 10;

        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.line(leftCol, y, 190, y);
        y += 8;

        // 3. Метаданные чека
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'bold');
        doc.text(`Receipt #:`, leftCol, y);
        doc.setFont(undefined, 'normal');
        doc.text(receiptSerial, leftCol + 25, y);

        doc.setFont(undefined, 'bold');
        doc.text(`Date:`, rightCol, y);
        doc.setFont(undefined, 'normal');
        doc.text(purchaseDate, rightCol + 15, y);
        y += 6;

        if (receipt.customer_email) {
            doc.setFont(undefined, 'bold');
            doc.text(`Customer:`, leftCol, y);
            doc.setFont(undefined, 'normal');
            doc.text(receipt.customer_email, leftCol + 25, y);
            y += 6;
        }

        doc.setFont(undefined, 'bold');
        doc.text(`Payment:`, leftCol, y);
        doc.setFont(undefined, 'normal');
        doc.text(receipt.payment_method, leftCol + 25, y);
        y += 10;

        // 4. Таблица товаров
        doc.setDrawColor(180, 180, 180);
        doc.setLineDashPattern([1, 1], 0);
        doc.line(leftCol, y, 190, y);
        doc.setLineDashPattern([], 0);
        y += 6;

        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(100, 100, 100);
        doc.text("ITEM DESCRIPTION", leftCol, y);
        doc.text("QTY", 100, y);
        doc.text("PRICE", 135, y);
        doc.text("TOTAL", 165, y);
        y += 2;

        doc.setDrawColor(220, 220, 220);
        doc.line(leftCol, y, 190, y);
        y += 6;

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(receipt.item_name.substring(0, 38), leftCol, y);

        doc.setFont("courier", "normal");
        doc.text(receipt.qty.toString(), 100, y);
        doc.text(`$${receipt.unit_price.toFixed(2)}`, 135, y);
        doc.text(`$${netTotal.toFixed(2)}`, 165, y);
        doc.setFont("helvetica", "normal");

        y += 6;
        doc.setDrawColor(180, 180, 180);
        doc.setLineDashPattern([1, 1], 0);
        doc.line(leftCol, y, 190, y);
        doc.setLineDashPattern([], 0);
        y += 8;

        // 5. Блок итогов
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Net Amount:`, rightCol, y);
        doc.setFont("courier", "normal");
        doc.text(`$${netTotal.toFixed(2)}`, 165, y);
        y += 6;

        doc.setFont("helvetica", "normal");
        doc.text(`Tax (${receipt.vat_rate}%):`, rightCol, y);
        doc.setFont("courier", "normal");
        doc.text(`$${vatAmount.toFixed(2)}`, 165, y);
        y += 8;

        doc.setFillColor(243, 244, 246);
        doc.rect(rightCol - 5, y - 5, 70, 12, 'F');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(`GROSS TOTAL:`, rightCol, y);
        doc.setFont("courier", "bold");
        doc.text(`$${grossTotal.toFixed(2)}`, 165, y);
        y += 12;

        doc.setDrawColor(59, 130, 246);
        doc.setLineWidth(0.5);
        doc.line(rightCol - 5, y, 190, y);
        doc.setLineWidth(0.2);
        doc.line(rightCol - 5, y + 1.5, 190, y + 1.5);
        y += 15;

        // 6. QR код
        const qrImg = generateQRDataURL(qrData, 70);
        if (qrImg) {
            doc.addImage(qrImg, 'PNG', leftCol, y, 35, 35);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text("Scan to verify fiscal data", leftCol + 40, y + 10);
            doc.text("(Contains Tax, Total, Seller ID & Timestamp)", leftCol + 40, y + 16);
        }
        y += 45;

        // 7. Футер
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.line(leftCol, y, 190, y);
        y += 6;

        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text("This document complies with international fiscal standards.", leftCol, y);
        y += 4;
        doc.text("Generated securely by Valuon Digital Ownership Infrastructure.", leftCol, y);
        y += 4;
        doc.text("For support or verification issues, contact valuonguard@proton.me", leftCol, y);

        doc.save(`${receiptSerial}_receipt.pdf`);

    } catch (e) {
        console.error("PDF Generation failed:", e);
        if (typeof window.showToast === 'function') {
            window.showToast('Ошибка при создании PDF', 'error');
        } else {
            alert('Ошибка при генерации чека. Проверьте консоль.');
        }
    }
}