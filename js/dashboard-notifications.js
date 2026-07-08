import { requireAuth } from './dashboard-auth.js';

function getNotifLang() {
    return localStorage.getItem('valuon-lang') || 'ru';
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getNotifT() {
    const lang = getNotifLang();
    return window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
}

function calculateDaysLeft(purchaseDate, months) {
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

function formatDate(dateStr) {
    const lang = getNotifLang();
    const locale = lang === 'ru' ? 'ru-RU' : 'en-US';
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

async function loadNotifications(userId, client) {
    const container = document.getElementById('notifications-container');
    if (!container) return;

    container.innerHTML = '<div class="loading-state"><i class="fa-solid fa-circle-notch fa-spin"></i> <span data-i18n="notif_checking"></span></div>';

    const { data: profile } = await client
        .from('profiles')
        .select('expiry_alerts')
        .eq('id', userId)
        .single();

    const expiryAlertsEnabled = profile?.expiry_alerts ?? true;

    const { data: items, error } = await client
        .from('items')
        .select('name, purchase_date, warranty_months')
        .eq('user_id', userId)
        .order('purchase_date', { ascending: false });

    if (error) {
        console.error(error);
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
        const daysLeft = calculateDaysLeft(item.purchase_date, item.warranty_months);
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
}

const notifLink = document.querySelector('[data-view="notifications"]');
let notifInitialized = false;

let cachedUserId = null;
let cachedClient = null;

async function ensureNotifLoaded() {
    if (notifInitialized) return;
    const auth = await requireAuth();
    if (!auth) return;
    cachedUserId = auth.user.id;
    cachedClient = auth.client;
    await loadNotifications(auth.user.id, auth.client);
    notifInitialized = true;
}

if (notifLink) {
    notifLink.addEventListener('click', ensureNotifLoaded);
}

if (window.location.hash === '#view-notifications') {
    ensureNotifLoaded();
}

window.addEventListener('lang-changed', async () => {
    if (notifInitialized && cachedUserId && cachedClient) {
        await loadNotifications(cachedUserId, cachedClient);
    }
});