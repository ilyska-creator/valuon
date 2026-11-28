import { requireAuth } from './dashboard-auth.js';
import { escapeHtml, logError } from './security.js';
import { calculateDaysLeft, parseLocalDate } from './warranty-utils.js';
import { collapseAndRemove, haptic, pulseHighlight, ringNotificationBell } from './ui-effects.js';

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
    const label = safeCount > 99 ? '99+' : String(safeCount);
    document.querySelectorAll('[data-notif-badge]').forEach(el => {
        if (safeCount > 0) {
            el.textContent = label;
            el.classList.remove('hidden');
        } else {
            el.textContent = '';
            el.classList.add('hidden');
        }
    });
    const baseTitle = document.title.replace(/^\(\d+\+?\)\s*/, '');
    document.title = safeCount > 0 ? `(${label}) ${baseTitle}` : baseTitle;
    const markAllBtn = document.getElementById('notif-mark-all-read-btn');
    if (markAllBtn) {
        markAllBtn.classList.toggle('hidden', safeCount === 0);
    }
    const chipCount = document.getElementById('notif-unread-chip-count');
    if (chipCount) {
        chipCount.textContent = label;
        chipCount.classList.toggle('hidden', safeCount === 0);
    }
}

function formatDbNotification(row, t) {
    const p = row.payload || {};
    const type = row.type;
    const isUnread = !row.read_at;

    if (type === 'weekly_digest') {
        const active = Number(p.active_warranties) || 0;
        const expiring = Number(p.expiring_30d) || 0;
        const receipts = Number(p.new_receipts_7d) || 0;
        return {
            id: row.id,
            isUnread,
            cardClass: 'weekly-digest',
            icon: 'fa-chart-pie',
            title: t.notif_digest_title || 'Еженедельная сводка',
            text: (t.notif_digest_text || 'Активных гарантий: {active} · Истекают за 30 дн.: {expiring} · Новых чеков: {receipts}')
                .replace('{active}', String(active))
                .replace('{expiring}', String(expiring))
                .replace('{receipts}', String(receipts)),
            date: formatDate(row.created_at),
            quickAction: null,
        };
    }

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
let currentNotifFilter = 'all';

function matchesNotifFilter(row) {
    if (currentNotifFilter === 'unread') return !row.read_at;
    if (currentNotifFilter === 'receipts') return row.type?.startsWith('receipt_');
    if (currentNotifFilter === 'warranties') return row.type?.startsWith('warranty_');
    return true;
}

function renderNotificationsList(container) {
    const t = getNotifT();
    const dismissTitle = escapeHtml(t.notif_dismiss_title || 'Dismiss');
    const unreadCount = cachedNotifications.filter(n => !n.read_at).length;
    updateNotifBadge(unreadCount);

    const visibleRows = cachedNotifications.filter(matchesNotifFilter);

    if (visibleRows.length === 0) {
        if (cachedNotifications.length > 0 && currentNotifFilter !== 'all') {
            container.innerHTML = `
                <div class="notification-card info">
                    <div class="notif-icon"><i class="fa-solid fa-filter"></i></div>
                    <div class="notif-content">
                        <h4>${escapeHtml(t.notif_filter_empty || 'No notifications in this category.')}</h4>
                    </div>
                </div>`;
        } else if (!cachedExpiryAlertsEnabled) {
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

    const cards = visibleRows.map(row => formatDbNotification(row, t));
    const disabledBanner = !cachedExpiryAlertsEnabled && (currentNotifFilter === 'all' || currentNotifFilter === 'warranties')
        ? `
            <div class="notification-card info">
                <div class="notif-icon"><i class="fa-solid fa-bell-slash"></i></div>
                <div class="notif-content">
                    <h4>${escapeHtml(t.notif_disabled_title || 'Notifications disabled')}</h4>
                    <p>${escapeHtml(t.notif_disabled_desc || 'Enable warranty reminders in Settings to see alerts here.')}</p>
                </div>
            </div>`
        : '';

    const calLabel = escapeHtml(t.notif_action_calendar || 'Add to calendar');
    const openRecLabel = escapeHtml(t.notif_action_open_receipt || 'Open receipt');

    container.innerHTML = disabledBanner + cards.map((n, idx) => {
        const row = visibleRows[idx];
        const eType = row?.entity_type || '';
        const eId = row?.entity_id || '';
        const rId = row?.payload?.receipt_id || (eType === 'business_receipt' ? eId : '');
        const isWarrantyActive = row?.type?.startsWith('warranty_expiring_') && row?.payload?.warranty_end_date;
        const isReceiptNotif = row?.type?.startsWith('receipt_') && rId;

        let actionsHtml = '';
        if (isWarrantyActive) {
            actionsHtml = `
                <div class="notif-card-actions">
                    <button type="button" class="notif-quick-btn" data-notif-calendar="${escapeHtml(n.id)}">
                        <i class="fa-regular fa-calendar-plus" aria-hidden="true"></i>
                        <span>${calLabel}</span>
                    </button>
                </div>`;
        } else if (isReceiptNotif) {
            actionsHtml = `
                <div class="notif-card-actions">
                    <button type="button" class="notif-quick-btn" data-notif-open-receipt="${escapeHtml(rId)}" data-notif-id-ref="${escapeHtml(n.id)}">
                        <i class="fa-solid fa-receipt" aria-hidden="true"></i>
                        <span>${openRecLabel}</span>
                    </button>
                </div>`;
        }

        return `
        <div class="notification-card ${n.cardClass} ${n.isUnread ? 'is-unread' : 'is-read'}" data-notif-id="${escapeHtml(n.id)}" data-entity-type="${escapeHtml(eType)}" data-entity-id="${escapeHtml(eId)}" data-receipt-id="${escapeHtml(rId)}">
            <div class="notif-icon"><i class="fa-solid ${n.icon}"></i></div>
            <div class="notif-content">
                <h4>${n.title}</h4>
                <p>${n.text}</p>
                ${n.date ? `<span class="notif-time">${n.date}</span>` : ''}
                ${actionsHtml}
            </div>
            ${n.isUnread ? '<span class="notif-unread-dot" aria-hidden="true"></span>' : ''}
            <button type="button" class="notif-dismiss-btn" data-notif-dismiss="${escapeHtml(n.id)}" title="${dismissTitle}" aria-label="${dismissTitle}">
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
        </div>
    `;
    }).join('');
}

let notifActionsBound = false;

function bindNotificationActions(container) {
    if (notifActionsBound) return;
    notifActionsBound = true;

    const dismissNotification = async (id, cardEl) => {
        if (!id || !cachedClient) return;
        haptic(8);
        const nowIso = new Date().toISOString();
        const prev = cachedNotifications;
        cachedNotifications = cachedNotifications.filter(n => n.id !== id);
        updateNotifBadge(cachedNotifications.filter(n => !n.read_at).length);

        collapseAndRemove(cardEl, () => {
            renderNotificationsList(container);
        });

        const { error } = await cachedClient
            .from('notifications')
            .update({ dismissed_at: nowIso, read_at: nowIso })
            .eq('id', id);
        if (error) {
            logError('notif:dismiss', error);
            cachedNotifications = prev;
            renderNotificationsList(container);
        }
    };

    const markOneRead = (id) => {
        if (!id || !cachedClient) return;
        const target = cachedNotifications.find(n => n.id === id);
        if (!target || target.read_at) return;
        const nowIso = new Date().toISOString();
        target.read_at = nowIso;
        renderNotificationsList(container);
        cachedClient
            .from('notifications')
            .update({ read_at: nowIso })
            .eq('id', id)
            .then(({ error }) => {
                if (error) logError('notif:markRead', error);
            });
    };

    const filterBar = document.getElementById('notif-filter-bar');
    filterBar?.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-notif-filter]');
        if (!chip) return;
        const nextFilter = chip.getAttribute('data-notif-filter') || 'all';
        if (nextFilter === currentNotifFilter) return;
        currentNotifFilter = nextFilter;
        haptic(8);
        filterBar.querySelectorAll('[data-notif-filter]').forEach((el) => {
            const active = el === chip;
            el.classList.toggle('active', active);
            el.setAttribute('aria-selected', String(active));
        });
        renderNotificationsList(container);
    });

    // Mobile swipe-left to dismiss
    let swipeCard = null;
    let swipeStartX = 0;
    let swipeStartY = 0;
    let swipeStartTime = 0;
    let swipeLocked = false;
    let swipeDx = 0;

    container.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        if (e.target.closest('button, a')) return;
        const card = e.target.closest('.notification-card[data-notif-id]');
        if (!card) return;
        swipeCard = card;
        swipeStartX = e.touches[0].clientX;
        swipeStartY = e.touches[0].clientY;
        swipeStartTime = performance.now();
        swipeLocked = false;
        swipeDx = 0;
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
        if (!swipeCard || e.touches.length !== 1) return;
        const dx = e.touches[0].clientX - swipeStartX;
        const dy = e.touches[0].clientY - swipeStartY;
        if (!swipeLocked) {
            if (Math.abs(dy) > Math.abs(dx) || dx > -10) {
                if (Math.abs(dy) > 10) swipeCard = null;
                return;
            }
            swipeLocked = true;
            swipeCard.classList.add('is-swiping');
        }
        if (dx < 0) {
            swipeDx = dx;
            const opacity = Math.max(0.25, 1 + dx / 240);
            swipeCard.style.transform = `translateX(${dx}px)`;
            swipeCard.style.opacity = String(opacity);
        }
    }, { passive: true });

    const finishSwipe = () => {
        if (!swipeCard) return;
        const card = swipeCard;
        const dx = swipeDx;
        const elapsed = Math.max(1, performance.now() - swipeStartTime);
        const fastSwipe = dx < -45 && (Math.abs(dx) / elapsed) > 0.35;
        swipeCard = null;
        swipeLocked = false;
        swipeDx = 0;
        card.classList.remove('is-swiping');

        if (dx < -90 || fastSwipe) {
            const id = card.getAttribute('data-notif-id');
            haptic(10);
            dismissNotification(id, card);
        } else {
            card.style.transform = '';
            card.style.opacity = '';
        }
    };

    container.addEventListener('touchend', finishSwipe, { passive: true });
    container.addEventListener('touchcancel', finishSwipe, { passive: true });

    container.addEventListener('click', async (e) => {
        if (!cachedClient) return;

        const calBtn = e.target.closest('[data-notif-calendar]');
        if (calBtn) {
            e.stopPropagation();
            const id = calBtn.getAttribute('data-notif-calendar');
            const row = cachedNotifications.find(n => n.id === id);
            if (!row?.payload?.warranty_end_date) return;
            haptic(10);
            markOneRead(id);
            try {
                const { downloadICS } = await import('./calendar-export.js');
                downloadICS({
                    name: row.payload.item_name || 'Item',
                    warranty_end_date: row.payload.warranty_end_date,
                    purchase_date: row.payload.purchase_date,
                    store_name: row.payload.shop_name || '',
                });
            } catch (err) {
                logError('notif:calendar', err);
            }
            return;
        }

        const openRecBtn = e.target.closest('[data-notif-open-receipt]');
        if (openRecBtn) {
            e.stopPropagation();
            const receiptId = openRecBtn.getAttribute('data-notif-open-receipt');
            const notifId = openRecBtn.getAttribute('data-notif-id-ref');
            if (notifId) markOneRead(notifId);
            if (receiptId) {
                haptic(8);
                const receiptsNav = document.querySelector('[data-view="receipts"]');
                if (receiptsNav) {
                    receiptsNav.click();
                    import('./receipts.js?v=20261128a')
                        .then((m) => m.highlightReceiptCard(receiptId))
                        .catch((err) => logError('notif:openReceipt', err));
                } else {
                    window.location.href = `dashboard.html?highlight=${encodeURIComponent(receiptId)}#view-receipts`;
                }
            }
            return;
        }

        const dismissBtn = e.target.closest('[data-notif-dismiss]');
        if (dismissBtn) {
            e.stopPropagation();
            const id = dismissBtn.getAttribute('data-notif-dismiss');
            const cardEl = dismissBtn.closest('.notification-card');
            dismissNotification(id, cardEl);
            return;
        }

        const card = e.target.closest('.notification-card[data-notif-id]');
        if (card) {
            const id = card.getAttribute('data-notif-id');
            const entityType = card.getAttribute('data-entity-type') || '';
            const entityId = card.getAttribute('data-entity-id') || '';
            const receiptId = card.getAttribute('data-receipt-id') || '';

            if (id) markOneRead(id);

            if ((entityType === 'business_receipt' || entityType === 'receipt_item') && receiptId) {
                haptic(8);
                const receiptsNav = document.querySelector('[data-view="receipts"]');
                if (receiptsNav) {
                    receiptsNav.click();
                    import('./receipts.js?v=20261128a')
                        .then((m) => m.highlightReceiptCard(receiptId))
                        .catch((err) => logError('notif:openReceipt', err));
                } else {
                    window.location.href = `dashboard.html?highlight=${encodeURIComponent(receiptId)}#view-receipts`;
                }
                return;
            }

            if (entityType === 'item' && entityId) {
                haptic(8);
                const itemsNav = document.querySelector('[data-view="items"]');
                if (itemsNav) {
                    itemsNav.click();
                    const mineTab = document.querySelector('[data-items-tab="mine"]');
                    if (mineTab) mineTab.click();
                    setTimeout(() => {
                        const itemCard = document.querySelector(`#items-grid-mine .item-card[data-item-id="${CSS.escape(entityId)}"], #items-grid-mine [data-id="${CSS.escape(entityId)}"]`)?.closest('.item-card');
                        if (itemCard) pulseHighlight(itemCard);
                    }, 120);
                } else {
                    window.location.href = `dashboard.html?highlight_item=${encodeURIComponent(entityId)}`;
                }
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

let realtimeNotifChannel = null;

function subscribeRealtimeNotifications(userId, client) {
    if (realtimeNotifChannel || !userId || !client?.channel) return;
    realtimeNotifChannel = client
        .channel(`notif-live-${userId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${userId}`,
            },
            async (payload) => {
                const row = payload?.new;
                if (!row || row.dismissed_at) return;
                if (row.type?.startsWith('warranty_') && !cachedExpiryAlertsEnabled) return;

                haptic(12);
                ringNotificationBell();

                if (notifInitialized) {
                    if (!cachedNotifications.some(n => n.id === row.id)) {
                        cachedNotifications = [row, ...cachedNotifications].slice(0, 50);
                        const container = document.getElementById('notifications-container');
                        if (container) renderNotificationsList(container);
                    }
                } else {
                    const count = await computeActiveAlertsCount(userId, client);
                    updateNotifBadge(count);
                }

                // Live-sync verified items, warranty stats, and receipts on issue/refund/void
                if (typeof row.type === 'string' && row.type.startsWith('receipt_')) {
                    window.dispatchEvent(new CustomEvent('valuon:receipts-updated', { detail: row }));
                }
            }
        )
        .subscribe();

    window.addEventListener('beforeunload', () => {
        if (realtimeNotifChannel && client?.removeChannel) {
            client.removeChannel(realtimeNotifChannel);
            realtimeNotifChannel = null;
        }
    });
}

if (startsOnNotifView) {
    ensureNotifLoaded().then(() => {
        if (cachedUserId && cachedClient) subscribeRealtimeNotifications(cachedUserId, cachedClient);
    });
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
            cachedUserId = auth.user.id;
            cachedClient = auth.client;
            cachedExpiryAlertsEnabled = await getExpiryAlertsEnabled(auth.user.id, auth.client);
            const count = await computeActiveAlertsCount(auth.user.id, auth.client);
            updateNotifBadge(count);
            subscribeRealtimeNotifications(auth.user.id, auth.client);
        } catch (e) {
            logError('notif:badgeInit', e);
        }
    })();
}
