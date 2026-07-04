import { requireAuth } from './dashboard-auth.js';

function getSettingsLang() {
    return localStorage.getItem('valuon-lang') || 'ru';
}

function getSettingsT() {
    const lang = getSettingsLang();
    return window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
}

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

    if (typeof window.applyDashboardLang === 'function') {
        window.applyDashboardLang(getSettingsLang());
    }

    const saveBtn = document.getElementById('save-profile-btn');
    const firstNameInput = document.getElementById('settings-first-name');
    const lastNameInput = document.getElementById('settings-last-name');
    let originalFirstName = firstNameInput?.value?.trim() || '';
    let originalLastName = lastNameInput?.value?.trim() || '';

    function updateSaveButtonState() {
        if (!saveBtn || !firstNameInput || !lastNameInput) return;
        const currentFirst = firstNameInput.value.trim();
        const currentLast = lastNameInput.value.trim();
        const hasChanges = currentFirst !== originalFirstName || currentLast !== originalLastName;
        const isValid = currentFirst.length > 0 && currentLast.length > 0;
        saveBtn.disabled = !hasChanges || !isValid;
    }

    if (firstNameInput) firstNameInput.addEventListener('input', updateSaveButtonState);
    if (lastNameInput) lastNameInput.addEventListener('input', updateSaveButtonState);

    updateSaveButtonState();

    if (saveBtn && firstNameInput && lastNameInput) {
        saveBtn.addEventListener('click', async () => {
            const firstName = firstNameInput.value.trim();
            const lastName = lastNameInput.value.trim();
            const t = getSettingsT();

            if (!firstName || !lastName) {
                showToast(t.msg_name_required || 'Name required', 'warning');
                return;
            }

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

                originalFirstName = firstName;
                originalLastName = lastName;

                saveBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
                const tSuccess = getSettingsT();
                showToast(tSuccess.msg_save_success || 'Данные успешно сохранены', 'success');
                setTimeout(() => {
                    saveBtn.innerHTML = originalHTML;
                    updateSaveButtonState();
                }, 1500);
            } catch (err) {
                console.error(err);
                showToast((t.msg_save_error || 'Save failed') + ': ' + (err.message || ''), 'error');
                saveBtn.innerHTML = originalHTML;
                updateSaveButtonState();
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
    let emailCheckTimeout = null;

    function resetEmailForm() {
        clearTimeout(emailCheckTimeout);
        changeEmailForm?.classList.add('hidden');
        changeEmailBtn?.classList.remove('hidden');
        if (newEmailInput) newEmailInput.value = '';
        if (confirmEmailChange) {
            confirmEmailChange.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
            confirmEmailChange.disabled = false;
        }
    }

    if (newEmailInput) {
        newEmailInput.addEventListener('input', () => {
            clearTimeout(emailCheckTimeout);
            const val = newEmailInput.value.trim();
            if (!val) return;
            emailCheckTimeout = setTimeout(() => {
                const currentEmail = user.email?.toLowerCase() || '';
                if (val.toLowerCase() === currentEmail) {
                    const t = getSettingsT();
                    showToast(t.msg_same_email || 'This is your current email', 'warning');
                }
            }, 600);
        });
    }

    if (changeEmailBtn && changeEmailForm && emailDisplayRow) {
        changeEmailBtn.addEventListener('click', () => {
            changeEmailForm.classList.remove('hidden');
            changeEmailBtn.classList.add('hidden');
            newEmailInput?.focus();
        });

        cancelEmailChange?.addEventListener('click', resetEmailForm);

        confirmEmailChange?.addEventListener('click', async () => {
            const newEmail = newEmailInput?.value.trim();
            const t = getSettingsT();

            if (!newEmail || !newEmail.includes('@')) {
                showToast(t.msg_valid_email || 'Enter a valid email', 'warning');
                return;
            }

            if (newEmail.toLowerCase() === user.email?.toLowerCase()) {
                showToast(t.msg_same_email || 'This is your current email', 'warning');
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
                    resetEmailForm();
                    const msg = (t.msg_confirm_sent || 'Confirmation sent to {email}').replace('{email}', newEmail);
                    showToast(msg, 'success');
                }, 1000);
            } catch (err) {
                console.error(err);
                let msg = err.message || 'Failed';
                if (err.message?.includes('already registered')) {
                    msg = t.msg_email_in_use || 'Email in use';
                } else if (err.message?.includes('rate limit')) {
                    msg = t.msg_rate_limit || 'Rate limit';
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
            const t = getSettingsT();

            const firstConfirm = confirm(t.confirm_delete_title || 'Are you sure?');
            if (!firstConfirm) return;

            const secondConfirm = prompt(t.prompt_delete_email || 'Enter your email:');
            if (secondConfirm !== user.email) {
                showToast(t.msg_email_mismatch || 'Email mismatch', 'warning');
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
                showToast(t.msg_delete_failed || 'Deletion failed', 'error');
                deleteBtn.textContent = originalText;
                deleteBtn.disabled = false;
            }
        });
    }
}

const settingsLink = document.querySelector('[data-view="settings"]');
let settingsInitialized = false;

function ensureSettingsLoaded() {
    if (!settingsInitialized) {
        initSettings();
        settingsInitialized = true;
    }
}

if (settingsLink) {
    settingsLink.addEventListener('click', ensureSettingsLoaded);
}

if (window.location.hash === '#view-settings') {
    ensureSettingsLoaded();
}