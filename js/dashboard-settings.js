import { requireAuth } from './dashboard-auth.js';

async function initSettings() {
    const auth = await requireAuth();
    if (!auth) return;

    const { user, client } = auth;

    async function loadProfile() {
        const emailInput = document.getElementById('settings-email');
        const firstNameInput = document.getElementById('settings-first-name');
        const lastNameInput = document.getElementById('settings-last-name');
        const birthdateInput = document.getElementById('settings-birthdate');
        const toggleExpiry = document.getElementById('toggle-expiry');
        const toggleDigest = document.getElementById('toggle-digest');

        if (emailInput) emailInput.value = user.email || '';

        const { data, error } = await client
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error(error);
            return;
        }

        if (data) {
            if (firstNameInput && data.first_name) firstNameInput.value = data.first_name;
            if (lastNameInput && data.last_name) lastNameInput.value = data.last_name;
            if (birthdateInput && data.birthdate) birthdateInput.value = data.birthdate;
            if (toggleExpiry) toggleExpiry.checked = data.expiry_alerts ?? true;
            if (toggleDigest) toggleDigest.checked = data.weekly_digest ?? false;
        } else {
            const metaFirstName = user.user_metadata?.first_name || '';
            const metaLastName = user.user_metadata?.last_name || '';
            const metaBirthdate = user.user_metadata?.birthdate || null;

            await client.from('profiles').insert({
                id: user.id,
                first_name: metaFirstName,
                last_name: metaLastName,
                display_name: `${metaFirstName} ${metaLastName}`.trim(),
                birthdate: metaBirthdate,
                expiry_alerts: true,
                weekly_digest: false
            });

            if (firstNameInput) firstNameInput.value = metaFirstName;
            if (lastNameInput) lastNameInput.value = metaLastName;
            if (birthdateInput && metaBirthdate) birthdateInput.value = metaBirthdate;
        }

        if (birthdateInput && !birthdateInput.value) {
            const { data: { user: freshUser } } = await client.auth.getUser();
            if (freshUser?.user_metadata?.birthdate) {
                birthdateInput.value = freshUser.user_metadata.birthdate;
            }
        }
    }

    await loadProfile();

    const saveBtn = document.getElementById('save-profile-btn');
    const firstNameInput = document.getElementById('settings-first-name');
    const lastNameInput = document.getElementById('settings-last-name');

    if (saveBtn && firstNameInput && lastNameInput) {
        saveBtn.addEventListener('click', async () => {
            const firstName = firstNameInput.value.trim();
            const lastName = lastNameInput.value.trim();
            const lang = localStorage.getItem('valuon-lang') || 'ru';

            if (!firstName || !lastName) {
                if (typeof showToast === 'function') {
                    showToast(lang === 'ru' ? 'Имя и фамилия обязательны' : 'First and last name are required', 'warning');
                } else {
                    alert(lang === 'ru' ? 'Имя и фамилия обязательны' : 'First and last name are required');
                }
                return;
            }

            const displayName = `${firstName} ${lastName}`;

            saveBtn.disabled = true;
            const originalHTML = saveBtn.innerHTML;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            try {
                const { error: dbError } = await client
                    .from('profiles')
                    .update({
                        first_name: firstName,
                        last_name: lastName,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', user.id);

                if (dbError) throw dbError;

                await client.auth.updateUser({
                    data: {
                        first_name: firstName,
                        last_name: lastName,
                    }
                });

                saveBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
                setTimeout(() => {
                    saveBtn.innerHTML = originalHTML;
                    saveBtn.disabled = false;
                }, 1500);
            } catch (err) {
                console.error('Save profile error:', err);
                const msg = err.message || 'Unknown error';
                if (typeof showToast === 'function') {
                    showToast(lang === 'ru' ? `Ошибка: ${msg}` : `Error: ${msg}`, 'error');
                } else {
                    showToast(msg);
                }
                saveBtn.innerHTML = originalHTML;
                saveBtn.disabled = false;
            }
        });
    }

    async function saveToggle(field, value) {
        try {
            await client
                .from('profiles')
                .update({ [field]: value, updated_at: new Date().toISOString() })
                .eq('id', user.id);
        } catch (err) {
            console.error(err);
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
            const lang = localStorage.getItem('valuon-lang') || 'ru';

            if (!newEmail || !newEmail.includes('@')) {
                showToast(lang === 'ru' ? 'Введите корректный email' : 'Enter a valid email', 'warning');
                return;
            }

            if (newEmail === user.email) {
                showToast(lang === 'ru' ? 'Это ваш текущий email' : 'This is your current email', 'warning');
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
                    showToast(
                        lang === 'ru'
                            ? `Письмо с подтверждением отправлено на ${newEmail}`
                            : `Confirmation email sent to ${newEmail}`,
                        'success'
                    );
                }, 1000);
            } catch (err) {
                console.error(err);
                let msg = err.message || 'Failed to send request';
                if (err.message?.includes('already registered')) {
                    msg = lang === 'ru' ? 'Этот email уже используется' : 'This email is already in use';
                } else if (err.message?.includes('rate limit')) {
                    msg = lang === 'ru' ? 'Слишком много попыток. Подождите минуту.' : 'Too many attempts. Please wait a minute.';
                }
                showToast(msg, 'error');
                confirmEmailChange.innerHTML = originalHTML;
                confirmEmailChange.disabled = false;
            }
        });
    }

    const deleteBtn = document.getElementById('delete-account-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            const lang = localStorage.getItem('valuon-lang') || 'ru';

            const firstConfirm = confirm(
                lang === 'ru' ? 'Вы уверены? Это действие необратимо.' : 'Are you sure? This action is irreversible.'
            );
            if (!firstConfirm) return;

            const secondConfirm = prompt(
                lang === 'ru' ? 'Для подтверждения введите свой email:' : 'To confirm, enter your email:'
            );
            if (secondConfirm !== user.email) {
                showToast(lang === 'ru' ? 'Email не совпадает. Удаление отменено.' : 'Email does not match. Deletion cancelled.', 'warning');
                return;
            }

            deleteBtn.disabled = true;
            const originalText = deleteBtn.textContent;
            deleteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            try {
                const { data: files } = await client.storage.from('receipts').list(user.id);
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
                console.error(err);
                showToast(lang === 'ru' ? 'Ошибка удаления. Попробуйте позже.' : 'Deletion failed. Try again later.', 'error');
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