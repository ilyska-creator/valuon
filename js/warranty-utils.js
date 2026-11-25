export function parseLocalDate(dateInput) {
    if (dateInput instanceof Date) {
        return Number.isNaN(dateInput.getTime()) ? null : new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());
    }
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput.trim())) {
        const [year, month, day] = dateInput.trim().slice(0, 10).split('-').map(Number);
        const dt = new Date(year, month - 1, day);
        if (dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day) return dt;
        return null;
    }
    const parsed = new Date(dateInput);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function calculateDaysLeft(warrantyEndDate) {
    let endUtcMs;

    if (warrantyEndDate instanceof Date) {
        if (Number.isNaN(warrantyEndDate.getTime())) return -999;
        endUtcMs = Date.UTC(warrantyEndDate.getFullYear(), warrantyEndDate.getMonth(), warrantyEndDate.getDate());
    } else if (typeof warrantyEndDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(warrantyEndDate)) {
        const [year, month, day] = warrantyEndDate.slice(0, 10).split('-').map(Number);
        endUtcMs = Date.UTC(year, month - 1, day);
    } else {
        return -999;
    }

    const now = new Date();
    const todayUtcMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((endUtcMs - todayUtcMs) / 86400000);
    return Number.isFinite(days) ? days : -999;
}

export function isNoWarranty(item) {
    if (!item) return true;
    const months = Number(item.warranty_months);
    if (!Number.isFinite(months) || months <= 0) return true;
    if (!item.warranty_end_date) return true;
    if (
        item.purchase_date &&
        String(item.purchase_date).slice(0, 10) === String(item.warranty_end_date).slice(0, 10)
    ) {
        return true;
    }
    return false;
}

export function extractActivePartnerWarrantyItems(receipts) {
    const result = [];
    (receipts || []).forEach((receipt) => {
        const lc = receipt?.lifecycle_status || 'active';
        if (lc === 'voided' || lc === 'refunded') return;
        const lineItems = Array.isArray(receipt?.receipt_items) ? receipt.receipt_items : [];
        lineItems.forEach((it) => {
            const origQty = Math.max(1, parseInt(it?.qty, 10) || 1);
            const refQty = Math.max(0, parseInt(it?.refunded_qty, 10) || 0);
            const activeQty = origQty - refQty;
            if (activeQty <= 0) return;

            const candidate = {
                warranty_months: it.warranty_months,
                purchase_date: receipt.purchase_date,
                warranty_end_date: it.warranty_end_date,
            };
            if (isNoWarranty(candidate)) return;

            result.push({
                id: it.id,
                receipt_id: receipt.id,
                name: it.item_name || '',
                shop_name: receipt.shop_name || '',
                purchase_date: receipt.purchase_date || null,
                warranty_months: it.warranty_months,
                warranty_end_date: it.warranty_end_date,
                active_qty: activeQty,
                is_partner: true,
            });
        });
    });
    return result;
}

