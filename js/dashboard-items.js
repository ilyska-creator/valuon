import { requireAuth, setupLogout } from './dashboard-auth.js';
import { escapeHtml, logError } from './security.js';
import { downloadICS } from './calendar-export.js';
import { refreshNotifBadge } from './dashboard-notifications.js';
import { attachModalA11y } from './modal-a11y.js';
import { calculateDaysLeft } from './warranty-utils.js';

let currentClient = null;
let currentUserId = null;
let pendingDeleteItemId = null;
let verifiedStats = { total: 0, active: 0, expiring: 0, expired: 0 };
let lastMineItems = [];
let lastVerifiedItems = [];
let userDefaultCurrency = 'EUR';

function renderItemCurrencySelects() {
    const lang = localStorage.getItem('valuon-lang') || 'ru';
    document.querySelectorAll('#add-modal select[name="currency"], #edit-modal select[name="currency"]').forEach((select) => {
        if (typeof window.renderCurrencyOptions === 'function') window.renderCurrencyOptions(select, lang);
    });
    if (typeof CustomSelect !== 'undefined') CustomSelect.refreshAll();
}

function renderItemTypeSelects() {
    const lang = localStorage.getItem('valuon-lang') || 'ru';
    document.querySelectorAll('#add-modal select[name="type"], #edit-modal select[name="type"]').forEach((select) => {
        if (typeof window.renderDeviceTypeOptions === 'function') window.renderDeviceTypeOptions(select, lang);
    });
    if (typeof CustomSelect !== 'undefined') CustomSelect.refreshAll();
}

window.addEventListener('lang-changed', renderItemCurrencySelects);
window.addEventListener('lang-changed', renderItemTypeSelects);

// Настройки — отдельная вкладка того же SPA (dashboard.html), которая
// подгружается один раз при заходе на страницу. Без этого слушателя смена
// валюты по умолчанию в настройках не долетала бы до модалки добавления
// вещи до перезагрузки страницы.
window.addEventListener('currency-changed', (e) => {
    if (e.detail?.currency) userDefaultCurrency = e.detail.currency;
});

function applySavedItemsTab() {
    const saved = sessionStorage.getItem('valuon-items-tab') || 'verified';
    if (saved === 'verified') return;

    document.querySelector('#items-tabs .items-tab[data-items-tab="verified"]')?.classList.remove('active');
    document.querySelector('#items-tabs .items-tab[data-items-tab="verified"]')?.setAttribute('aria-selected', 'false');
    document.querySelector('#items-tabs .items-tab[data-items-tab="mine"]')?.classList.add('active');
    document.querySelector('#items-tabs .items-tab[data-items-tab="mine"]')?.setAttribute('aria-selected', 'true');

    document.getElementById('items-grid-verified')?.classList.add('hidden');
    document.getElementById('items-grid-mine')?.classList.remove('hidden');
}

async function initDashboardItems() {
    const auth = await requireAuth();
    if (!auth) return;

    currentClient = auth.client;
    currentUserId = auth.user.id;

    const { data: profile } = await auth.client
        .from('profiles')
        .select('currency')
        .eq('id', auth.user.id)
        .single();
    userDefaultCurrency = profile?.currency || 'EUR';
    renderItemCurrencySelects();
    renderItemTypeSelects();

    applySavedItemsTab();
    setupItemsTabs(auth.user.id, auth.user.email, auth.client);
    await loadItems(auth.user.id, auth.client);
    await loadVerifiedItems(auth.user.email, auth.client);
    setupModal(auth.client);
    setupEditModal(auth.client, auth.user.id);
    setupDeleteItemModal(auth.client, auth.user.id);
    setupLogout(auth.client);
}


async function loadItems(userId, client) {
    const grid = document.querySelector('#items-grid-mine');
    if (!grid) return;

    grid.innerHTML = '<div class="rotating-loader"></div>';
    const loaderEl = grid.querySelector('.rotating-loader');
    if (loaderEl && typeof RotatingTextLoader !== 'undefined') {
        const lang = localStorage.getItem('valuon-lang') || 'ru';
        const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
        new RotatingTextLoader(loaderEl, [
            t.loading_items || 'Загружаем покупки…',
            t.loading_items_check || 'Проверяем данные…',
            t.loading_items_update || 'Обновляем статусы…'
        ], { interval: 800 });
    }

    const { data: items, error } = await client
        .from('items')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        logError('items:load', error);
        const loadLang = localStorage.getItem('valuon-lang') || 'ru';
        grid.innerHTML = '<p class="empty-state error">' + (loadLang === 'en' ? 'Data load error.' : 'Ошибка загрузки данных.') + '</p>';
        return;
    }

    const safeItems = items || [];

    lastMineItems = safeItems;
    renderItems(safeItems);
    updateStats(safeItems);

    if (typeof window.applyDashboardLang === 'function') {
        window.applyDashboardLang(localStorage.getItem('valuon-lang') || 'ru');
    }
}

export { calculateDaysLeft };

function getStatusInfo(daysLeft) {
    if (daysLeft > 30) return { class: 'active' };
    if (daysLeft > 0) return { class: 'warning' };
    return { class: 'expired' };
}

// В БД «нет гарантии» кодируется двумя способами: warranty_months = 0
// либо (для старых/импортированных записей) дата окончания гарантии
// совпадает с датой покупки — оба случая нужно отличать от «гарантия истекла».
function isNoWarranty(item) {
    if (!item.warranty_months || item.warranty_months <= 0) return true;
    if (item.purchase_date && item.warranty_end_date
        && item.purchase_date.slice(0, 10) === item.warranty_end_date.slice(0, 10)) {
        return true;
    }
    return false;
}

function renderItems(items) {
    const grid = document.querySelector('#items-grid-mine');
    if (!grid) return;

    const lang = localStorage.getItem('valuon-lang') || 'ru';
    const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};

    const countEl = document.getElementById('items-count-mine');
    if (countEl) window.animateCount(countEl, items.length);

    if (items.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" data-animate="zoom">
                <div class="empty-icon"><i class="fa-solid fa-box-open"></i></div>
                <h3 data-i18n="empty_state_title">${escapeHtml(t.empty_state_title || 'Пока нет добавленных вещей')}</h3>
                <p data-i18n="empty_state">${escapeHtml(t.empty_state || 'Добавьте первую покупку — чек, гарантию, серийный номер.')}</p>
                <button type="button" class="btn btn-outline empty-state-cta" id="empty-add-item-btn">
                    <i class="fa-solid fa-plus"></i> <span data-i18n="empty_state_cta">${escapeHtml(t.empty_state_cta || 'Добавить вещь')}</span>
                </button>
            </div>`;

        document.getElementById('empty-add-item-btn')?.addEventListener('click', () => {
            document.getElementById('add-item-btn')?.click();
        });
        return;
    }

    grid.innerHTML = items.map(item => {
        const iconClass = window.DEVICE_ICONS[item.type] || window.DEVICE_ICONS.other;
        const noWarranty = isNoWarranty(item);
        const daysLeft = noWarranty ? null : calculateDaysLeft(item.warranty_end_date);
        const status = noWarranty ? null : getStatusInfo(daysLeft);
        const totalDays = (item.warranty_months || 12) * 30;
        const progress = noWarranty ? 0
            : totalDays > 0 ? Math.max(0, Math.min(100, (daysLeft / totalDays) * 100)) : 0;
        const statusClass = noWarranty ? 'none' : status.class;

        const stats = [];
        if (item.serial_number) {
            const shortSerial = item.serial_number.length > 10
                ? escapeHtml(item.serial_number.substring(0, 10)) + '…'
                : escapeHtml(item.serial_number);
            stats.push({ icon: 'fa-barcode', labelKey: 'stat_serial', fallback: 'Serial #', value: shortSerial });
        }
        if (item.store_name) {
            stats.push({ icon: 'fa-store', labelKey: 'stat_store', fallback: 'Store', value: escapeHtml(item.store_name) });
        }
        if (item.price && item.price > 0) {
            stats.push({ icon: 'fa-tag', labelKey: 'stat_price', fallback: 'Price', value: escapeHtml(window.formatCurrency(item.price, item.currency || 'EUR', lang)) });
        }
        let dateStr = '';
        if (item.purchase_date) {
            const d = item.purchase_date.slice(0, 10).split('-');
            dateStr = lang === 'ru' ? `${d[2]}.${d[1]}.${d[0]}` : `${d[1]}/${d[2]}/${d[0]}`;
            stats.push({ icon: 'fa-regular fa-calendar', labelKey: 'stat_date', fallback: 'Date', value: escapeHtml(dateStr) });
        }
        const statsHtml = stats.map(s => `
                        <div class="mine-stat${s.accent ? ' accent' : ''}">
                            <span class="mine-stat-icon"><i class="fa-solid ${s.icon}"></i></span>
                            <div class="mine-stat-text">
                                <div class="mine-stat-label" data-i18n="${s.labelKey}">${escapeHtml(t[s.labelKey] || s.fallback)}</div>
                                <div class="mine-stat-value" title="${s.value}">${s.value}</div>
                            </div>
                        </div>`).join('');

        const btnEditText = escapeHtml(t.btn_edit || 'Изменить');
        const btnDeleteText = escapeHtml(t.btn_delete || 'Удалить');
        const btnCalendarText = escapeHtml(t.add_to_calendar || 'В календарь');
        const calendarButtonHtml = item.warranty_end_date && daysLeft > 0 ? `
                        <button type="button" class="btn-action btn-add-calendar" data-id="${escapeHtml(item.id)}"
                                title="${btnCalendarText}" aria-label="${btnCalendarText}">
                            <i class="fa-solid fa-calendar-plus"></i>
                        </button>` : '';

        let progressSectionHtml;
        if (noWarranty) {
            progressSectionHtml = `
                        <div class="mine-progress">
                            <div class="mine-progress-top">
                                <span class="days-left-text none" data-i18n="no_warranty">${escapeHtml(t.no_warranty || 'No warranty')}</span>
                            </div>
                            <div class="no-warranty-track"><i class="fa-solid fa-shield-slash"></i></div>
                        </div>`;
        } else {
            const progressTextKey = daysLeft > 0 ? 'days_left' : 'warranty_expired_text';
            const untilLabel = escapeHtml(t.progress_until || 'until');
            const endD = item.warranty_end_date ? item.warranty_end_date.slice(0, 10).split('-') : null;
            const endDateStr = endD ? (lang === 'ru' ? `${endD[2]}.${endD[1]}.${endD[0]}` : `${endD[1]}/${endD[2]}/${endD[0]}`) : '';
            progressSectionHtml = `
                        <div class="mine-progress">
                            <div class="mine-progress-top">
                                <span class="days-left-text ${status.class}"
                                      data-i18n="${progressTextKey}"
                                      data-i18n-count="${daysLeft > 0 ? daysLeft : ''}"></span>
                                <span class="mine-progress-until">${endDateStr ? `<span data-i18n="progress_until">${untilLabel}</span> ${escapeHtml(endDateStr)}` : ''}</span>
                            </div>
                            <div class="mine-progress-track">
                                <div class="mine-progress-fill ${status.class}" data-progress="${progress}"></div>
                            </div>
                        </div>`;
        }

        return `
            <div class="mine-item-card is-${statusClass}" data-item-id="${escapeHtml(item.id)}">
                <div class="mine-item-header">
                    <div class="mine-item-icon"><i class="fa-solid ${iconClass}"></i></div>
                    <div class="mine-item-heading">
                        <h3 class="mine-item-title" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</h3>
                        <div class="mine-item-brand">${escapeHtml(item.brand) || escapeHtml(t.brand_not_specified || 'Brand not specified')}</div>
                    </div>
                </div>

                <div class="mine-item-body">
                    ${stats.length ? `<div class="mine-stats-grid">${statsHtml}</div>` : ''}

                    ${progressSectionHtml}

                    <div class="mine-item-actions">
                        ${calendarButtonHtml}
                        <button class="btn-action btn-edit-item" data-id="${escapeHtml(item.id)}" title="${btnEditText}">
                            <i class="fa-solid fa-pen"></i>
                            <span data-i18n="btn_edit">${btnEditText}</span>
                        </button>
                        <button class="btn-action btn-delete-item" data-id="${escapeHtml(item.id)}" title="${btnDeleteText}">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            grid.querySelectorAll('.mine-progress-fill[data-progress]').forEach(el => {
                const progress = parseFloat(el.dataset.progress);
                el.style.width = `${progress}%`;
                el.removeAttribute('data-progress');
            });
        });
    });

    grid.querySelectorAll('.btn-edit-item').forEach(btn => {
        btn.addEventListener('click', () => {
            openEditModal(btn.dataset.id, currentClient, currentUserId).catch(e => {
                logError('items:openEditModal', e);
            });
        });
    });

    grid.querySelectorAll('.btn-delete-item').forEach(btn => {
        btn.addEventListener('click', () => {
            pendingDeleteItemId = btn.dataset.id;
            document.getElementById('delete-item-modal')?.classList.add('active');
            document.documentElement.classList.add('modal-open');
        });
    });

    grid.querySelectorAll('.btn-add-calendar').forEach(btn => {
        btn.addEventListener('click', () => {
            const item = lastMineItems.find(it => String(it.id) === btn.dataset.id);
            if (!item) {
                logError('items:calendar', new Error('Item not found'));
                showToast(t.msg_calendar_error || 'Не удалось создать событие календаря', 'error');
                return;
            }
            downloadICS(item);
        });
    });

    if (typeof window.applyDashboardLang === 'function') {
        window.applyDashboardLang(lang);
    }
}

function renderVerifiedItems(receipts, t) {
    const grid = document.querySelector('#items-grid-verified');
    if (!grid) return;

    const lang = localStorage.getItem('valuon-lang') || 'ru';
    const allItems = [];
    (receipts || []).forEach(r => {
        (r.receipt_items || []).forEach(it => {
            allItems.push({ ...it, shop_name: r.shop_name, purchase_date: r.purchase_date });
        });
    });

    const countEl = document.getElementById('items-count-verified');
    if (countEl) window.animateCount(countEl, allItems.length);

    if (allItems.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" data-animate="zoom">
                <div class="empty-icon"><i class="fa-solid fa-shield-halved"></i></div>
                <h3 data-i18n="verified_empty_title">${escapeHtml(t.verified_empty_title || 'Пока нет подтвержденных товаров')}</h3>
                <p data-i18n="verified_empty_text">${escapeHtml(t.verified_empty_text || 'Товары из чеков от партнёров появятся здесь автоматически.')}</p>
            </div>`;
        return;
    }

    lastVerifiedItems = allItems;

    grid.innerHTML = allItems.map(item => {
        const iconClass = window.DEVICE_ICONS[item.type] || window.DEVICE_ICONS.other;
        const d = item.purchase_date ? item.purchase_date.slice(0, 10).split('-') : null;
        const dateStr = d ? (lang === 'ru' ? `${d[2]}.${d[1]}.${d[0]}` : `${d[1]}/${d[2]}/${d[0]}`) : '';
        const qty = parseInt(item.qty, 10) || 1;
        const noWarranty = isNoWarranty(item);
        const daysLeft = noWarranty ? null : calculateDaysLeft(item.warranty_end_date);
        const status = noWarranty ? null : getStatusInfo(daysLeft);
        const totalDays = (item.warranty_months || 12) * 30;
        const progress = noWarranty ? 0
            : totalDays > 0 ? Math.max(0, Math.min(100, (daysLeft / totalDays) * 100)) : 0;
        const statusClass = noWarranty ? 'none' : status.class;

        const stats = [];
        if (qty > 1) {
            stats.push({ icon: 'fa-layer-group', labelKey: 'stat_qty', fallback: 'Qty', value: '×' + escapeHtml(String(qty)) });
        }
        stats.push({ icon: 'fa-tag', labelKey: 'stat_price', fallback: 'Price', value: escapeHtml(window.formatCurrency(parseFloat(item.gross_total) || 0, item.currency || 'EUR', lang)) });
        if (!noWarranty) {
            stats.push({ icon: 'fa-shield-halved', labelKey: 'stat_warranty', fallback: 'Warranty', value: `${escapeHtml(String(item.warranty_months || 0))} ${escapeHtml(t.months_short || 'mo')}.` });
        }
        if (dateStr) {
            stats.push({ icon: 'fa-regular fa-calendar', labelKey: 'stat_date', fallback: 'Date', value: escapeHtml(dateStr) });
        }
        const statsHtml = stats.map(s => `
                        <div class="mine-stat">
                            <span class="mine-stat-icon"><i class="fa-solid ${s.icon}"></i></span>
                            <div class="mine-stat-text">
                                <div class="mine-stat-label" data-i18n="${s.labelKey}">${escapeHtml(t[s.labelKey] || s.fallback)}</div>
                                <div class="mine-stat-value" title="${s.value}">${s.value}</div>
                            </div>
                        </div>`).join('');

        const btnCalendarText = escapeHtml(t.add_to_calendar || 'В календарь');
        const calendarButtonHtml = item.warranty_end_date && daysLeft > 0 ? `
                        <button type="button" class="btn-action btn-add-calendar" data-id="${escapeHtml(item.id)}"
                                title="${btnCalendarText}" aria-label="${btnCalendarText}">
                            <i class="fa-solid fa-calendar-plus"></i>
                            <span data-i18n="add_to_calendar">${btnCalendarText}</span>
                        </button>` : '';

        let progressSectionHtml;
        if (noWarranty) {
            progressSectionHtml = `
                        <div class="mine-progress">
                            <div class="mine-progress-top">
                                <span class="days-left-text none" data-i18n="no_warranty">${escapeHtml(t.no_warranty || 'No warranty')}</span>
                            </div>
                            <div class="no-warranty-track"><i class="fa-solid fa-shield-slash"></i></div>
                        </div>`;
        } else {
            const progressTextKey = daysLeft > 0 ? 'days_left' : 'warranty_expired_text';
            const untilLabel = escapeHtml(t.progress_until || 'until');
            const endD = item.warranty_end_date ? item.warranty_end_date.slice(0, 10).split('-') : null;
            const endDateStr = endD ? (lang === 'ru' ? `${endD[2]}.${endD[1]}.${endD[0]}` : `${endD[1]}/${endD[2]}/${endD[0]}`) : '';
            progressSectionHtml = `
                        <div class="mine-progress">
                            <div class="mine-progress-top">
                                <span class="days-left-text ${status.class}"
                                      data-i18n="${progressTextKey}"
                                      data-i18n-count="${daysLeft > 0 ? daysLeft : ''}"></span>
                                <span class="mine-progress-until">${endDateStr ? `<span data-i18n="progress_until">${untilLabel}</span> ${escapeHtml(endDateStr)}` : ''}</span>
                            </div>
                            <div class="mine-progress-track">
                                <div class="mine-progress-fill ${status.class}" data-progress="${progress}"></div>
                            </div>
                        </div>`;
        }

        const itemName = escapeHtml(item.item_name || (t.item_name_unknown || 'Товар'));

        const verifiedLabel = escapeHtml(t.verified_badge || 'Confirmed');

        return `
            <div class="mine-item-card verified is-${statusClass}" data-item-id="${escapeHtml(item.id)}">
                <div class="mine-item-header">
                    <div class="mine-item-icon">
                        <i class="fa-solid ${iconClass}"></i>
                        <span class="verified-check" title="${verifiedLabel}" aria-label="${verifiedLabel}"><i class="fa-solid fa-check"></i></span>
                    </div>
                    <div class="mine-item-heading">
                        <h3 class="mine-item-title" title="${itemName}">${itemName}</h3>
                        <div class="mine-item-brand">${escapeHtml(item.shop_name || '—')}</div>
                    </div>
                </div>

                <div class="mine-item-body">
                    ${stats.length ? `<div class="mine-stats-grid">${statsHtml}</div>` : ''}

                    ${progressSectionHtml}

                    ${calendarButtonHtml ? `<div class="mine-item-actions calendar-only">${calendarButtonHtml}</div>` : ''}
                </div>
            </div>`;
    }).join('');

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            grid.querySelectorAll('.mine-progress-fill[data-progress]').forEach(el => {
                const progress = parseFloat(el.dataset.progress);
                el.style.width = `${progress}%`;
                el.removeAttribute('data-progress');
            });
        });
    });

    grid.querySelectorAll('.btn-add-calendar').forEach(btn => {
        btn.addEventListener('click', () => {
            const item = lastVerifiedItems.find(it => String(it.id) === btn.dataset.id);
            if (!item) {
                logError('items:calendar', new Error('Item not found'));
                showToast(t.msg_calendar_error || 'Не удалось создать событие календаря', 'error');
                return;
            }
            downloadICS(item);
        });
    });

    if (typeof window.applyDashboardLang === 'function') {
        window.applyDashboardLang(lang);
    }
}

async function loadVerifiedItems(userEmail, client) {
    const grid = document.querySelector('#items-grid-verified');
    if (!grid) return;

    grid.innerHTML = '<div class="rotating-loader"></div>';
    const loaderEl = grid.querySelector('.rotating-loader');
    if (loaderEl && typeof RotatingTextLoader !== 'undefined') {
        const lang = localStorage.getItem('valuon-lang') || 'ru';
        const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
        new RotatingTextLoader(loaderEl, [
            t.loading_items || 'Загружаем покупки…',
            t.loading_items_check || 'Проверяем данные…',
            t.loading_items_update || 'Обновляем статусы…'
        ], { interval: 800 });
    }

    const { data, error } = await client
        .from('business_receipts')
        .select('purchase_date, shop_name, receipt_items(id, item_name, qty, gross_total, currency, warranty_months, warranty_end_date)')
        .eq('customer_email', userEmail)
        .order('purchase_date', { ascending: false });

    if (error) {
        logError('items:loadVerified', error);
        grid.innerHTML = '<p class="empty-state error">Ошибка загрузки данных.</p>';
        return;
    }

    const lang = localStorage.getItem('valuon-lang') || 'ru';
    const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
    renderVerifiedItems(data || [], t);

    let verifiedActive = 0, verifiedExpiring = 0, verifiedExpired = 0, verifiedTotal = 0;
    (data || []).forEach(r => {
        (r.receipt_items || []).forEach(it => {
            verifiedTotal++;
            if (isNoWarranty({ warranty_months: it.warranty_months, purchase_date: r.purchase_date, warranty_end_date: it.warranty_end_date })) return;
            const days = calculateDaysLeft(it.warranty_end_date);
            if (days > 30) verifiedActive++;
            else if (days > 0 && days <= 30) verifiedExpiring++;
            else verifiedExpired++;
        });
    });

    verifiedStats = { total: verifiedTotal, active: verifiedActive, expiring: verifiedExpiring, expired: verifiedExpired };
    if (lastMineItems.length || verifiedTotal > 0) updateStats(lastMineItems);
}

let _switchingTab = false;

function switchGridTab(oldGrid, newGrid) {
    if (_switchingTab || !newGrid) return;
    _switchingTab = true;
    if (oldGrid) {
        oldGrid.classList.add('fade-out');
        setTimeout(() => {
            oldGrid.classList.add('hidden');
            oldGrid.classList.remove('fade-out');
            showNewGrid();
        }, 180);
    } else {
        showNewGrid();
    }
    function showNewGrid() {
        newGrid.classList.remove('hidden');
        requestAnimationFrame(() => {
            newGrid.classList.add('fade-in');
            setTimeout(() => {
                newGrid.classList.remove('fade-in');
                _switchingTab = false;
            }, 300);
        });
    }
}

function moveItemsTabIndicator() {
    const tabsWrap = document.getElementById('items-tabs');
    const indicator = document.getElementById('items-tab-indicator');
    const activeTab = tabsWrap?.querySelector('.items-tab.active');
    if (!tabsWrap || !indicator || !activeTab) return;

    indicator.style.width = `${activeTab.offsetWidth}px`;
    indicator.style.transform = `translateX(${activeTab.offsetLeft - 4}px)`;
}

function setupItemsTabs(userId, userEmail, client) {
    const tabs = document.querySelectorAll('.items-tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            if (tab.classList.contains('active')) return;

            tabs.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
            moveItemsTabIndicator();

            const target = tab.dataset.itemsTab;
            sessionStorage.setItem('valuon-items-tab', target);
            const mineGrid = document.querySelector('#items-grid-mine');
            const verifiedGrid = document.querySelector('#items-grid-verified');
            const oldGrid = target === 'mine' ? verifiedGrid : mineGrid;
            const newGrid = target === 'mine' ? mineGrid : verifiedGrid;
            switchGridTab(oldGrid, newGrid);
        });
    });

    // Position the sliding indicator once layout has settled, and keep it
    // aligned when the viewport or the tab label language changes.
    requestAnimationFrame(moveItemsTabIndicator);
    window.addEventListener('resize', moveItemsTabIndicator);
    window.addEventListener('lang-changed', () => requestAnimationFrame(moveItemsTabIndicator));
}

function updateStats(items) {
    const totalEl = document.getElementById('stat-total');
    const activeEl = document.getElementById('stat-active');
    const expiringEl = document.getElementById('stat-expiring');
    const expiredEl = document.getElementById('stat-expired');

    if (!totalEl || !activeEl || !expiringEl) return;

    let activeCount = 0;
    let expiringCount = 0;
    let expiredCount = 0;

    items.forEach(item => {
        if (isNoWarranty(item)) return;
        const days = calculateDaysLeft(item.warranty_end_date);
        if (days > 30) activeCount++;
        else if (days > 0 && days <= 30) expiringCount++;
        else if (days <= 0) expiredCount++;
    });

    window.animateCount(totalEl, items.length + verifiedStats.total);
    window.animateCount(activeEl, activeCount + verifiedStats.active);
    window.animateCount(expiringEl, expiringCount + verifiedStats.expiring);
    if (expiredEl) window.animateCount(expiredEl, expiredCount + verifiedStats.expired);
}

async function openEditModal(itemId, client, userId) {
    const modal = document.getElementById('edit-modal');
    const form = document.getElementById('edit-item-form');
    if (!modal || !form) return;

    const lang = localStorage.getItem('valuon-lang') || 'ru';
    const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};

    // Данные вещи уже есть в памяти после последней загрузки списка (loadItems),
    // так что открываем модалку сразу без похода в сеть. Сетевой запрос —
    // только запасной вариант, если по какой-то причине кэш пуст/устарел.
    let item = lastMineItems.find(it => String(it.id) === String(itemId));

    if (!item) {
        const { data, error } = await client
            .from('items')
            .select('*')
            .eq('id', itemId)
            .eq('user_id', userId)
            .single();

        if (error || !data) {
            showToast(t.msg_item_update_failed || 'Failed to load item', 'error');
            return;
        }
        item = data;
    }

    form.querySelector('[name="item_id"]').value = item.id;
    form.querySelector('[name="name"]').value = item.name || '';
    form.querySelector('[name="type"]').value = item.type || 'other';
    form.querySelector('[name="brand"]').value = item.brand || '';
    form.querySelector('[name="price"]').value = item.price ?? '';
    form.querySelector('[name="store_name"]').value = item.store_name || '';
    form.querySelector('[name="serial_number"]').value = item.serial_number || '';
    const dateInput = form.querySelector('[name="purchase_date"]');
    dateInput.value = item.purchase_date || '';
    if (dateInput._cdp) dateInput._cdp.syncDisplay();
    form.querySelector('[name="warranty_months"]').value = item.warranty_months ?? 12;
    form.querySelector('[name="location"]').value = item.location || '';

    const currencySelect = form.querySelector('[name="currency"]');
    if (currencySelect) {
        currencySelect.value = item.currency || 'EUR';
        if (typeof CustomSelect !== 'undefined') CustomSelect.refreshAll();
    }
    const priceSuffix = form.querySelector('.input-suffix .suffix-hint');
    if (priceSuffix && typeof window.currencySymbol === 'function') {
        priceSuffix.textContent = window.currencySymbol(item.currency || 'EUR');
    }

    if (typeof window.applyDashboardLang === 'function') {
        window.applyDashboardLang(lang);
    }

    modal.classList.add('active');
    document.documentElement.classList.add('modal-open');
}

function setupEditModal(client, userId) {
    const modal = document.getElementById('edit-modal');
    const form = document.getElementById('edit-item-form');
    const closeBtn = document.getElementById('close-edit-modal');
    const cancelBtn = document.getElementById('cancel-edit-modal');

    if (!modal || !form) return;

    function closeModal() {
        if (modal.classList.contains('closing')) return;
        modal.classList.add('closing');
        setTimeout(() => {
            modal.classList.remove('active', 'closing');
            form.reset();
            document.documentElement.classList.remove('modal-open');
        }, 250);
    }

    attachModalA11y(modal, { mode: 'active', onClose: closeModal });

    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    const currencySelect = form.querySelector('[name="currency"]');
    currencySelect?.addEventListener('change', () => {
        const priceSuffix = form.querySelector('.input-suffix .suffix-hint');
        if (priceSuffix && typeof window.currencySymbol === 'function') {
            priceSuffix.textContent = window.currencySymbol(currencySelect.value);
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = form.querySelector('button[type="submit"]');
        const originalHTML = btn.innerHTML;
        const lang = localStorage.getItem('valuon-lang') || 'ru';
        const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            const itemId = form.querySelector('[name="item_id"]').value;

            const { error } = await client.from('items').update({
                name: form.querySelector('[name="name"]').value.trim(),
                type: form.querySelector('[name="type"]').value,
                brand: form.querySelector('[name="brand"]').value.trim(),
                price: Math.max(0, parseFloat(form.querySelector('[name="price"]').value) || 0),
                store_name: form.querySelector('[name="store_name"]').value.trim(),
                serial_number: form.querySelector('[name="serial_number"]').value.trim(),
                purchase_date: form.querySelector('[name="purchase_date"]').value,
                warranty_months: (m => isNaN(m) ? 12 : Math.max(0, m))(parseInt(form.querySelector('[name="warranty_months"]').value)),
                location: form.querySelector('[name="location"]').value.trim(),
                currency: form.querySelector('[name="currency"]')?.value || 'EUR',
                updated_at: new Date().toISOString()
            }).eq('id', itemId)
                .eq('user_id', userId);

            if (error) throw error;

            btn.innerHTML = '<i class="fa-solid fa-check"></i>';
            showToast(t.msg_item_updated || 'Item updated', 'success');

            setTimeout(() => {
                closeModal();
                btn.innerHTML = originalHTML;
                btn.disabled = false;
                loadItems(userId, client);
                refreshNotifBadge();
            }, 800);

        } catch (err) {
            logError('items:update', err);
            showToast((t.msg_item_update_failed || 'Update failed') + ': ' + err.message, 'error');
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    });
}

function setupDeleteItemModal(client, userId) {
    const modal = document.getElementById('delete-item-modal');
    const confirmBtn = document.getElementById('confirm-delete-item');
    const cancelBtn = document.getElementById('cancel-delete-item');

    function closeDeleteModal() {
        if (modal?.classList.contains('closing')) return;
        modal?.classList.add('closing');
        setTimeout(() => {
            modal?.classList.remove('active', 'closing');
            document.documentElement.classList.remove('modal-open');
            pendingDeleteItemId = null;
        }, 250);
    }

    attachModalA11y(modal, { mode: 'active', onClose: closeDeleteModal });

    cancelBtn?.addEventListener('click', closeDeleteModal);
    modal?.addEventListener('click', (e) => { if (e.target === modal) closeDeleteModal(); });

    confirmBtn?.addEventListener('click', async () => {
        if (!pendingDeleteItemId) return;

        const lang = localStorage.getItem('valuon-lang') || 'ru';
        const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
        const originalHTML = confirmBtn.innerHTML;
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            const { error } = await client.from('items').delete()
                .eq('id', pendingDeleteItemId)
                .eq('user_id', userId);
            if (error) throw error;

            showToast(t.msg_item_deleted || 'Item deleted', 'success');
            closeDeleteModal();
            await loadItems(userId, client);
            refreshNotifBadge();

        } catch (err) {
            logError('items:delete', err);
            showToast((t.msg_item_delete_failed || 'Delete failed') + ': ' + err.message, 'error');
        } finally {
            confirmBtn.innerHTML = originalHTML;
            confirmBtn.disabled = false;
        }
    });
}

function setupModal(client) {
    const addBtn = document.getElementById('add-item-btn');
    const modal = document.getElementById('add-modal');
    const closeBtn = document.getElementById('close-modal');
    const cancelBtn = document.getElementById('cancel-modal');
    const form = document.querySelector('.modal-form');

    if (!addBtn || !modal) return;

    let isSubmitting = false;

    function closeAddModal() {
        if (modal.classList.contains('closing')) return;
        modal.classList.add('closing');
        setTimeout(() => {
            modal.classList.remove('active', 'closing');
            form.reset();
            document.documentElement.classList.remove('modal-open');
        }, 250);
    }

    attachModalA11y(modal, { mode: 'active', onClose: closeAddModal });

    const currencySelect = form?.querySelector('[name="currency"]');
    const priceSuffix = form?.querySelector('.input-suffix .suffix-hint');

    function updatePriceSuffix() {
        if (priceSuffix && typeof window.currencySymbol === 'function') {
            priceSuffix.textContent = window.currencySymbol(currencySelect?.value || userDefaultCurrency);
        }
    }

    currencySelect?.addEventListener('change', updatePriceSuffix);

    addBtn.addEventListener('click', () => {
        modal.classList.add('active');
        document.documentElement.classList.add('modal-open');
        const dateInput = form?.querySelector('[name="purchase_date"]');
        if (dateInput) {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            dateInput.value = `${y}-${m}-${d}`;
            if (dateInput._cdp) dateInput._cdp.syncDisplay();
        }
        if (currencySelect) {
            currencySelect.value = userDefaultCurrency;
        }
        const typeSelect = form?.querySelector('[name="type"]');
        if (typeSelect) {
            typeSelect.value = 'other';
        }
        if (typeof CustomSelect !== 'undefined') CustomSelect.refreshAll();
        updatePriceSuffix();
    });
    closeBtn?.addEventListener('click', closeAddModal);
    cancelBtn?.addEventListener('click', closeAddModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeAddModal();
    });

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (isSubmitting) return;
        isSubmitting = true;

        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;

        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            const { data: { user } } = await client.auth.getUser();

            const nameInput = form.querySelector('input[name="name"]');
            const typeSelect = form.querySelector('select[name="type"]');
            const brandInput = form.querySelector('input[name="brand"]');
            const serialInput = form.querySelector('input[name="serial_number"]');
            const dateInput = form.querySelector('input[name="purchase_date"]');
            const monthsInput = form.querySelector('input[name="warranty_months"]');
            const locationInput = form.querySelector('input[name="location"]');
            const priceInput = form.querySelector('input[name="price"]');
            const storeInput = form.querySelector('input[name="store_name"]');

            const { error } = await client.from('items').insert([{
                user_id: user.id,
                name: nameInput.value.trim(),
                type: typeSelect ? typeSelect.value : 'other',
                brand: brandInput ? brandInput.value.trim() : '',
                serial_number: serialInput ? serialInput.value.trim() : '',
                purchase_date: dateInput.value,
                warranty_months: (m => isNaN(m) ? 12 : Math.max(0, m))(parseInt(monthsInput.value)),
                location: locationInput ? locationInput.value.trim() : '',
                price: Math.max(0, parseFloat(priceInput?.value) || 0),
                store_name: storeInput ? storeInput.value.trim() : '',
                currency: currencySelect?.value || userDefaultCurrency
            }]);

            if (error) throw error;

            btn.innerHTML = '<i class="fa-solid fa-check"></i>';

            const lang = localStorage.getItem('valuon-lang') || 'ru';
            const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
            showToast(t.msg_item_added || 'Товар добавлен', 'success');

            setTimeout(() => {
                if (modal.classList.contains('closing')) return;
                modal.classList.add('closing');
                setTimeout(() => {
                    modal.classList.remove('active', 'closing');
                    form.reset();
                    document.documentElement.classList.remove('modal-open');
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                    isSubmitting = false;
                    loadItems(user.id, client);
                    refreshNotifBadge();
                }, 250);
            }, 800);

        } catch (err) {
            logError('items:warrantyUpdate', err);
            const lang = localStorage.getItem('valuon-lang') || 'ru';
            const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};

            if (err.code === '23505') {
                showToast(t.msg_item_exists || (lang === 'ru' ? 'Эта вещь уже добавлена!' : 'This item already exists!'), 'warning');
            } else {
                showToast(t.msg_item_save_failed || (lang === 'ru' ? 'Ошибка сохранения. Попробуйте снова.' : 'Save failed. Try again.'), 'error');
            }

            btn.innerHTML = originalText;
            btn.disabled = false;
            isSubmitting = false;
        }
    });
}

initDashboardItems().catch(e => {
    logError('init:dashboardItems', e);
    const lang = localStorage.getItem('valuon-lang') || 'ru';
    const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
    const msg = t.load_error || (lang === 'ru' ? 'Ошибка загрузки. Обновите страницу.' : 'Load error. Please refresh.');
    const el = document.querySelector('#items-grid-mine');
    if (el) el.innerHTML = `<p class="empty-state error">${msg}</p>`;
});