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
    const grid = document.querySelector('.items-grid');
    if (!grid) return;

    grid.innerHTML = '<div class="loading-state"><i class="fa-solid fa-circle-notch fa-spin"></i> Загрузка...</div>';

    const { data: items, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Ошибка загрузки:', error);
        grid.innerHTML = '<p class="empty-state error">Ошибка загрузки данных.</p>';
        return;
    }

    renderItems(items);
    updateStats(items);
}

function renderItems(items) {
    const grid = document.querySelector('.items-grid');
    if (!grid) return;

    if (items.length === 0) {
        grid.innerHTML = '<p class="empty-state">У вас пока нет добавленных вещей.</p>';
        return;
    }

    grid.innerHTML = items.map(item => {
        const daysLeft = calculateDaysLeft(item.purchase_date, item.warranty_months);
        const statusClass = daysLeft > 30 ? 'active' : daysLeft > 0 ? 'warning' : 'expired';
        const statusText = daysLeft > 30 ? 'Активна' : daysLeft > 0 ? 'Заканчивается' : 'Истекла';
        const progress = Math.max(0, Math.min(100, (daysLeft / (item.warranty_months * 30)) * 100));

        return `
            <div class="item-card">
                <div class="item-header">
                    <div class="item-icon"><i class="fa-solid fa-box"></i></div>
                    <div class="item-status ${statusClass}">${statusText}</div>
                </div>
                <h3 class="item-title">${item.name}</h3>
                <p class="item-meta">${item.brand || 'Бренд не указан'} • S/N: ${item.serial_number || '—'}</p>
                <div class="item-progress">
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill ${statusClass}" style="width: ${progress}%"></div>
                    </div>
                    <span class="progress-text ${statusClass === 'active' ? '' : statusClass + '-text'}">
                        ${daysLeft > 0 ? `Осталось ${daysLeft} дней` : 'Гарантия истекла'}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

function calculateDaysLeft(purchaseDate, months) {
    const start = new Date(purchaseDate);
    const end = new Date(start);
    end.setMonth(end.getMonth() + months);
    const now = new Date();
    return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
}

function updateStats(items) {
    const totalEl = document.getElementById('stat-total');
    const activeEl = document.getElementById('stat-active');
    const expiringEl = document.getElementById('stat-expiring');

    if (!totalEl || !activeEl || !expiringEl) return;

    const total = items.length;
    const active = items.filter(i => calculateDaysLeft(i.purchase_date, i.warranty_months) > 30).length;
    const expiring = items.filter(i => {
        const d = calculateDaysLeft(i.purchase_date, i.warranty_months);
        return d > 0 && d <= 30;
    }).length;

    totalEl.textContent = total;
    activeEl.textContent = active;
    expiringEl.textContent = expiring;
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

            const { error } = await supabase.from('items').insert([{
                user_id: user.id,
                name: form.querySelector('input[type="text"]').value,
                serial_number: form.querySelectorAll('input[type="text"]')[1]?.value || '',
                purchase_date: form.querySelector('input[type="date"]').value,
                warranty_months: parseInt(form.querySelector('input[type="number"]').value)
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
            alert('Ошибка сохранения.');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}

initDashboard();