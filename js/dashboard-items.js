import { requireAuth, setupLogout } from './dashboard-auth.js';

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

    loadItems(auth.user.id, auth.client);
    setupModal(auth.client);
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

    if (typeof renderNotifications === 'function') {
        renderNotifications(safeItems);
    }

    // Применяем текущий язык к только что созданным элементам
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
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return daysLeft;
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
        grid.innerHTML = `<p class="empty-state" data-i18n="empty_state">${t.empty_state || ''}</p>`;
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

        // Теги
        const tags = [];
        if (item.serial_number) {
            const shortSerial = item.serial_number.length > 6
                ? item.serial_number.substring(0, 6) + '...'
                : item.serial_number;
            tags.push(`<span class="tag"><i class="fa-solid fa-barcode"></i> ${shortSerial}</span>`);
        }
        if (item.store_name) tags.push(`<span class="tag"><i class="fa-solid fa-store"></i> ${item.store_name}</span>`);
        if (item.price && item.price > 0) tags.push(`<span class="tag"><i class="fa-solid fa-tag"></i> ${item.price} $</span>`);
        return `
            <div class="item-card">
                <div class="item-header">
                    <div class="item-icon"><i class="fa-solid ${iconClass}"></i></div>
                    <div class="item-status-badge ${status.class}" data-i18n="${statusTextKey}"></div>
                </div>
                
                <div class="item-body">
                    <h3 class="item-title">${item.name}</h3>
                    <div class="item-brand">${item.brand || (t.brand_not_specified || 'Brand not specified')}</div>
                    
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
                </div>
            </div>
        `;
    }).join('');

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

        if (days > 30) {
            activeCount++;
        } else if (days > 0 && days <= 30) {
            expiringCount++;
        } else if (days <= 0) {
            expiredCount++;
        }
    });

    totalEl.textContent = items.length;
    activeEl.textContent = activeCount;
    expiringEl.textContent = expiringCount;

    if (expiredEl) expiredEl.textContent = expiredCount;
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
    closeBtn?.addEventListener('click', () => modal.classList.remove('active'));
    cancelBtn?.addEventListener('click', () => modal.classList.remove('active'));

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
                warranty_months: parseInt(monthsInput.value) || 12,
                location: locationInput ? locationInput.value.trim() : '',
                price: parseFloat(priceInput?.value) || 0,
                store_name: storeInput ? storeInput.value.trim() : '',
                serial_number: serialInput ? serialInput.value.trim() : '',
                purchase_date: dateInput.value,
                warranty_months: parseInt(monthsInput.value) || 12,
                location: locationInput ? locationInput.value.trim() : ''
            }]);

            if (error) throw error;

            btn.innerHTML = '<i class="fa-solid fa-check"></i>';

            setTimeout(() => {
                modal.classList.remove('active');
                form.reset();
                btn.innerHTML = originalText;
                btn.disabled = false;
                isSubmitting = false;
                initDashboardItems();
            }, 800);

        } catch (err) {
            console.error(err);
            if (err.code === '23505') {
                alert('Эта вещь уже добавлена!');
            } else {
                alert('Ошибка сохранения. Попробуйте снова.');
            }
            btn.innerHTML = originalText;
            btn.disabled = false;
            isSubmitting = false;
        }
    });
}

initDashboardItems();