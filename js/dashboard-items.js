import { requireAuth, setupLogout } from './dashboard-auth.js';
import { escapeHtml } from './security.js';

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

async function initDashboardItems() {
    const auth = await requireAuth();
    if (!auth) return;

    currentClient = auth.client;
    currentUserId = auth.user.id;

    setupItemsTabs(auth.user.id, auth.user.email, auth.client);
    await loadItems(auth.user.id, auth.client);
    await loadVerifiedItems(auth.user.email, auth.client);
    setupModal(auth.client);
    setupEditModal(auth.client, auth.user.id);
    setupDeleteItemModal(auth.client, auth.user.id);
    setupLogout(auth.client);
}

function skeletonCards(count = 3) {
    return Array.from({ length: count }, () => '<div class="item-card-skeleton"></div>').join('');
}

async function loadItems(userId, client) {
    const grid = document.querySelector('#items-grid-mine');
    if (!grid) return;

    grid.innerHTML = skeletonCards();

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

    if (typeof window.applyDashboardLang === 'function') {
        window.applyDashboardLang(localStorage.getItem('valuon-lang') || 'ru');
    }
}

export function calculateDaysLeft(purchaseDate, months) {
    if (!purchaseDate || months == null || months === '') return -999;

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
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Number.isFinite(days) ? days : -999;
}

function getStatusInfo(daysLeft) {
    if (daysLeft > 30) return { class: 'active' };
    if (daysLeft > 0) return { class: 'warning' };
    return { class: 'expired' };
}

function renderItems(items) {
    const grid = document.querySelector('#items-grid-mine');
    if (!grid) return;

    const lang = localStorage.getItem('valuon-lang') || 'ru';
    const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};

    const countEl = document.getElementById('items-count-mine');
    if (countEl) countEl.textContent = String(items.length);

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
                        <div class="progress-bar-fill ${status.class}" style="width: 0" data-progress="${progress}"></div>
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

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            grid.querySelectorAll('.progress-bar-fill[data-progress]').forEach(el => {
                el.style.width = el.dataset.progress + '%';
                el.removeAttribute('data-progress');
            });
        });
    });

    grid.querySelectorAll('.btn-edit-item').forEach(btn => {
        btn.addEventListener('click', () => {
            openEditModal(btn.dataset.id, currentClient, currentUserId);
        });
    });

    grid.querySelectorAll('.btn-delete-item').forEach(btn => {
        btn.addEventListener('click', () => {
            pendingDeleteItemId = btn.dataset.id;
            document.getElementById('delete-item-modal')?.classList.add('active');
            document.body.classList.add('modal-open');
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
    if (countEl) countEl.textContent = String(allItems.length);

    if (allItems.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" data-animate="zoom">
                <div class="empty-icon"><i class="fa-solid fa-shield-halved"></i></div>
                <h3>${escapeHtml(t.verified_empty_title || 'Пока нет подтвержденных товаров')}</h3>
                <p>${escapeHtml(t.verified_empty_text || 'Товары из чеков от партнёров появятся здесь автоматически.')}</p>
            </div>`;
        return;
    }

    const statusKeyMap = {
        active: 'status_active',
        warning: 'status_expiring',
        expired: 'status_expired'
    };

    grid.innerHTML = allItems.map(item => {
        const daysLeft = calculateDaysLeft(item.purchase_date, item.warranty_months);
        const status = getStatusInfo(daysLeft);
        const statusTextKey = statusKeyMap[status.class] || 'status_active';
        const dateStr = item.purchase_date
            ? new Date(item.purchase_date).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US')
            : '—';
        const qty = parseInt(item.qty, 10) || 1;

        const totalDays = (item.warranty_months || 12) * 30;
        const progress = totalDays > 0 ? Math.max(0, Math.min(100, (daysLeft / totalDays) * 100)) : 0;
        const progressTextKey = daysLeft > 0 ? 'days_left' : 'warranty_expired_text';

        return `
            <div class="item-card verified-item-card">
                <div class="verified-ribbon"><i class="fa-solid fa-check"></i> <span data-i18n="verified_badge">${escapeHtml(t.verified_badge || 'Confirmed')}</span></div>
                <div class="item-header">
                    <div class="item-icon verified"><i class="fa-solid fa-box-open"></i></div>
                    <div class="item-header-badges">
                        <div class="item-status-badge ${status.class}" data-i18n="${statusTextKey}">${escapeHtml(t[statusTextKey] || '')}</div>
                    </div>
                </div>

                <div class="item-body">
                    <h3 class="item-title">${escapeHtml(item.item_name || (t.item_name_unknown || 'Товар'))}</h3>
                    <div class="item-brand"><i class="fa-solid fa-store"></i> ${escapeHtml(item.shop_name || '—')}</div>

                    <div class="item-tags">
                        ${qty > 1 ? `<span class="tag"><i class="fa-solid fa-layer-group"></i> ×${escapeHtml(String(qty))}</span>` : ''}
                        <span class="tag"><i class="fa-solid fa-tag"></i> $${escapeHtml(parseFloat(item.gross_total || 0).toFixed(2))}</span>
                        <span class="tag"><i class="fa-solid fa-shield-halved"></i> ${escapeHtml(String(item.warranty_months || 0))} ${escapeHtml(t.months_short || 'mo')}.</span>
                        <span class="tag"><i class="fa-regular fa-calendar"></i> ${escapeHtml(dateStr)}</span>
                    </div>
                </div>

                <div class="item-footer">
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill ${status.class}" style="width: 0" data-progress="${progress}"></div>
                    </div>
                    <div class="days-left-text ${status.class}" 
                         data-i18n="${progressTextKey}" 
                         data-i18n-count="${daysLeft > 0 ? daysLeft : ''}">
                    </div>
                    <div class="verified-lock-note"><i class="fa-solid fa-lock"></i> <span data-i18n="verified_locked">${escapeHtml(t.verified_locked || 'Подтверждено продавцом — нельзя изменить')}</span></div>
                </div>
            </div>`;
    }).join('');

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            grid.querySelectorAll('.progress-bar-fill[data-progress]').forEach(el => {
                el.style.width = el.dataset.progress + '%';
                el.removeAttribute('data-progress');
            });
        });
    });

    if (typeof window.applyDashboardLang === 'function') {
        window.applyDashboardLang(lang);
    }
}

async function loadVerifiedItems(userEmail, client) {
    const grid = document.querySelector('#items-grid-verified');
    if (!grid) return;
    grid.innerHTML = skeletonCards();

    const { data, error } = await client
        .from('business_receipts')
        .select('purchase_date, shop_name, receipt_items(item_name, qty, gross_total, warranty_months)')
        .eq('customer_email', userEmail)
        .order('purchase_date', { ascending: false });

    if (error) {
        console.error(error);
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
            const days = calculateDaysLeft(it.purchase_date || r.purchase_date, it.warranty_months);
            if (days > 30) verifiedActive++;
            else if (days > 0 && days <= 30) verifiedExpiring++;
            else verifiedExpired++;
        });
    });

    const totalEl = document.getElementById('stat-total');
    const activeEl = document.getElementById('stat-active');
    const expiringEl = document.getElementById('stat-expiring');
    const expiredEl = document.getElementById('stat-expired');
    if (totalEl) totalEl.textContent = (parseInt(totalEl.textContent) || 0) + verifiedTotal;
    if (activeEl) activeEl.textContent = (parseInt(activeEl.textContent) || 0) + verifiedActive;
    if (expiringEl) expiringEl.textContent = (parseInt(expiringEl.textContent) || 0) + verifiedExpiring;
    if (expiredEl) expiredEl.textContent = (parseInt(expiredEl.textContent) || 0) + verifiedExpired;
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
    document.body.classList.add('modal-open');
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
            document.body.classList.remove('modal-open');
        }, 250);
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
                price: Math.max(0, parseFloat(form.querySelector('[name="price"]').value) || 0),
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
        if (modal?.classList.contains('closing')) return;
        modal?.classList.add('closing');
        setTimeout(() => {
            modal?.classList.remove('active', 'closing');
            document.body.classList.remove('modal-open');
            pendingDeleteItemId = null;
        }, 250);
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

    function closeAddModal() {
        if (modal.classList.contains('closing')) return;
        modal.classList.add('closing');
        setTimeout(() => {
            modal.classList.remove('active', 'closing');
            form.reset();
            document.body.classList.remove('modal-open');
        }, 250);
    }

    addBtn.addEventListener('click', () => { modal.classList.add('active'); document.body.classList.add('modal-open'); });
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
                if (modal.classList.contains('closing')) return;
                modal.classList.add('closing');
                setTimeout(() => {
                    modal.classList.remove('active', 'closing');
                    form.reset();
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                    isSubmitting = false;
                    loadItems(user.id, client);
                }, 250);
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