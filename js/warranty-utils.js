export function calculateDaysLeft(warrantyEndDate) {
    let endDate;

    if (warrantyEndDate instanceof Date) {
        endDate = new Date(warrantyEndDate.getTime());
    } else if (typeof warrantyEndDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(warrantyEndDate)) {
        const [year, month, day] = warrantyEndDate.slice(0, 10).split('-').map(Number);
        endDate = new Date(year, month - 1, day);
    } else {
        return -999;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    const diffTime = endDate.getTime() - today.getTime();
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Number.isFinite(days) ? days : -999;
}
