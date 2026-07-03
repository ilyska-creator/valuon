function _calculateDaysLeft(purchaseDate, months) {
    if (!purchaseDate || !months) return -999;
    const [year, month, day] = purchaseDate.split('-').map(Number);
    const endDate = new Date(year, month - 1, day);
    const targetMonth = endDate.getMonth() + parseInt(months);
    endDate.setFullYear(endDate.getFullYear() + Math.floor(targetMonth / 12));
    endDate.setMonth(targetMonth % 12);
    if (endDate.getDate() !== day) endDate.setDate(0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    return Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function renderNotifications(items) {
    const container = document.getElementById('notifications-container');
    if (!container) return;

    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="notification-card info">
                <div class="notif-icon"><i class="fa-solid fa-database"></i></div>
                <div class="notif-content">
                    <h4>База пуста</h4>
                    <p>Добавьте хотя бы один товар, чтобы получать уведомления.</p>
                </div>
            </div>`;
        return;
    }

    const notifications = [];
    items.forEach(item => {
        const daysLeft = _calculateDaysLeft(item.purchase_date, item.warranty_months);

        if (daysLeft > 0 && daysLeft <= 30) {
            notifications.push({
                type: 'warning',
                icon: 'fa-triangle-exclamation',
                title: `Гарантия "${item.name}" истекает`,
                text: `Осталось ${daysLeft} дн. Проверьте состояние устройства.`,
                date: 'Сегодня'
            });
        } else if (daysLeft <= 0) {
            notifications.push({
                type: 'expired',
                icon: 'fa-circle-xmark',
                title: `Гарантия "${item.name}" истекла`,
                text: `Закончилась ${Math.abs(daysLeft)} дн. назад.`,
                date: 'Требует внимания'
            });
        }
    });

    if (notifications.length === 0) {
        container.innerHTML = `
            <div class="notification-card info">
                <div class="notif-icon"><i class="fa-solid fa-check-circle"></i></div>
                <div class="notif-content">
                    <h4>Все отлично!</h4>
                    <p>У вас ${items.length} товаров, и ни у одного не истекает гарантия в ближайшие 30 дней.</p>
                </div>
            </div>`;
    } else {
        container.innerHTML = notifications.map(n => `
            <div class="notification-card ${n.type}">
                <div class="notif-icon"><i class="fa-solid ${n.icon}"></i></div>
                <div class="notif-content">
                    <h4>${n.title}</h4>
                    <p>${n.text}</p>
                    <span class="notif-time">${n.date}</span>
                </div>
            </div>
        `).join('');
    }
}

window.markAllAsRead = function () {
    const container = document.getElementById('notifications-container');
    if (container) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 40px;">
                <i class="fa-regular fa-check-circle" style="font-size: 2rem; margin-bottom: 12px; display:block; color: var(--success);"></i>
                Все уведомления прочитаны
            </div>`;
    }
};