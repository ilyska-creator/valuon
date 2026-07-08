import { requireAuth, setupLogout } from './dashboard-auth.js';

let currentClient = null;
let currentUserId = null;
let pendingDeleteItemId = null;

const DEVICE_ICONS = {
    laptop: 'fa-laptop',
    phone: 'fa-mobile-screen-button',
    tablet: 'fa-tablet-screen-button',
    watch: 'fa-stopwatch',
    headphones: 'fa-headphones-simple',
    camera: 'fa-camera',
    console: 'fa-gamepad',
    appliance: 'fa-blender',
    other: 'fa-box-open'
};

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function initDashboardItems() {
    const auth = await requireAuth();
    if (!auth) return;

    currentClient = auth.client;
    currentUserId = auth.user.id;

    loadItems(auth.user.id, auth.client);
    setupModal(auth.client);
    setupEditModal(auth.client, auth.user.id);
    setupDeleteItemModal(auth.client, auth.user.id);
    setupLogout(auth.client);
}

async function loadItems(userId, client) {
    const grid = document.querySelector('.items-grid');
    if (!grid) return;

    grid.innerHTML = '<div class="loading-state"><i class="fa-solid fa-circle-notch fa-spin"></i> Загрузка...</div>';

    const { data: items, error } = await client
        .from('items')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        grid.innerHTML = '<p class="empty-state error">Ошибка загрузки данных.</p>';
        return;
    }

    const safeItems = items || [];

    renderItems(safeItems);
    updateStats(safeItems);
    renderWarrantyCalendar(safeItems);
    window._lastLoadedItems = safeItems;

    if (typeof window.renderNotifications === 'function') {
        window.renderNotifications(safeItems);
    }

    if (typeof window.applyDashboardLang === 'function') {
        window.applyDashboardLang(localStorage.getItem('valuon-lang') || 'ru');
    }
}

export function calculateDaysLeft(purchaseDate, months) {
    if (!purchaseDate || !months) return -999;

    const parts = purchaseDate.split('-');
    if (parts.length !== 3) return -999;

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    const endDate = new Date(year, month, day);

    const targetMonth = endDate.getMonth() + parseInt(months);
    endDate.setFullYear(endDate.getFullYear() + Math.floor(targetMonth / 12));
    endDate.setMonth(targetMonth % 12);

    if (endDate.getDate() !== day) {
        endDate.setDate(0);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    const diffTime = endDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getStatusInfo(daysLeft) {
    if (daysLeft > 30) return { class: 'active' };
    if (daysLeft > 0) return { class: 'warning' };
    return { class: 'expired' };
}

function renderItems(items) {
    const grid = document.querySelector('.items-grid');
    if (!grid) return;

    const lang = localStorage.getItem('valuon-lang') || 'ru';
    const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};

    if (items.length === 0) {
        const emptyTitle = t.empty_state_title || (lang === 'ru' ? 'Пока нет добавленных вещей' : 'No items yet');
        const emptyText = t.empty_state || (lang === 'ru' ? 'Добавьте первую покупку — чек, гарантию, серийный номер.' : 'Add your first purchase — receipt, warranty, serial number.');
        const emptyCta = t.empty_state_cta || (lang === 'ru' ? 'Добавить вещь' : 'Add item');

        grid.innerHTML = `
            <div class="empty-state" data-animate="zoom">
                <div class="empty-icon"><i class="fa-solid fa-box-open"></i></div>
                <h3>${escapeHtml(emptyTitle)}</h3>
                <p>${escapeHtml(emptyText)}</p>
                <button type="button" class="btn btn-outline empty-state-cta" id="empty-add-item-btn">
                    <i class="fa-solid fa-plus"></i> ${escapeHtml(emptyCta)}
                </button>
            </div>`;

        document.getElementById('empty-add-item-btn')?.addEventListener('click', () => {
            document.getElementById('add-item-btn')?.click();
        });
        return;
    }

    grid.innerHTML = items.map(item => {
        const iconClass = DEVICE_ICONS[item.type] || DEVICE_ICONS.other;
        const daysLeft = calculateDaysLeft(item.purchase_date, item.warranty_months);
        const status = getStatusInfo(daysLeft);

        const statusKeyMap = {
            active: 'status_active',
            warning: 'status_expiring',
            expired: 'status_expired'
        };
        const statusTextKey = statusKeyMap[status.class] || 'status_active';
        const progressTextKey = daysLeft > 0 ? 'days_left' : 'warranty_expired_text';

        const totalDays = (item.warranty_months || 12) * 30;
        const progress = totalDays > 0 ? Math.max(0, Math.min(100, (daysLeft / totalDays) * 100)) : 0;

        const tags = [];
        if (item.serial_number) {
            const shortSerial = item.serial_number.length > 6
                ? escapeHtml(item.serial_number.substring(0, 6)) + '...'
                : escapeHtml(item.serial_number);
            tags.push(`<span class="tag"><i class="fa-solid fa-barcode"></i> ${escapeHtml(shortSerial)}</span>`);
        }
        if (item.store_name) tags.push(`<span class="tag"><i class="fa-solid fa-store"></i> ${escapeHtml(item.store_name)}</span>`);
        if (item.price && item.price > 0) tags.push(`<span class="tag"><i class="fa-solid fa-tag"></i> ${escapeHtml(String(item.price))} $</span>`);

        const btnEditText = escapeHtml(t.btn_edit || 'Изменить');
        const btnDeleteText = escapeHtml(t.btn_delete || 'Удалить');

        return `
            <div class="item-card" data-item-id="${escapeHtml(item.id)}">
                <div class="item-header">
                    <div class="item-icon"><i class="fa-solid ${iconClass}"></i></div>
                    <div class="item-status-badge ${status.class}" data-i18n="${statusTextKey}">${escapeHtml(t[statusTextKey] || '')}</div>
                </div>
                
                <div class="item-body">
                    <h3 class="item-title">${escapeHtml(item.name)}</h3>
                    <div class="item-brand">${escapeHtml(item.brand) || escapeHtml(t.brand_not_specified || 'Brand not specified')}</div>
                    
                    <div class="item-tags">
                        ${tags.join('')}
                    </div>
                </div>

                <div class="item-footer">
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill ${status.class}" style="width: ${progress}%"></div>
                    </div>
                    <div class="days-left-text ${status.class}" 
                         data-i18n="${progressTextKey}" 
                         data-i18n-count="${daysLeft > 0 ? daysLeft : ''}">
                    </div>
                    <div class="item-actions">
                        <button class="btn-action primary btn-edit-item" data-id="${escapeHtml(item.id)}" title="${btnEditText}">
                            <i class="fa-solid fa-pen"></i>
                            <span data-i18n="btn_edit">${btnEditText}</span>
                        </button>
                        <button class="btn-action danger btn-delete-item" data-id="${escapeHtml(item.id)}" title="${btnDeleteText}">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    grid.querySelectorAll('.btn-edit-item').forEach(btn => {
        btn.addEventListener('click', () => {
            openEditModal(btn.dataset.id, currentClient, currentUserId);
        });
    });

    grid.querySelectorAll('.btn-delete-item').forEach(btn => {
        btn.addEventListener('click', () => {
            pendingDeleteItemId = btn.dataset.id;
            document.getElementById('delete-item-modal')?.classList.add('active');
        });
    });

    if (typeof window.applyDashboardLang === 'function') {
        window.applyDashboardLang(lang);
    }
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
        const days = calculateDaysLeft(item.purchase_date, item.warranty_months);
        if (days > 30) activeCount++;
        else if (days > 0 && days <= 30) expiringCount++;
        else if (days <= 0) expiredCount++;
    });

    totalEl.textContent = items.length;
    activeEl.textContent = activeCount;
    expiringEl.textContent = expiringCount;
    if (expiredEl) expiredEl.textContent = expiredCount;
}

async function openEditModal(itemId, client, userId) {
    const modal = document.getElementById('edit-modal');
    const form = document.getElementById('edit-item-form');
    if (!modal || !form) return;

    const lang = localStorage.getItem('valuon-lang') || 'ru';
    const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};

    const { data: item, error } = await client
        .from('items')
        .select('*')
        .eq('id', itemId)
        .eq('user_id', userId)
        .single();

    if (error || !item) {
        showToast(t.msg_item_update_failed || 'Failed to load item', 'error');
        return;
    }

    form.querySelector('[name="item_id"]').value = item.id;
    form.querySelector('[name="name"]').value = item.name || '';
    form.querySelector('[name="type"]').value = item.type || 'other';
    form.querySelector('[name="brand"]').value = item.brand || '';
    form.querySelector('[name="price"]').value = item.price || '';
    form.querySelector('[name="store_name"]').value = item.store_name || '';
    form.querySelector('[name="serial_number"]').value = item.serial_number || '';
    form.querySelector('[name="purchase_date"]').value = item.purchase_date || '';
    form.querySelector('[name="warranty_months"]').value = item.warranty_months || 12;
    form.querySelector('[name="location"]').value = item.location || '';

    if (typeof window.applyDashboardLang === 'function') {
        window.applyDashboardLang(lang);
    }

    modal.classList.add('active');
}

let calendarCurrentMonth = new Date().getMonth();
let calendarCurrentYear = new Date().getFullYear();

function renderWarrantyCalendar(items) {
    const container = document.getElementById('warranty-calendar');
    if (!container) return;

    const monthLabel = document.getElementById('cal-month-label');
    const weekdaysEl = document.getElementById('cal-weekdays');
    const daysEl = document.getElementById('cal-days');
    if (!monthLabel || !weekdaysEl || !daysEl) return;

    const lang = localStorage.getItem('valuon-lang') || 'ru';
    const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};

    const monthNames = lang === 'ru'
        ? ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
        : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const weekdays = lang === 'ru'
        ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
        : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

    monthLabel.textContent = `${monthNames[calendarCurrentMonth]} ${calendarCurrentYear}`;

    weekdaysEl.innerHTML = weekdays.map(d => `<span>${d}</span>`).join('');

    const firstDay = new Date(calendarCurrentYear, calendarCurrentMonth, 1).getDay();
    const daysInMonth = new Date(calendarCurrentYear, calendarCurrentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(calendarCurrentYear, calendarCurrentMonth, 0).getDate();

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    
    const warrantyMap = {};
    (items || []).forEach(item => {
        if (!item.purchase_date || !item.warranty_months) return;
        const parts = item.purchase_date.split('-');
        if (parts.length !== 3) return;
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const startDate = new Date(year, month, day);
        const endDate = new Date(year, month, day);
        endDate.setMonth(endDate.getMonth() + parseInt(item.warranty_months));
        if (endDate.getDate() !== day) endDate.setDate(0);

        
        function addDateDot(date, status) {
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            if (!warrantyMap[key]) warrantyMap[key] = [];
            warrantyMap[key].push({ name: item.name, status });
        }

        const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        let status = daysLeft > 30 ? 'active' : daysLeft > 0 ? 'warning' : 'expired';

        addDateDot(startDate, 'active');
        if (endDate.getTime() !== startDate.getTime()) {
            addDateDot(endDate, status);
        }
    });

    const sundayOffset = firstDay === 0 ? 6 : firstDay - 1;
    const totalSlots = Math.ceil((sundayOffset + daysInMonth) / 7) * 7;

    let html = '';
    for (let i = 0; i < totalSlots; i++) {
        let dayNum, isOtherMonth = false, dateStr;

        if (i < sundayOffset) {
            dayNum = daysInPrevMonth - sundayOffset + i + 1;
            isOtherMonth = true;
            const prevMonth = calendarCurrentMonth === 0 ? 11 : calendarCurrentMonth - 1;
            const prevYear = calendarCurrentMonth === 0 ? calendarCurrentYear - 1 : calendarCurrentYear;
            dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        } else if (i >= sundayOffset + daysInMonth) {
            dayNum = i - sundayOffset - daysInMonth + 1;
            isOtherMonth = true;
            const nextMonth = calendarCurrentMonth === 11 ? 0 : calendarCurrentMonth + 1;
            const nextYear = calendarCurrentMonth === 11 ? calendarCurrentYear + 1 : calendarCurrentYear;
            dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        } else {
            dayNum = i - sundayOffset + 1;
            dateStr = `${calendarCurrentYear}-${String(calendarCurrentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        }

        const isToday = dateStr === todayStr;
        const dayWarranties = warrantyMap[dateStr] || [];
        const statusCounts = { active: 0, warning: 0, expired: 0 };
        dayWarranties.forEach(w => { if (statusCounts[w.status] !== undefined) statusCounts[w.status]++; });

        const hasDot = dayWarranties.length > 0;
        const dotClass = hasDot
            ? (statusCounts.expired > 0 ? 'expired' : statusCounts.warning > 0 ? 'warning' : 'active')
            : '';

        const tooltipText = dayWarranties.length > 0
            ? dayWarranties.map(w => `${w.name} (${t[w.status === 'active' ? 'status_active' : w.status === 'warning' ? 'status_expiring' : 'status_expired'] || w.status})`).join(', ')
            : '';

        html += `<div class="calendar-day${isOtherMonth ? ' other-month' : ''}${isToday ? ' today' : ''}" title="${escapeHtml(tooltipText)}">
            <span>${dayNum}</span>
            ${hasDot ? `<span class="day-dot ${dotClass}"></span>` : ''}
            ${dayWarranties.length > 1 ? `<span class="day-count">+${dayWarranties.length - 1}</span>` : ''}
        </div>`;
    }

    daysEl.innerHTML = html;
}

function setupCalendarNav() {
    const prevBtn = document.getElementById('cal-prev');
    const nextBtn = document.getElementById('cal-next');

    prevBtn?.addEventListener('click', () => {
        calendarCurrentMonth--;
        if (calendarCurrentMonth < 0) { calendarCurrentMonth = 11; calendarCurrentYear--; }
        renderWarrantyCalendar(window._lastLoadedItems || []);
    });

    nextBtn?.addEventListener('click', () => {
        calendarCurrentMonth++;
        if (calendarCurrentMonth > 11) { calendarCurrentMonth = 0; calendarCurrentYear++; }
        renderWarrantyCalendar(window._lastLoadedItems || []);
    });
}

window.addEventListener('lang-changed', () => {
    renderWarrantyCalendar(window._lastLoadedItems || []);
});

setupCalendarNav();

function setupEditModal(client, userId) {
    const modal = document.getElementById('edit-modal');
    const form = document.getElementById('edit-item-form');
    const closeBtn = document.getElementById('close-edit-modal');
    const cancelBtn = document.getElementById('cancel-edit-modal');

    if (!modal || !form) return;

    function closeModal() {
        modal.classList.remove('active');
        form.reset();
    }

    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

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
                price: parseFloat(form.querySelector('[name="price"]').value) || 0,
                store_name: form.querySelector('[name="store_name"]').value.trim(),
                serial_number: form.querySelector('[name="serial_number"]').value.trim(),
                purchase_date: form.querySelector('[name="purchase_date"]').value,
                warranty_months: (m => isNaN(m) ? 12 : m)(parseInt(form.querySelector('[name="warranty_months"]').value)),
                location: form.querySelector('[name="location"]').value.trim(),
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
            }, 800);

        } catch (err) {
            console.error(err);
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
        modal?.classList.remove('active');
        pendingDeleteItemId = null;
    }

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

        } catch (err) {
            console.error(err);
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

    addBtn.addEventListener('click', () => modal.classList.add('active'));
    closeBtn?.addEventListener('click', () => { modal.classList.remove('active'); form.reset(); });
    cancelBtn?.addEventListener('click', () => { modal.classList.remove('active'); form.reset(); });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
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
                warranty_months: (m => isNaN(m) ? 12 : m)(parseInt(monthsInput.value)),
                location: locationInput ? locationInput.value.trim() : '',
                price: parseFloat(priceInput?.value) || 0,
                store_name: storeInput ? storeInput.value.trim() : ''
            }]);

            if (error) throw error;

            btn.innerHTML = '<i class="fa-solid fa-check"></i>';

            const lang = localStorage.getItem('valuon-lang') || 'ru';
            const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
            showToast(t.msg_item_added || 'Товар добавлен', 'success');

            setTimeout(() => {
                modal.classList.remove('active');
                form.reset();
                btn.innerHTML = originalText;
                btn.disabled = false;
                isSubmitting = false;
                loadItems(user.id, client);
            }, 800);

        } catch (err) {
            console.error(err);
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

initDashboardItems();