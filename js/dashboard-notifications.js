import { requireAuth } from './dashboard-auth.js';
import { escapeHtml, logError } from './security.js';
import { calculateDaysLeft, parseLocalDate } from './warranty-utils.js';

function getNotifLang() {
    return (window.getValuonLang ? window.getValuonLang() : 'en');
}

function getNotifT() {
    const lang = getNotifLang();
    return window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const lang = getNotifLang();
    const locale = lang === 'ru' ? 'ru-RU' : 'en-US';
    const date = parseLocalDate(dateStr);
    if (!date) return '';
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'numeric', year: 'numeric' });
}

function formatAmount(rawVal, currency) {
    const num = parseFloat(rawVal) || 0;
    const cur = currency || 'EUR';
    const lang = getNotifLang();
    if (typeof window.formatCurrency === 'function') {
        return escapeHtml(window.formatCurrency(num, cur, lang));
    }
    return escapeHtml(`${num.toFixed(2)} ${cur}`);
}

function updateNotifBadge(count) {
    const safeCount = Math.max(0, Number(count) || 0);
    document.querySelectorAll('[data-notif-badge]').forEach(el => {
        if (safeCount > 0) {
            el.textContent = safeCount > 99 ? '99+' : String(safeCount);
            el.classList.remove('hidden');
        } else {
            el.textContent = '';
            el.classList.add('hidden');
        }
    });
    const markAllBtn = document.getElementById('notif-mark-all-read-btn');
    if (markAllBtn) {
        markAllBtn.classList.toggle('hidden', safeCount === 0);
    }
}

function formatDbNotification(row, t) {
    const p = row.payload || {};
    const type = row.type;
    const isUnread = !row.read_at;

    if (type === 'receipt_issued' || type === 'receipt_voided' || type === 'receipt_refunded' || type === 'receipt_partially_refunded') {
        const receiptNum = escapeHtml(
            p.receipt_number
                ? `#RCP-${p.receipt_number}`
                : `#${String(p.receipt_id || row.entity_id || '').slice(0, 8).toUpperCase()}`
        );
        const shopName = escapeHtml(p.shop_name || '—');
        const reasonPart = p.reason
            ? ` ${escapeHtml(t.lifecycle_reason_prefix || 'Причина:')} ${escapeHtml(p.reason)}`
            : '';
        const currency = p.currency || 'EUR';

        if (type === 'receipt_issued') {
            const amountStr = formatAmount(p.gross_total, currency);
            return {
                id: row.id,
                isUnread,
                cardClass: 'receipt-issued',
                icon: 'fa-receipt',
                title: (t.notif_receipt_issued_title || 'Новый чек {num}').replace('{num}', () => receiptNum),
                text: (t.notif_receipt_issued_text || 'Магазин «{shop}» выписал чек на сумму {amount}.')
                    .replace('{shop}', () => shopName)
                    .replace('{amount}', () => amountStr),
                date: formatDate(p.purchase_date || row.created_at)
            };
        }

        if (type === 'receipt_voided') {
            return {
                id: row.id,
                isUnread,
                cardClass: 'lifecycle-voided',
                icon: 'fa-ban',
                title: (t.notif_receipt_voided_title || 'Чек {num} аннулирован').replace('{num}', () => receiptNum),
                text: (t.notif_receipt_voided_text || 'Магазин «{shop}» аннулировал чек.{reason}')
                    .replace('{shop}', () => shopName)
                    .replace('{reason}', () => reasonPart),
                date: formatDate(p.status_changed_at || row.created_at)
            };
        }

        if (type === 'receipt_partially_refunded') {
            const amountStr = formatAmount(p.amount_delta ?? p.refunded_amount, currency);
            return {
                id: row.id,
                isUnread,
                cardClass: 'lifecycle-partial',
                icon: 'fa-rotate-left',
                title: (t.notif_receipt_partial_title || 'Частичный возврат по чеку {num}').replace('{num}', () => receiptNum),
                text: (t.notif_receipt_partial_text || 'Магазин «{shop}» вернул часть позиций ({amount}).{reason}')
                    .replace('{shop}', () => shopName)
                    .replace('{amount}', () => amountStr)
                    .replace('{reason}', () => reasonPart),
                date: formatDate(p.status_changed_at || row.created_at)
            };
        }

        const amountStr = formatAmount(p.gross_total ?? p.refunded_amount, currency);
        return {
            id: row.id,
            isUnread,
            cardClass: 'lifecycle-refunded',
            icon: 'fa-rotate-left',
            title: (t.notif_receipt_refunded_title || 'Возврат по чеку {num}').replace('{num}', () => receiptNum),
            text: (t.notif_receipt_refunded_text || 'Магазин «{shop}» оформил полный возврат ({amount}).{reason}')
                .replace('{shop}', () => shopName)
                .replace('{amount}', () => amountStr)
                .replace('{reason}', () => reasonPart),
            date: formatDate(p.status_changed_at || row.created_at)
        };
    }

    // Warranty notifications (compute live daysLeft from warranty_end_date)
    const baseName = p.item_name || t.item_name_unknown || 'Товар';
    const activeQty = Number(p.active_qty || 1);
    const displayName = p.is_partner && activeQty > 1 ? `${baseName} ×${activeQty}` : baseName;
    const shopMeta = p.is_partner && p.shop_name ? escapeHtml(p.shop_name) : '';
    const datePart = p.warranty_end_date ? formatDate(p.warranty_end_date) : formatDate(p.purchase_date || row.created_at);
    const metaDate = shopMeta && datePart ? `${shopMeta} · ${datePart}` : (shopMeta || datePart);

    const daysLeft = p.warranty_end_date ? calculateDaysLeft(p.warranty_end_date) : (type === 'warranty_expired' ? -1 : 0);

    if (daysLeft < 0 || type === 'warranty_expired') {
        const absDays = Math.max(1, Math.abs(daysLeft));
        return {
            id: row.id,
            isUnread,
            cardClass: 'expired',
            icon: 'fa-circle-xmark',
            title: (t.notif_expired_title || 'Warranty for "{name}" has expired').replace('{name}', () => escapeHtml(displayName)),
            text: (t.notif_expired_text || 'Expired {count} days ago.').replace('{count}', String(absDays)),
            date: metaDate
        };
    }

    const isToday = daysLeft === 0;
    return {
        id: row.id,
        isUnread,
        cardClass: 'warning',
        icon: 'fa-triangle-exclamation',
        title: (isToday
            ? (t.notif_expires_today_title || 'Warranty for "{name}" expires today')
            : (t.notif_expiring_title || 'Warranty for "{name}" is expiring')
        ).replace('{name}', () => escapeHtml(displayName)),
        text: isToday
            ? (t.notif_expires_today_text || 'Last day of warranty. Check device condition.')
            : (t.notif_expiring_text || '{count} days left. Check device condition.').replace('{count}', String(daysLeft)),
        date: metaDate
    };
}

async function getExpiryAlertsEnabled(userId, client) {
    const { data } = await client
        .from('profiles')
        .select('expiry_alerts')
        .eq('id', userId)
        .maybeSingle();
    return data?.expiry_alerts ?? true;
}

async function computeActiveAlertsCount(userId, client) {
    const expiryAlertsEnabled = await getExpiryAlertsEnabled(userId, client);
    let query = client
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null)
        .is('dismissed_at', null);

    if (!expiryAlertsEnabled) {
        query = query.not('type', 'like', 'warranty_%');
    }

    const { count, error } = await query;
    if (error) {
        logError('notif:unreadCount', error);
        return 0;
    }
    return count || 0;
}

let cachedNotifications = [];
let cachedExpiryAlertsEnabled = true;

function renderNotificationsList(container) {
    const t = getNotifT();
    const dismissTitle = escapeHtml(t.notif_dismiss_title || 'Dismiss');
    const unreadCount = cachedNotifications.filter(n => !n.read_at).length;
    updateNotifBadge(unreadCount);

    if (cachedNotifications.length === 0) {
        if (!cachedExpiryAlertsEnabled) {
            container.innerHTML = `
                <div class="notification-card info">
                    <div class="notif-icon"><i class="fa-solid fa-bell-slash"></i></div>
                    <div class="notif-content">
                        <h4>${escapeHtml(t.notif_disabled_title || 'Notifications disabled')}</h4>
                        <p>${escapeHtml(t.notif_disabled_desc || 'Enable warranty reminders in Settings to see alerts here.')}</p>
                    </div>
                </div>`;
        } else {
            container.innerHTML = `
                <div class="notification-card info">
                    <div class="notif-icon"><i class="fa-solid fa-check-circle"></i></div>
                    <div class="notif-content">
                        <h4>${escapeHtml(t.notif_none_title || t.notif_all_good_title || 'All good!')}</h4>
                        <p>${escapeHtml(t.notif_none_desc || '')}</p>
                    </div>
                </div>`;
        }
        return;
    }

    const cards = cachedNotifications.map(row => formatDbNotification(row, t));
    const disabledBanner = !cachedExpiryAlertsEnabled
        ? `
            <div class="notification-card info">
                <div class="notif-icon"><i class="fa-solid fa-bell-slash"></i></div>
                <div class="notif-content">
                    <h4>${escapeHtml(t.notif_disabled_title || 'Notifications disabled')}</h4>
                    <p>${escapeHtml(t.notif_disabled_desc || 'Enable warranty reminders in Settings to see alerts here.')}</p>
                </div>
            </div>`
        : '';

    container.innerHTML = disabledBanner + cards.map(n => `
        <div class="notification-card ${n.cardClass} ${n.isUnread ? 'is-unread' : 'is-read'}" data-notif-id="${escapeHtml(n.id)}">
            <div class="notif-icon"><i class="fa-solid ${n.icon}"></i></div>
            <div class="notif-content">
                <h4>${n.title}</h4>
                <p>${n.text}</p>
                ${n.date ? `<span class="notif-time">${n.date}</span>` : ''}
            </div>
            ${n.isUnread ? '<span class="notif-unread-dot" aria-hidden="true"></span>' : ''}
            <button type="button" class="notif-dismiss-btn" data-notif-dismiss="${escapeHtml(n.id)}" title="${dismissTitle}" aria-label="${dismissTitle}">
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
        </div>
    `).join('');
}

let notifActionsBound = false;

function bindNotificationActions(container) {
    if (notifActionsBound) return;
    notifActionsBound = true;

    container.addEventListener('click', async (e) => {
        if (!cachedClient) return;

        const dismissBtn = e.target.closest('[data-notif-dismiss]');
        if (dismissBtn) {
            e.stopPropagation();
            const id = dismissBtn.getAttribute('data-notif-dismiss');
            if (!id) return;
            const nowIso = new Date().toISOString();
            const prev = cachedNotifications;
            cachedNotifications = cachedNotifications.filter(n => n.id !== id);
            renderNotificationsList(container);

            const { error } = await cachedClient
                .from('notifications')
                .update({ dismissed_at: nowIso, read_at: nowIso })
                .eq('id', id);
            if (error) {
                logError('notif:dismiss', error);
                cachedNotifications = prev;
                renderNotificationsList(container);
            }
            return;
        }

        const card = e.target.closest('.notification-card.is-unread[data-notif-id]');
        if (card) {
            const id = card.getAttribute('data-notif-id');
            if (!id) return;
            const nowIso = new Date().toISOString();
            const target = cachedNotifications.find(n => n.id === id);
            if (!target || target.read_at) return;
            target.read_at = nowIso;
            renderNotificationsList(container);

            const { error } = await cachedClient
                .from('notifications')
                .update({ read_at: nowIso })
                .eq('id', id);
            if (error) {
                logError('notif:markRead', error);
                target.read_at = null;
                renderNotificationsList(container);
            }
        }
    });

    const markAllBtn = document.getElementById('notif-mark-all-read-btn');
    markAllBtn?.addEventListener('click', async () => {
        if (!cachedClient || markAllBtn.disabled) return;
        const unreadIds = cachedNotifications.filter(n => !n.read_at).map(n => n.id);
        if (unreadIds.length === 0) return;

        markAllBtn.disabled = true;
        const nowIso = new Date().toISOString();
        const prevReadMap = new Map(cachedNotifications.map(n => [n.id, n.read_at]));
        cachedNotifications.forEach(n => { if (!n.read_at) n.read_at = nowIso; });
        renderNotificationsList(container);

        try {
            const { error } = await cachedClient
                .from('notifications')
                .update({ read_at: nowIso })
                .in('id', unreadIds);
            if (error) throw error;
            const t = getNotifT();
            if (typeof window.showToast === 'function') {
                window.showToast(t.notif_all_read || 'All notifications read', 'success');
            }
        } catch (err) {
            logError('notif:markAllRead', err);
            cachedNotifications.forEach(n => { n.read_at = prevReadMap.get(n.id) ?? null; });
            renderNotificationsList(container);
        } finally {
            markAllBtn.disabled = false;
        }
    });
}

export async function refreshNotifBadge() {
    try {
        const auth = await requireAuth();
        if (!auth) return;
        cachedUserId = auth.user.id;
        cachedClient = auth.client;
        if (notifInitialized) {
            await loadNotifications(auth.user.id, auth.client);
            currentNotifLang = getNotifLang();
        } else {
            const count = await computeActiveAlertsCount(auth.user.id, auth.client);
            updateNotifBadge(count);
        }
    } catch (e) {
        logError('notif:badgeRefresh', e);
    }
}

let loadNotificationsSeq = 0;

async function loadNotifications(userId, client) {
    const container = document.getElementById('notifications-container');
    if (!container) return;

    bindNotificationActions(container);
    const seq = ++loadNotificationsSeq;

    const checkingText = getNotifT().notif_checking || 'Проверка статусов...';
    container.innerHTML = `<div class="loading-state"><i class="fa-solid fa-circle-notch fa-spin"></i> ${escapeHtml(checkingText)}</div>`;

    const expiryAlertsEnabled = await getExpiryAlertsEnabled(userId, client);
    if (seq !== loadNotificationsSeq) return;

    let query = client
        .from('notifications')
        .select('id, type, severity, entity_type, entity_id, payload, read_at, created_at')
        .is('dismissed_at', null)
        .order('created_at', { ascending: false })
        .limit(50);

    if (!expiryAlertsEnabled) {
        query = query.not('type', 'like', 'warranty_%');
    }

    const { data, error } = await query;
    if (seq !== loadNotificationsSeq) return;

    if (error) {
        logError('notif:load', error);
        const t = getNotifT();
        container.innerHTML = `<div class="empty-state error">${escapeHtml(t.msg_save_error || 'Error loading notifications')}</div>`;
        return;
    }

    cachedExpiryAlertsEnabled = expiryAlertsEnabled;
    cachedNotifications = data || [];
    renderNotificationsList(container);
}

let notifInitialized = false;
let notifLoadPromise = null;
let currentNotifLang = getNotifLang();

let cachedUserId = null;
let cachedClient = null;

async function ensureNotifLoaded() {
    if (notifInitialized) return;
    if (notifLoadPromise) return notifLoadPromise;
    notifLoadPromise = (async () => {
        try {
            const auth = await requireAuth();
            if (!auth) return;
            cachedUserId = auth.user.id;
            cachedClient = auth.client;
            await loadNotifications(auth.user.id, auth.client);
            currentNotifLang = getNotifLang();
            notifInitialized = true;
        } catch (e) {
            logError('notif:load', e);
        } finally {
            notifLoadPromise = null;
        }
    })();
    return notifLoadPromise;
}

document.querySelectorAll('[data-view="notifications"]').forEach(el => {
    el.addEventListener('click', ensureNotifLoaded);
});

window.addEventListener('dashboard-view-changed', (e) => {
    if (e.detail?.viewId === 'view-notifications') {
        ensureNotifLoaded();
    }
});

const startsOnNotifView = window.location.hash === '#view-notifications'
    || window.__targetView === 'view-notifications'
    || sessionStorage.getItem('dashboard-view') === 'view-notifications';

if (startsOnNotifView) {
    ensureNotifLoaded();
}

window.addEventListener('lang-changed', () => {
    const newLang = getNotifLang();
    if (notifInitialized && newLang !== currentNotifLang) {
        currentNotifLang = newLang;
        const container = document.getElementById('notifications-container');
        if (container) renderNotificationsList(container);
    }
});

window.addEventListener('phone-changed', async () => {
    if (notifInitialized && cachedUserId && cachedClient) {
        try {
            await loadNotifications(cachedUserId, cachedClient);
        } catch (e) {
            logError('notif:reloadPhone', e);
        }
    } else {
        refreshNotifBadge();
    }
});

if (!startsOnNotifView) {
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
}
