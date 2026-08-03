import { requireAuth } from './dashboard-auth.js';
import { escapeHtml, logError } from './security.js';

function getNotifLang() {
    return localStorage.getItem('valuon-lang') || 'ru';
}

function getNotifT() {
    const lang = getNotifLang();
    return window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
}

function calculateDaysLeft(warrantyEndDate) {
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

function formatDate(dateStr) {
    const lang = getNotifLang();
    const locale = lang === 'ru' ? 'ru-RU' : 'en-US';
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'numeric', year: 'numeric' });
}

function updateNotifBadge(count) {
    document.querySelectorAll('[data-notif-badge]').forEach(el => {
        if (count > 0) {
            el.textContent = count > 99 ? '99+' : String(count);
            el.classList.remove('hidden');
        } else {
            el.textContent = '';
            el.classList.add('hidden');
        }
    });
}

async function computeActiveAlertsCount(userId, client) {
    const { data: profile } = await client
        .from('profiles')
        .select('expiry_alerts')
        .eq('id', userId)
        .single();

    const expiryAlertsEnabled = profile?.expiry_alerts ?? true;
    if (!expiryAlertsEnabled) return 0;

    const { data: items, error } = await client
        .from('items')
        .select('warranty_end_date')
        .eq('user_id', userId);

    if (error || !items) return 0;

    let count = 0;
    items.forEach(item => {
        if (!item.warranty_end_date) return;
        const daysLeft = calculateDaysLeft(item.warranty_end_date);
        if (daysLeft <= 30) count++;
    });

    return count;
}

export async function refreshNotifBadge() {
    try {
        const auth = await requireAuth();
        if (!auth) return;
        const count = await computeActiveAlertsCount(auth.user.id, auth.client);
        updateNotifBadge(count);
    } catch (e) {
        logError('notif:badgeRefresh', e);
    }
}

async function loadNotifications(userId, client) {
    const container = document.getElementById('notifications-container');
    if (!container) return;

    const checkingText = window.dashboardTranslations?.[localStorage.getItem('valuon-lang') || 'ru']?.notif_checking || 'Проверка статусов...';
    container.innerHTML = `<div class="loading-state"><i class="fa-solid fa-circle-notch fa-spin"></i> ${checkingText}</div>`;

    const { data: profile } = await client
        .from('profiles')
        .select('expiry_alerts')
        .eq('id', userId)
        .single();

    const expiryAlertsEnabled = profile?.expiry_alerts ?? true;

    const { data: items, error } = await client
        .from('items')
        .select('name, purchase_date, warranty_end_date')
        .eq('user_id', userId)
        .order('purchase_date', { ascending: false });

    if (error) {
        logError('notif:load', error);
        const t = getNotifT();
        container.innerHTML = `<div class="empty-state error">${t.msg_save_error || 'Error loading notifications'}</div>`;
        return;
    }

    if (!items || items.length === 0) {
        const t = getNotifT();
        container.innerHTML = `
            <div class="notification-card info">
                <div class="notif-icon"><i class="fa-solid fa-database"></i></div>
                <div class="notif-content">
                    <h4>${t.notif_empty_title || 'No items yet'}</h4>
                    <p>${t.notif_empty_desc || 'Add at least one item to receive notifications.'}</p>
                </div>
            </div>`;
        return;
    }

    if (!expiryAlertsEnabled) {
        const t = getNotifT();
        container.innerHTML = `
            <div class="notification-card info">
                <div class="notif-icon"><i class="fa-solid fa-bell-slash"></i></div>
                <div class="notif-content">
                    <h4>${t.notif_disabled_title || 'Notifications disabled'}</h4>
                    <p>${t.notif_disabled_desc || 'Enable warranty reminders in Settings to see alerts here.'}</p>
                </div>
            </div>`;
        return;
    }

    const notifications = [];
    items.forEach(item => {
        if (!item.warranty_end_date) return;
        const daysLeft = calculateDaysLeft(item.warranty_end_date);
        const t = getNotifT();

        if (daysLeft > 0 && daysLeft <= 30) {
            notifications.push({
                type: 'warning',
                icon: 'fa-triangle-exclamation',
                title: (t.notif_expiring_title || 'Warranty for "{name}" is expiring').replace('{name}', escapeHtml(item.name)),
                text: (t.notif_expiring_text || '{count} days left. Check device condition.').replace('{count}', daysLeft),
                date: formatDate(new Date().toISOString())
            });
        } else if (daysLeft <= 0) {
            const absDays = Math.abs(daysLeft);
            notifications.push({
                type: 'expired',
                icon: 'fa-circle-xmark',
                title: (t.notif_expired_title || 'Warranty for "{name}" has expired').replace('{name}', escapeHtml(item.name)),
                text: (t.notif_expired_text || 'Expired {count} days ago.').replace('{count}', absDays),
                date: formatDate(item.purchase_date)
            });
        }
    });

    if (notifications.length === 0) {
        const t = getNotifT();
        container.innerHTML = `
            <div class="notification-card info">
                <div class="notif-icon"><i class="fa-solid fa-check-circle"></i></div>
                <div class="notif-content">
                    <h4>${t.notif_all_good_title || 'All good!'}</h4>
                    <p>${(t.notif_all_good_text || 'You have {count} items and none expire within 30 days.').replace('{count}', items.length)}</p>
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

    updateNotifBadge(notifications.length);
}

let notifInitialized = false;

let cachedUserId = null;
let cachedClient = null;

async function ensureNotifLoaded() {
    if (notifInitialized) return;
    try {
        const auth = await requireAuth();
        if (!auth) return;
        cachedUserId = auth.user.id;
        cachedClient = auth.client;
        await loadNotifications(auth.user.id, auth.client);
        notifInitialized = true;
    } catch (e) {
        logError('notif:load', e);
    }
}

document.querySelectorAll('[data-view="notifications"]').forEach(el => {
    el.addEventListener('click', ensureNotifLoaded);
});

if (window.location.hash === '#view-notifications' || window.__targetView === 'view-notifications' || sessionStorage.getItem('dashboard-view') === 'view-notifications') {
    ensureNotifLoaded();
}

window.addEventListener('lang-changed', async () => {
    if (notifInitialized && cachedUserId && cachedClient) {
        try {
            await loadNotifications(cachedUserId, cachedClient);
        } catch (e) {
            logError('notif:reloadLang', e);
        }
    }
});

(async function initNotifBadge() {
    try {
        const auth = await requireAuth();
        if (!auth) return;
        const count = await computeActiveAlertsCount(auth.user.id, auth.client);
        updateNotifBadge(count);
    } catch (e) {
        logError('notif:badgeInit', e);
    }
})();