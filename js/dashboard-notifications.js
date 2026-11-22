import { requireAuth } from './dashboard-auth.js';
import { escapeHtml, logError } from './security.js';
import { calculateDaysLeft } from './warranty-utils.js';
import { buildBuyerReceiptOrFilter, fetchCurrentUserPhone } from './phone-utils.js';

function getNotifLang() {
    return localStorage.getItem('valuon-lang') || 'ru';
}

function getNotifT() {
    const lang = getNotifLang();
    return window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
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

async function fetchRecentLifecycleReceipts(userId, userEmail, client) {
    if (!userId && !userEmail) return [];
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
    const userPhone = await fetchCurrentUserPhone(client, userId);
    const buyerOrFilter = buildBuyerReceiptOrFilter({ userId, email: userEmail, phone: userPhone });

    let res = buyerOrFilter
        ? await client
            .from('business_receipts')
            .select('id, receipt_number, shop_name, lifecycle_status, status_changed_at, status_reason, refunded_amount, gross_total, currency')
            .or(buyerOrFilter)
            .in('lifecycle_status', ['voided', 'refunded', 'partially_refunded'])
            .gte('status_changed_at', cutoff)
            .order('status_changed_at', { ascending: false })
        : { data: [], error: null };

    if (res.error && res.error.code === '42703' && userEmail) {
        res = await client
            .from('business_receipts')
            .select('id, receipt_number, shop_name, lifecycle_status, status_changed_at, status_reason, refunded_amount, gross_total, currency')
            .eq('customer_email', userEmail)
            .in('lifecycle_status', ['voided', 'refunded', 'partially_refunded'])
            .gte('status_changed_at', cutoff)
            .order('status_changed_at', { ascending: false });
    }

    const { data, error } = res;
    if (error) {
        // 42703: lifecycle columns not migrated yet — fail gracefully without breaking notifications
        if (error.code !== '42703') logError('notif:lifecycleReceipts', error);
        return [];
    }
    return data || [];
}

function buildLifecycleNotifications(receipts, t) {
    const lang = getNotifLang();
    return (receipts || []).map(r => {
        const lc = r.lifecycle_status || 'voided';
        const receiptNum = escapeHtml(r.receipt_number ? `#RCP-${r.receipt_number}` : `#${String(r.id).slice(0, 8).toUpperCase()}`);
        const shopName = escapeHtml(r.shop_name || '—');
        const reasonPart = r.status_reason
            ? ` ${escapeHtml(t.lifecycle_reason_prefix || 'Причина:')} ${escapeHtml(r.status_reason)}`
            : '';
        const currency = r.currency || 'EUR';
        const rawAmount = lc === 'partially_refunded'
            ? (parseFloat(r.refunded_amount) || 0)
            : (parseFloat(r.gross_total) || 0);
        const amountStr = typeof window.formatCurrency === 'function'
            ? escapeHtml(window.formatCurrency(rawAmount, currency, lang))
            : escapeHtml(`${rawAmount.toFixed(2)} ${currency}`);

        if (lc === 'voided') {
            return {
                type: 'lifecycle-voided',
                icon: 'fa-ban',
                title: (t.notif_receipt_voided_title || 'Чек {num} аннулирован').replace('{num}', () => receiptNum),
                text: (t.notif_receipt_voided_text || 'Магазин «{shop}» аннулировал чек.{reason}')
                    .replace('{shop}', () => shopName)
                    .replace('{reason}', () => reasonPart),
                date: r.status_changed_at ? formatDate(r.status_changed_at) : ''
            };
        }

        if (lc === 'partially_refunded') {
            return {
                type: 'lifecycle-partial',
                icon: 'fa-rotate-left',
                title: (t.notif_receipt_partial_title || 'Частичный возврат по чеку {num}').replace('{num}', () => receiptNum),
                text: (t.notif_receipt_partial_text || 'Магазин «{shop}» вернул часть позиций ({amount}).{reason}')
                    .replace('{shop}', () => shopName)
                    .replace('{amount}', () => amountStr)
                    .replace('{reason}', () => reasonPart),
                date: r.status_changed_at ? formatDate(r.status_changed_at) : ''
            };
        }

        return {
            type: 'lifecycle-refunded',
            icon: 'fa-rotate-left',
            title: (t.notif_receipt_refunded_title || 'Возврат по чеку {num}').replace('{num}', () => receiptNum),
            text: (t.notif_receipt_refunded_text || 'Магазин «{shop}» оформил полный возврат ({amount}).{reason}')
                .replace('{shop}', () => shopName)
                .replace('{amount}', () => amountStr)
                .replace('{reason}', () => reasonPart),
            date: r.status_changed_at ? formatDate(r.status_changed_at) : ''
        };
    });
}

async function computeActiveAlertsCount(userId, userEmail, client) {
    const [profileRes, lifecycleReceipts] = await Promise.all([
        client.from('profiles').select('expiry_alerts').eq('id', userId).single(),
        fetchRecentLifecycleReceipts(userId, userEmail, client)
    ]);

    let count = lifecycleReceipts.length;
    const expiryAlertsEnabled = profileRes.data?.expiry_alerts ?? true;
    if (!expiryAlertsEnabled) return count;

    const { data: items, error } = await client
        .from('items')
        .select('warranty_end_date')
        .eq('user_id', userId);

    if (error || !items) return count;

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
        const count = await computeActiveAlertsCount(auth.user.id, auth.user.email, auth.client);
        updateNotifBadge(count);
    } catch (e) {
        logError('notif:badgeRefresh', e);
    }
}

async function loadNotifications(userId, userEmail, client) {
    const container = document.getElementById('notifications-container');
    if (!container) return;

    const checkingText = window.dashboardTranslations?.[localStorage.getItem('valuon-lang') || 'ru']?.notif_checking || 'Проверка статусов...';
    container.innerHTML = `<div class="loading-state"><i class="fa-solid fa-circle-notch fa-spin"></i> ${checkingText}</div>`;

    const [profileRes, itemsRes, lifecycleReceipts] = await Promise.all([
        client.from('profiles').select('expiry_alerts').eq('id', userId).single(),
        client.from('items').select('name, purchase_date, warranty_end_date').eq('user_id', userId).order('purchase_date', { ascending: false }),
        fetchRecentLifecycleReceipts(userId, userEmail, client)
    ]);

    const t = getNotifT();
    const expiryAlertsEnabled = profileRes.data?.expiry_alerts ?? true;
    const items = itemsRes.data || [];

    if (itemsRes.error) {
        logError('notif:load', itemsRes.error);
        container.innerHTML = `<div class="empty-state error">${t.msg_save_error || 'Error loading notifications'}</div>`;
        return;
    }

    const notifications = buildLifecycleNotifications(lifecycleReceipts, t);

    if (expiryAlertsEnabled && items.length > 0) {
        items.forEach(item => {
            if (!item.warranty_end_date) return;
            const daysLeft = calculateDaysLeft(item.warranty_end_date);

            if (daysLeft > 0 && daysLeft <= 30) {
                notifications.push({
                    type: 'warning',
                    icon: 'fa-triangle-exclamation',
                    title: (t.notif_expiring_title || 'Warranty for "{name}" is expiring').replace('{name}', () => escapeHtml(item.name)),
                    text: (t.notif_expiring_text || '{count} days left. Check device condition.').replace('{count}', daysLeft),
                    date: formatDate(new Date().toISOString())
                });
            } else if (daysLeft <= 0) {
                const absDays = Math.abs(daysLeft);
                notifications.push({
                    type: 'expired',
                    icon: 'fa-circle-xmark',
                    title: (t.notif_expired_title || 'Warranty for "{name}" has expired').replace('{name}', () => escapeHtml(item.name)),
                    text: (t.notif_expired_text || 'Expired {count} days ago.').replace('{count}', absDays),
                    date: formatDate(item.purchase_date)
                });
            }
        });
    }

    if (notifications.length === 0) {
        if (!expiryAlertsEnabled) {
            container.innerHTML = `
                <div class="notification-card info">
                    <div class="notif-icon"><i class="fa-solid fa-bell-slash"></i></div>
                    <div class="notif-content">
                        <h4>${t.notif_disabled_title || 'Notifications disabled'}</h4>
                        <p>${t.notif_disabled_desc || 'Enable warranty reminders in Settings to see alerts here.'}</p>
                    </div>
                </div>`;
        } else if (items.length === 0) {
            container.innerHTML = `
                <div class="notification-card info">
                    <div class="notif-icon"><i class="fa-solid fa-database"></i></div>
                    <div class="notif-content">
                        <h4>${t.notif_empty_title || 'No items yet'}</h4>
                        <p>${t.notif_empty_desc || 'Add at least one item to receive notifications.'}</p>
                    </div>
                </div>`;
        } else {
            container.innerHTML = `
                <div class="notification-card info">
                    <div class="notif-icon"><i class="fa-solid fa-check-circle"></i></div>
                    <div class="notif-content">
                        <h4>${t.notif_all_good_title || 'All good!'}</h4>
                        <p>${(t.notif_all_good_text || 'You have {count} items and none expire within 30 days.').replace('{count}', items.length)}</p>
                    </div>
                </div>`;
        }
    } else {
        container.innerHTML = notifications.map(n => `
            <div class="notification-card ${n.type}">
                <div class="notif-icon"><i class="fa-solid ${n.icon}"></i></div>
                <div class="notif-content">
                    <h4>${n.title}</h4>
                    <p>${n.text}</p>
                    ${n.date ? `<span class="notif-time">${n.date}</span>` : ''}
                </div>
            </div>
        `).join('');
    }

    updateNotifBadge(notifications.length);
}

let notifInitialized = false;

let cachedUserId = null;
let cachedUserEmail = null;
let cachedClient = null;

async function ensureNotifLoaded() {
    if (notifInitialized) return;
    try {
        const auth = await requireAuth();
        if (!auth) return;
        cachedUserId = auth.user.id;
        cachedUserEmail = auth.user.email;
        cachedClient = auth.client;
        await loadNotifications(auth.user.id, auth.user.email, auth.client);
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
            await loadNotifications(cachedUserId, cachedUserEmail, cachedClient);
        } catch (e) {
            logError('notif:reloadLang', e);
        }
    }
});

window.addEventListener('phone-changed', async () => {
    if (notifInitialized && cachedUserId && cachedClient) {
        try {
            await loadNotifications(cachedUserId, cachedUserEmail, cachedClient);
        } catch (e) {
            logError('notif:reloadPhone', e);
        }
    } else {
        refreshNotifBadge();
    }
});

(async function initNotifBadge() {
    try {
        const auth = await requireAuth();
        if (!auth) return;
        const count = await computeActiveAlertsCount(auth.user.id, auth.user.email, auth.client);
        updateNotifBadge(count);
    } catch (e) {
        logError('notif:badgeInit', e);
    }
})();