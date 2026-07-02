import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://qjnzawjivqvgupbgxdao.supabase.co';
const supabaseKey = 'sb_publishable__b1k1cuhxQEBn50III2tkQ_0DOOqe3V';
const supabase = createClient(supabaseUrl, supabaseKey);

async function initDashboard() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    loadItems(session.user.id);
    setupModal();
}

async function loadItems(userId) {
    console.log('🔍 Загрузка вещей для пользователя:', userId);

    const grid = document.querySelector('.items-grid');
    if (!grid) return;

    grid.innerHTML = '<div class="loading-state"><i class="fa-solid fa-circle-notch fa-spin"></i> Загрузка...</div>';

    const { data: items, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error(' Ошибка Supabase:', error);
        grid.innerHTML = '<p class="empty-state error">Ошибка загрузки данных.</p>';
        return;
    }

    console.log('📦 Получено вещей:', items?.length || 0);
    console.log(' Данные:', items);

    const safeItems = items || [];

    renderItems(safeItems);
    updateStats(safeItems);
}

function calculateDaysLeft(purchaseDate, months) {
    if (!purchaseDate || !months) {
        console.warn('⚠️ Нет даты или месяцев:', purchaseDate, months);
        return -999;
    }

    const start = new Date(purchaseDate);
    if (isNaN(start.getTime())) {
        console.warn('⚠️ Некорректная дата:', purchaseDate);
        return -999;
    }

    const end = new Date(start);
    end.setMonth(end.getMonth() + parseInt(months));

    const now = new Date();
    const days = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

    console.log(`⏳ Расчет дней для "${purchaseDate}" + ${months} мес = ${days} дн.`);
    return days;
}

function getStatusInfo(daysLeft) {
    if (daysLeft > 30) return { class: 'active', text: 'Активна' };
    if (daysLeft > 0) return { class: 'warning', text: 'Заканчивается' };
    return { class: 'expired', text: 'Истекла' };
}

function renderItems(items) {
    const grid = document.querySelector('.items-grid');
    if (!grid) return;

    if (items.length === 0) {
        grid.innerHTML = '<p class="empty-state">У вас пока нет добавленных вещей. Нажмите "Добавить вещь".</p>';
        return;
    }

    grid.innerHTML = items.map(item => {
        const daysLeft = calculateDaysLeft(item.purchase_date, item.warranty_months);
        const status = getStatusInfo(daysLeft);

        const totalDays = (item.warranty_months || 12) * 30;
        const progress = totalDays > 0 ? Math.max(0, Math.min(100, (daysLeft / totalDays) * 100)) : 0;

        return `
            <div class="item-card">
                <div class="item-header">
                    <div class="item-icon"><i class="fa-solid fa-box"></i></div>
                    <div class="item-status ${status.class}">${status.text}</div>
                </div>
                <h3 class="item-title">${item.name}</h3>
                <p class="item-meta">${item.brand || 'Бренд не указан'} • S/N: ${item.serial_number || '—'}</p>
                <div class="item-progress">
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill ${status.class}" style="width: ${progress}%"></div>
                    </div>
                    <span class="progress-text ${status.class === 'active' ? '' : status.class + '-text'}">
                        ${daysLeft > 0 ? `Осталось ${daysLeft} дней` : 'Гарантия истекла'}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

function updateStats(items) {
    console.log('📊 Обновление статистики для', items.length, 'вещей');

    const totalEl = document.getElementById('stat-total');
    const activeEl = document.getElementById('stat-active');
    const expiringEl = document.getElementById('stat-expiring');

    if (!totalEl || !activeEl || !expiringEl) {
        console.error(' Не найдены элементы статистики! Проверь ID в HTML.');
        return;
    }

    let activeCount = 0;
    let expiringCount = 0;

    items.forEach((item, index) => {
        const days = calculateDaysLeft(item.purchase_date, item.warranty_months);
        console.log(`   Вещь #${index + 1}: ${days} дней -> `, days > 30 ? 'АКТИВНА' : days > 0 ? 'ЗАКАНЧИВАЕТСЯ' : 'ИСТЕКЛА');

        if (days > 30) activeCount++;
        else if (days > 0 && days <= 30) expiringCount++;
    });

    console.log(`✅ Итог: Всего=${items.length}, Активных=${activeCount}, Истекающих=${expiringCount}`);

    totalEl.textContent = items.length;
    activeEl.textContent = activeCount;
    expiringEl.textContent = expiringCount;
}

function setupModal() {
    const addBtn = document.getElementById('add-item-btn');
    const modal = document.getElementById('add-modal');
    const closeBtn = document.getElementById('close-modal');
    const cancelBtn = document.getElementById('cancel-modal');
    const form = document.querySelector('.modal-form');

    if (!addBtn || !modal) return;

    addBtn.addEventListener('click', () => modal.classList.add('active'));
    closeBtn?.addEventListener('click', () => modal.classList.remove('active'));
    cancelBtn?.addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;

        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            const { data: { user } } = await supabase.auth.getUser();

            const nameInput = form.querySelector('input[type="text"]');
            const serialInputs = form.querySelectorAll('input[type="text"]');
            const dateInput = form.querySelector('input[type="date"]');
            const monthsInput = form.querySelector('input[type="number"]');

            const { error } = await supabase.from('items').insert([{
                user_id: user.id,
                name: nameInput.value.trim(),
                brand: '',
                serial_number: serialInputs.length > 1 ? serialInputs[1].value.trim() : '',
                purchase_date: dateInput.value,
                warranty_months: parseInt(monthsInput.value) || 12
            }]);

            if (error) throw error;

            btn.innerHTML = '<i class="fa-solid fa-check"></i>';
            setTimeout(() => {
                modal.classList.remove('active');
                form.reset();
                btn.innerHTML = originalText;
                btn.disabled = false;
                initDashboard();
            }, 800);

        } catch (err) {
            console.error(err);
            alert('Ошибка сохранения. Попробуйте снова.');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}

initDashboard();