import { requireAuth } from './dashboard-auth.js';

async function initSettings() {
    const auth = await requireAuth();
    if (!auth) return;

    const { user, client } = auth;

    // --- ЗАГРУЗКА ПРОФИЛЯ ---
    async function loadProfile() {
        const emailInput = document.getElementById('settings-email');
        const nameInput = document.getElementById('settings-name');
        const toggleExpiry = document.getElementById('toggle-expiry');
        const toggleDigest = document.getElementById('toggle-digest');

        if (emailInput) emailInput.value = user.email || '';

        const { data, error } = await client
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Ошибка загрузки профиля:', error);
            return;
        }

        // Если профиль существует — заполняем поля
        if (data) {
            if (nameInput && data.display_name) nameInput.value = data.display_name;
            if (toggleExpiry) toggleExpiry.checked = data.expiry_alerts ?? true;
            if (toggleDigest) toggleDigest.checked = data.weekly_digest ?? false;
        } else {
            // Если профиля нет — создаём с дефолтными значениями
            await client.from('profiles').insert({
                id: user.id,
                display_name: user.user_metadata?.display_name || '',
                expiry_alerts: true,
                weekly_digest: false
            });
        }
    }

    await loadProfile();

    // --- СОХРАНЕНИЕ ИМЕНИ ---
    const saveBtn = document.getElementById('save-profile-btn');
    const nameInput = document.getElementById('settings-name');

    if (saveBtn && nameInput) {
        saveBtn.addEventListener('click', async () => {
            const name = nameInput.value.trim();
            if (!name) return;

            saveBtn.disabled = true;
            const originalText = saveBtn.textContent;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            try {
                // Сохраняем в profiles
                const { error: dbError } = await client
                    .from('profiles')
                    .update({ display_name: name, updated_at: new Date().toISOString() })
                    .eq('id', user.id);

                if (dbError) throw dbError;

                // Сохраняем в user_metadata (для отображения в других местах)
                await client.auth.updateUser({ data: { display_name: name } });

                saveBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
                setTimeout(() => {
                    saveBtn.textContent = originalText;
                    saveBtn.disabled = false;
                }, 1500);
            } catch (err) {
                console.error(err);
                alert('Ошибка сохранения');
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
            }
        });
    }

    // --- АВТОСОХРАНЕНИЕ ТОГГЛОВ ---
    async function saveToggle(field, value) {
        try {
            await client
                .from('profiles')
                .update({ [field]: value, updated_at: new Date().toISOString() })
                .eq('id', user.id);
        } catch (err) {
            console.error(`Ошибка сохранения ${field}:`, err);
        }
    }

    const toggleExpiry = document.getElementById('toggle-expiry');
    const toggleDigest = document.getElementById('toggle-digest');

    if (toggleExpiry) {
        toggleExpiry.addEventListener('change', (e) => {
            saveToggle('expiry_alerts', e.target.checked);
        });
    }

    if (toggleDigest) {
        toggleDigest.addEventListener('change', (e) => {
            saveToggle('weekly_digest', e.target.checked);
        });
    }

    // --- СМЕНА EMAIL ---
    const changeEmailBtn = document.getElementById('change-email-btn');
    const changeEmailForm = document.getElementById('change-email-form');
    const emailDisplayRow = document.getElementById('email-display-row');
    const newEmailInput = document.getElementById('new-email-input');
    const confirmEmailChange = document.getElementById('confirm-email-change');
    const cancelEmailChange = document.getElementById('cancel-email-change');

    if (changeEmailBtn && changeEmailForm && emailDisplayRow) {
        changeEmailBtn.addEventListener('click', () => {
            emailDisplayRow.classList.add('hidden');
            changeEmailForm.classList.remove('hidden');
            newEmailInput?.focus();
        });

        cancelEmailChange?.addEventListener('click', () => {
            changeEmailForm.classList.add('hidden');
            emailDisplayRow.classList.remove('hidden');
            if (newEmailInput) newEmailInput.value = '';
        });

        confirmEmailChange?.addEventListener('click', async () => {
            const newEmail = newEmailInput?.value.trim();
            if (!newEmail || !newEmail.includes('@')) {
                alert('Введите корректный email');
                return;
            }
            if (newEmail === user.email) {
                alert('Это ваш текущий email');
                return;
            }

            confirmEmailChange.disabled = true;
            const originalHTML = confirmEmailChange.innerHTML;
            confirmEmailChange.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            try {
                const { error } = await client.auth.updateUser({ email: newEmail });
                if (error) throw error;

                confirmEmailChange.innerHTML = '<i class="fa-solid fa-check"></i>';
                setTimeout(() => {
                    changeEmailForm.classList.add('hidden');
                    emailDisplayRow.classList.remove('hidden');
                    if (newEmailInput) newEmailInput.value = '';
                    confirmEmailChange.innerHTML = originalHTML;
                    confirmEmailChange.disabled = false;
                    alert(`Письмо с подтверждением отправлено на ${newEmail}`);
                }, 1000);
            } catch (err) {
                console.error(err);
                if (err.message?.includes('already registered')) {
                    alert('Этот email уже используется');
                } else if (err.message?.includes('rate limit')) {
                    alert('Слишком много попыток. Подождите минуту.');
                } else {
                    alert(`Ошибка: ${err.message || 'Не удалось отправить запрос'}`);
                }
                confirmEmailChange.innerHTML = originalHTML;
                confirmEmailChange.disabled = false;
            }
        });
    }

    const deleteBtn = document.getElementById('delete-account-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            // Двойное подтверждение
            const firstConfirm = confirm(
                'Вы уверены? Это действие необратимо.'
            );
            if (!firstConfirm) return;

            const secondConfirm = prompt(
                'Для подтверждения введите свой email:'
            );
            if (secondConfirm !== user.email) {
                alert('Email не совпадает. Удаление отменено.');
                return;
            }

            deleteBtn.disabled = true;
            const originalText = deleteBtn.textContent;
            deleteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Удаление...';

            try {
                const { data: files } = await client.storage
                    .from('receipts')
                    .list(user.id);

                if (files && files.length > 0) {
                    const paths = files.map(f => `${user.id}/${f.name}`);
                    await client.storage.from('receipts').remove(paths);
                }

                await client.from('receipts').delete().eq('user_id', user.id);

                await client.from('items').delete().eq('user_id', user.id);

                await client.from('profiles').delete().eq('id', user.id);

                await client.auth.signOut();

                localStorage.clear();
                sessionStorage.clear();

                window.location.href = 'index.html';

            } catch (err) {
                console.error('Ошибка удаления:', err);
                alert('Произошла ошибка при удалении. Попробуйте позже.');
                deleteBtn.textContent = originalText;
                deleteBtn.disabled = false;
            }
        });
    }
}

const settingsLink = document.querySelector('[data-view="settings"]');
if (settingsLink) {
    let initialized = false;
    settingsLink.addEventListener('click', () => {
        if (!initialized) {
            initSettings();
            initialized = true;
        }
    });
}