import { requireAuth } from './dashboard-auth.js';
import { isValidEmail, logError } from './security.js';
import { refreshNotifBadge } from './dashboard-notifications.js';
import {
    checkPasswordStrength,
    initPasswordStrength,
    initPasswordMatch
} from './password-strength.js';
import {
    populateDialCodeSelect,
    wirePhoneInputPair,
    formatPhoneDisplay,
    getDefaultPhoneCountry
} from './phone-utils.js';

function getSettingsLang() {
    return (window.getValuonLang ? window.getValuonLang() : 'en');
}

function getSettingsT() {
    const lang = getSettingsLang();
    return window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
}

async function initSettings() {
    const auth = await requireAuth();
    if (!auth) return;

    const { user, client } = auth;

    const userIdInput = document.getElementById('settings-user-id');
    const copyUserIdBtn = document.getElementById('copy-user-id-btn');
    const phoneDisplayInput = document.getElementById('settings-phone');
    const changePhoneBtn = document.getElementById('change-phone-btn');
    const removePhoneBtn = document.getElementById('remove-phone-btn');
    const changePhoneForm = document.getElementById('change-phone-form');
    const phoneCountrySelect = document.getElementById('settings-phone-country');
    const newPhoneInput = document.getElementById('new-phone-input');
    const confirmPhoneChange = document.getElementById('confirm-phone-change');
    const cancelPhoneChange = document.getElementById('cancel-phone-change');

    let currentPhoneE164 = null;
    let phonePair = null;

    if (userIdInput) userIdInput.value = user.id || '';

    if (copyUserIdBtn && user.id) {
        copyUserIdBtn.addEventListener('click', async () => {
            const t = getSettingsT();
            try {
                await navigator.clipboard.writeText(user.id);
                const iconEl = copyUserIdBtn.querySelector('i');
                const spanEl = copyUserIdBtn.querySelector('span');
                copyUserIdBtn.classList.add('is-copied');
                if (iconEl) iconEl.className = 'fa-solid fa-check';
                if (spanEl) spanEl.textContent = t.btn_copied_id || 'Скопировано';
                showToast(t.msg_user_id_copied || 'ID пользователя скопирован', 'success');
                setTimeout(() => {
                    copyUserIdBtn.classList.remove('is-copied');
                    if (iconEl) iconEl.className = 'fa-regular fa-copy';
                    const tNow = getSettingsT();
                    if (spanEl) spanEl.textContent = tNow.btn_copy_id || 'Копировать';
                }, 1800);
            } catch (err) {
                logError('settings:copyUserId', err);
            }
        });
    }

    function syncPhoneDisplayUI() {
        const t = getSettingsT();
        if (phoneDisplayInput) {
            phoneDisplayInput.value = currentPhoneE164 ? formatPhoneDisplay(currentPhoneE164) : '';
            phoneDisplayInput.placeholder = t.phone_not_set || 'Не указан';
        }
        if (changePhoneBtn) {
            const key = currentPhoneE164 ? 'btn_change_phone' : 'btn_add_phone';
            changePhoneBtn.setAttribute('data-i18n', key);
            changePhoneBtn.textContent = t[key] || (currentPhoneE164 ? 'Изменить' : 'Добавить');
        }
        if (removePhoneBtn) {
            removePhoneBtn.classList.toggle('hidden', !currentPhoneE164);
        }
    }

    if (phoneCountrySelect && newPhoneInput) {
        populateDialCodeSelect(phoneCountrySelect, getSettingsLang(), getDefaultPhoneCountry(null, getSettingsLang()));
        if (typeof CustomSelect !== 'undefined') CustomSelect.init(changePhoneForm);
        phonePair = wirePhoneInputPair(phoneCountrySelect, newPhoneInput);
    }

    async function loadProfile() {
        const emailInput = document.getElementById('settings-email');
        const firstNameInput = document.getElementById('settings-first-name');
        const lastNameInput = document.getElementById('settings-last-name');
        const birthdateInput = document.getElementById('settings-birthdate');
        const currencySelect = document.getElementById('settings-currency');
        const toggleExpiry = document.getElementById('toggle-expiry');
        const toggleDigest = document.getElementById('toggle-digest');

        if (emailInput) emailInput.value = user.email || '';

        if (currencySelect && typeof window.renderCurrencyOptions === 'function') {
            window.renderCurrencyOptions(currencySelect, getSettingsLang());
        }

        const { data, error } = await client
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') {
            logError('settings:loadProfile', error);
            return;
        }

        if (data) {
            if (firstNameInput && data.first_name) firstNameInput.value = data.first_name;
            if (lastNameInput && data.last_name) lastNameInput.value = data.last_name;
            if (birthdateInput && data.birthdate) {
                birthdateInput.value = data.birthdate;
                if (birthdateInput._cdp) birthdateInput._cdp.syncDisplay();
            }
            if (currencySelect) currencySelect.value = data.currency || 'EUR';
            if (toggleExpiry) toggleExpiry.checked = data.expiry_alerts ?? true;
            if (toggleDigest) {
                toggleDigest.checked = false;
                toggleDigest.disabled = true;
            }
            currentPhoneE164 = data.phone || user.user_metadata?.phone || user.phone || null;
        } else {
            const metaFirstName = user.user_metadata?.first_name || '';
            const metaLastName = user.user_metadata?.last_name || '';
            const metaBirthdate = user.user_metadata?.birthdate || null;
            const metaPhone = user.user_metadata?.phone || user.phone || null;

            const baseInsert = {
                id: user.id,
                email: user.email || null,
                first_name: metaFirstName,
                last_name: metaLastName,
                birthdate: metaBirthdate,
                expiry_alerts: true,
                weekly_digest: false,
                updated_at: new Date().toISOString()
            };
            const { error: insErr } = await client
                .from('profiles')
                .insert(metaPhone ? { ...baseInsert, phone: metaPhone } : baseInsert);
            if (insErr && insErr.code === '42703') {
                await client.from('profiles').insert(baseInsert);
            }

            if (firstNameInput) firstNameInput.value = metaFirstName;
            if (lastNameInput) lastNameInput.value = metaLastName;
            if (birthdateInput && metaBirthdate) {
                birthdateInput.value = metaBirthdate;
                if (birthdateInput._cdp) birthdateInput._cdp.syncDisplay();
            }
            currentPhoneE164 = metaPhone;
        }

        syncPhoneDisplayUI();

        const needsBirthdateFallback = Boolean(birthdateInput && !birthdateInput.value);
        const needsPhoneFallback = !currentPhoneE164;
        if (needsBirthdateFallback || needsPhoneFallback) {
            const { data: { user: freshUser } } = await client.auth.getUser();
            if (needsBirthdateFallback && freshUser?.user_metadata?.birthdate) {
                birthdateInput.value = freshUser.user_metadata.birthdate;
                if (birthdateInput._cdp) birthdateInput._cdp.syncDisplay();
            }
            if (needsPhoneFallback) {
                const freshPhone = freshUser?.user_metadata?.phone || freshUser?.phone || null;
                if (freshPhone) {
                    currentPhoneE164 = String(freshPhone).trim();
                    syncPhoneDisplayUI();
                }
            }
        }

        // Backfill profiles.phone if the signup trigger created the row without copying phone from auth metadata
        if (data && !data.phone && currentPhoneE164) {
            try {
                await client
                    .from('profiles')
                    .update({ phone: currentPhoneE164, updated_at: new Date().toISOString() })
                    .eq('id', user.id);
            } catch (_) { /* ignore */ }
        }
    }

    await loadProfile();

    if (typeof CustomSelect !== 'undefined') CustomSelect.refreshAll();

    if (typeof window.applyDashboardLang === 'function') {
        window.applyDashboardLang(getSettingsLang());
    }

    const saveBtn = document.getElementById('save-profile-btn');
    const firstNameInput = document.getElementById('settings-first-name');
    const lastNameInput = document.getElementById('settings-last-name');
    const birthdateInput = document.getElementById('settings-birthdate');
    const currencySelect = document.getElementById('settings-currency');
    let originalFirstName = firstNameInput?.value?.trim() || '';
    let originalLastName = lastNameInput?.value?.trim() || '';
    let originalBirthdate = birthdateInput?.value?.trim() || '';
    let originalCurrency = currencySelect?.value || '';

    let isSavingProfile = false;

    function updateSaveButtonState() {
        if (!saveBtn || !firstNameInput || !lastNameInput) return;
        if (isSavingProfile) {
            saveBtn.disabled = true;
            return;
        }
        const currentFirst = firstNameInput.value.trim();
        const currentLast = lastNameInput.value.trim();
        const currentBirthdate = birthdateInput?.value?.trim() || '';
        const currentCurrency = currencySelect?.value || '';
        const hasChanges = currentFirst !== originalFirstName || currentLast !== originalLastName
            || currentBirthdate !== originalBirthdate || currentCurrency !== originalCurrency;
        const isValid = currentFirst.length > 0 && currentLast.length > 0;
        saveBtn.disabled = !hasChanges || !isValid;
    }

    if (firstNameInput) firstNameInput.addEventListener('input', updateSaveButtonState);
    if (lastNameInput) lastNameInput.addEventListener('input', updateSaveButtonState);
    if (birthdateInput) {
        birthdateInput.addEventListener('input', updateSaveButtonState);
        birthdateInput.addEventListener('change', updateSaveButtonState);
    }
    if (currencySelect) currencySelect.addEventListener('change', updateSaveButtonState);

    window.addEventListener('lang-changed', (e) => {
        const nextLang = e.detail?.lang || getSettingsLang();
        if (currencySelect && typeof window.renderCurrencyOptions === 'function') {
            window.renderCurrencyOptions(currencySelect, nextLang);
        }
        if (phoneCountrySelect) {
            populateDialCodeSelect(phoneCountrySelect, nextLang, phoneCountrySelect.value || getDefaultPhoneCountry(null, nextLang));
        }
        syncPhoneDisplayUI();
        if (typeof CustomSelect !== 'undefined') CustomSelect.refreshAll();
    });

    updateSaveButtonState();

    if (saveBtn && firstNameInput && lastNameInput) {
        saveBtn.addEventListener('click', async () => {
            if (isSavingProfile) return;
            const firstName = firstNameInput.value.trim();
            const lastName = lastNameInput.value.trim();
            const birthdate = birthdateInput?.value?.trim() || '';
            const t = getSettingsT();
            const isRu = getSettingsLang() === 'ru';

            if (!firstName || !lastName) {
                showToast(t.msg_name_required || 'Name required', 'warning');
                return;
            }

            if (birthdate) {
                const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdate);
                const parsed = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
                const validDate = parsed && parsed.getFullYear() === Number(m[1]) && parsed.getMonth() === Number(m[2]) - 1 && parsed.getDate() === Number(m[3]);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (!validDate || parsed > today) {
                    showToast(isRu ? 'Проверьте корректность даты рождения' : 'Please check the birth date', 'warning');
                    return;
                }
                let age = today.getFullYear() - parsed.getFullYear();
                const md = today.getMonth() - parsed.getMonth();
                if (md < 0 || (md === 0 && today.getDate() < parsed.getDate())) age--;
                if (age < 16) {
                    showToast(isRu ? 'Вам должно быть не менее 16 лет' : 'You must be at least 16 years old', 'warning');
                    return;
                }
                if (age > 120) {
                    showToast(isRu ? 'Проверьте корректность даты рождения' : 'Please check the birth date', 'warning');
                    return;
                }
            }

            isSavingProfile = true;
            saveBtn.disabled = true;
            const originalHTML = saveBtn.innerHTML;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            const currency = currencySelect?.value || 'EUR';

            try {
                const displayName = [firstName, lastName].filter(Boolean).join(' ').trim();
                const { error: dbError } = await client
                    .from('profiles')
                    .update({
                        first_name: firstName,
                        last_name: lastName,
                        birthdate: birthdate || null,
                        currency: currency,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', user.id);

                if (dbError) throw dbError;

                const { error: authUpdateErr } = await client.auth.updateUser({
                    data: {
                        first_name: firstName,
                        last_name: lastName,
                        display_name: displayName,
                        birthdate: birthdate || null,
                    }
                });
                if (authUpdateErr) throw authUpdateErr;

                originalFirstName = firstName;
                originalLastName = lastName;
                originalBirthdate = birthdate;
                originalCurrency = currency;
                window.dispatchEvent(new CustomEvent('currency-changed', { detail: { currency } }));

                saveBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
                const tSuccess = getSettingsT();
                showToast(tSuccess.msg_save_success || 'Данные успешно сохранены', 'success');
                setTimeout(() => {
                    saveBtn.innerHTML = originalHTML;
                    isSavingProfile = false;
                    updateSaveButtonState();
                }, 1500);
            } catch (err) {
                logError('settings:save', err);
                showToast(t.msg_save_error || 'Save failed', 'error');
                saveBtn.innerHTML = originalHTML;
                isSavingProfile = false;
                updateSaveButtonState();
            }
        });
    }

    async function saveToggle(field, value, toggleEl) {
        if (toggleEl) toggleEl.disabled = true;
        try {
            const { error } = await client
                .from('profiles')
                .update({ [field]: value, updated_at: new Date().toISOString() })
                .eq('id', user.id);
            if (error) throw error;
            return true;
        } catch (err) {
            if (toggleEl) toggleEl.checked = !value;
            logError('settings:updateField', err);
            showToast(getSettingsT().msg_save_error || 'Save failed', 'error');
            return false;
        } finally {
            if (toggleEl) toggleEl.disabled = false;
        }
    }

    const toggleExpiry = document.getElementById('toggle-expiry');
    const toggleDigest = document.getElementById('toggle-digest');
    const togglePush = document.getElementById('toggle-push');
    const togglePushDesc = document.getElementById('toggle-push-desc');
    const pushRow = document.getElementById('setting-row-push');

    if (toggleExpiry) {
        toggleExpiry.addEventListener('change', async (e) => {
            const ok = await saveToggle('expiry_alerts', e.target.checked, toggleExpiry);
            if (ok) await refreshNotifBadge();
        });
    }

    if (togglePush) {
        const VAPID_PUBLIC_KEY = 'BM8PQ-efLG9aF1Aed640ahohayqvpbTy2aF6gd21Ao0cUmHhTn3PFNr1cfZBZQVt8LLsbQNbaRs6PiaD05YuDk4';

        const urlBase64ToUint8Array = (base64String) => {
            const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
            const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
            const rawData = atob(base64);
            const output = new Uint8Array(rawData.length);
            for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
            return output;
        };

        const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
        const isStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
        const pushSupported = ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);

        const setPushDescKey = (key, fallback) => {
            if (!togglePushDesc) return;
            togglePushDesc.setAttribute('data-i18n', key);
            const t = getSettingsT();
            togglePushDesc.textContent = t[key] || fallback;
        };

        const initPushState = async () => {
            if (isIos && !isStandalone) {
                togglePush.checked = false;
                togglePush.disabled = true;
                pushRow?.classList.add('is-disabled');
                setPushDescKey('setting_push_ios_hint', 'Add Valuon to Home Screen to enable push notifications');
                return;
            }
            if (!pushSupported) {
                togglePush.checked = false;
                togglePush.disabled = true;
                pushRow?.classList.add('is-disabled');
                setPushDescKey('setting_push_unsupported', 'This browser does not support push notifications');
                return;
            }
            if (Notification.permission === 'denied') {
                togglePush.checked = false;
                togglePush.disabled = true;
                pushRow?.classList.add('is-disabled');
                setPushDescKey('setting_push_denied', 'Notifications are blocked in browser settings');
                return;
            }
            try {
                const reg = await navigator.serviceWorker.ready;
                const sub = await reg.pushManager.getSubscription();
                togglePush.checked = Boolean(sub);
                if (sub) {
                    const lang = getSettingsLang();
                    await client
                        .from('push_subscriptions')
                        .update({ lang, updated_at: new Date().toISOString() })
                        .eq('endpoint', sub.endpoint)
                        .eq('user_id', user.id);
                }
            } catch (err) {
                logError('settings:pushInit', err);
            }
        };

        initPushState();

        togglePush.addEventListener('change', async () => {
            const wantEnable = togglePush.checked;
            const t = getSettingsT();
            togglePush.disabled = true;

            try {
                const reg = await navigator.serviceWorker.ready;
                if (wantEnable) {
                    const permission = Notification.permission === 'granted'
                        ? 'granted'
                        : await Notification.requestPermission();

                    if (permission !== 'granted') {
                        togglePush.checked = false;
                        if (permission === 'denied') {
                            pushRow?.classList.add('is-disabled');
                            setPushDescKey('setting_push_denied', 'Notifications are blocked in browser settings');
                            return;
                        }
                        return;
                    }

                    let sub = await reg.pushManager.getSubscription();
                    if (!sub) {
                        sub = await reg.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
                        });
                    }

                    const json = sub.toJSON();
                    const p256dh = json?.keys?.p256dh || '';
                    const authKey = json?.keys?.auth || '';
                    if (!sub.endpoint || !p256dh || !authKey) {
                        throw new Error('Incomplete push subscription');
                    }

                    const { error: saveErr } = await client
                        .from('push_subscriptions')
                        .upsert({
                            user_id: user.id,
                            endpoint: sub.endpoint,
                            p256dh,
                            auth: authKey,
                            lang: getSettingsLang(),
                            user_agent: (navigator.userAgent || '').slice(0, 250),
                            updated_at: new Date().toISOString(),
                        }, { onConflict: 'endpoint' });

                    if (saveErr) throw saveErr;

                    showToast(t.msg_push_enabled || 'Push notifications enabled', 'success');
                    // Fire a welcome confirmation push in background
                    client.functions.invoke('send-push', { body: { test: true } }).catch(() => {});
                } else {
                    const sub = await reg.pushManager.getSubscription();
                    if (sub) {
                        const endpoint = sub.endpoint;
                        await sub.unsubscribe().catch(() => {});
                        await client
                            .from('push_subscriptions')
                            .delete()
                            .eq('endpoint', endpoint)
                            .eq('user_id', user.id);
                    }
                    showToast(t.msg_push_disabled || 'Push notifications disabled', 'info');
                }
            } catch (err) {
                logError('settings:pushToggle', err);
                togglePush.checked = !wantEnable;
                showToast(t.msg_push_error || 'Failed to configure push notifications', 'error');
            } finally {
                if (Notification.permission !== 'denied' && !(isIos && !isStandalone) && pushSupported) {
                    togglePush.disabled = false;
                }
            }
        });

        window.addEventListener('lang-changed', async () => {
            if (!togglePush.checked || !pushSupported) return;
            try {
                const reg = await navigator.serviceWorker.ready;
                const sub = await reg.pushManager.getSubscription();
                if (sub) {
                    await client
                        .from('push_subscriptions')
                        .update({ lang: getSettingsLang(), updated_at: new Date().toISOString() })
                        .eq('endpoint', sub.endpoint)
                        .eq('user_id', user.id);
                }
            } catch (_) {}
        });
    }

    if (toggleDigest) {
        toggleDigest.checked = false;
        toggleDigest.disabled = true;
    }

    const changeEmailBtn = document.getElementById('change-email-btn');
    const changeEmailForm = document.getElementById('change-email-form');
    const emailDisplayRow = document.getElementById('email-display-row');
    const newEmailInput = document.getElementById('new-email-input');
    const confirmEmailChange = document.getElementById('confirm-email-change');
    const cancelEmailChange = document.getElementById('cancel-email-change');
    let emailCheckTimeout = null;

    function setExpandPanel(el, open) {
        if (!el) return;
        el.classList.toggle('is-open', open);
        el.setAttribute('aria-hidden', String(!open));
        el.inert = !open;
    }

    function restoreSaveButton(btn) {
        if (!btn) return;
        const t = getSettingsT();
        const span = document.createElement('span');
        span.setAttribute('data-i18n', 'btn_save');
        span.textContent = t.btn_save || 'Save';
        btn.replaceChildren(span);
        btn.disabled = false;
    }

    function resetEmailForm() {
        clearTimeout(emailCheckTimeout);
        setExpandPanel(changeEmailForm, false);
        changeEmailBtn?.classList.remove('hidden');
        if (newEmailInput) newEmailInput.value = '';
        restoreSaveButton(confirmEmailChange);
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

        newEmailInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmEmailChange?.click();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                resetEmailForm();
            }
        });
    }

    if (changeEmailBtn && changeEmailForm && emailDisplayRow) {
        changeEmailBtn.addEventListener('click', () => {
            setExpandPanel(changeEmailForm, true);
            changeEmailBtn.classList.add('hidden');
            newEmailInput?.focus();
        });

        cancelEmailChange?.addEventListener('click', resetEmailForm);

        confirmEmailChange?.addEventListener('click', async () => {
            const newEmail = newEmailInput?.value.trim();
            const t = getSettingsT();

            if (!newEmail || !isValidEmail(newEmail)) {
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
                logError('settings:emailChange', err);
                const errMsg = (err.message || '').toLowerCase();
                let msg;
                if (errMsg.includes('already') && errMsg.includes('registered')) {
                    msg = t.msg_email_in_use || 'This email is already in use';
                } else if (errMsg.includes('rate limit') || errMsg.includes('too many')) {
                    msg = t.msg_rate_limit || 'Too many attempts. Please wait a minute.';
                } else {
                    msg = t.msg_save_error || 'Save failed';
                }
                showToast(msg, 'error');
                confirmEmailChange.innerHTML = originalHTML;
                confirmEmailChange.disabled = false;
            }
        });
    }

    let removePhoneConfirmTimer = null;
    let isConfirmingRemovePhone = false;

    function resetRemovePhoneConfirm() {
        if (!removePhoneBtn) return;
        clearTimeout(removePhoneConfirmTimer);
        removePhoneConfirmTimer = null;
        isConfirmingRemovePhone = false;
        removePhoneBtn.classList.remove('is-confirming');
        removePhoneBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        const t = getSettingsT();
        const label = t.btn_remove_phone || 'Удалить номер';
        removePhoneBtn.setAttribute('aria-label', label);
        removePhoneBtn.setAttribute('title', label);
    }

    function resetPhoneForm() {
        resetRemovePhoneConfirm();
        setExpandPanel(changePhoneForm, false);
        changePhoneBtn?.classList.remove('hidden');
        if (removePhoneBtn) removePhoneBtn.classList.toggle('hidden', !currentPhoneE164);
        if (newPhoneInput) newPhoneInput.value = '';
        restoreSaveButton(confirmPhoneChange);
    }

    if (newPhoneInput) {
        newPhoneInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmPhoneChange?.click();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                resetPhoneForm();
            }
        });
    }

    if (changePhoneBtn && changePhoneForm) {
        changePhoneBtn.addEventListener('click', () => {
            resetRemovePhoneConfirm();
            setExpandPanel(changePhoneForm, true);
            changePhoneBtn.classList.add('hidden');
            removePhoneBtn?.classList.add('hidden');
            if (currentPhoneE164 && phonePair) {
                phonePair.setFromE164(currentPhoneE164);
            } else {
                phonePair?.syncTrigger();
            }
            newPhoneInput?.focus();
        });

        cancelPhoneChange?.addEventListener('click', resetPhoneForm);

        confirmPhoneChange?.addEventListener('click', async () => {
            const t = getSettingsT();
            const normalized = phonePair ? phonePair.getNormalized() : null;

            if (!normalized) {
                showToast(t.msg_valid_phone || 'Введите корректный номер телефона', 'warning');
                newPhoneInput?.focus();
                return;
            }

            if (normalized === currentPhoneE164) {
                showToast(t.msg_same_phone || 'Это ваш текущий номер телефона', 'warning');
                return;
            }

            confirmPhoneChange.disabled = true;
            const originalHTML = confirmPhoneChange.innerHTML;
            confirmPhoneChange.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            try {
                const { error: updErr } = await client
                    .from('profiles')
                    .update({
                        phone: normalized,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', user.id);

                if (updErr) throw updErr;

                await client.auth.updateUser({ data: { phone: normalized } }).catch(() => { });

                currentPhoneE164 = normalized;
                syncPhoneDisplayUI();

                let boundCount = 0;
                try {
                    const { data: bindRes } = await client.rpc('bind_pending_receipts');
                    if (typeof bindRes === 'number') boundCount = bindRes;
                } catch (bindErr) {
                    logError('settings:bindAfterPhone', bindErr);
                }

                window.dispatchEvent(new CustomEvent('phone-changed', {
                    detail: { phone: normalized, boundCount }
                }));

                confirmPhoneChange.innerHTML = '<i class="fa-solid fa-check"></i>';
                setTimeout(() => {
                    resetPhoneForm();
                    const tSuccess = getSettingsT();
                    if (boundCount > 0) {
                        const tpl = tSuccess.msg_phone_saved_bound || 'Номер сохранён! Привязано новых чеков: {count}';
                        showToast(tpl.replace('{count}', String(boundCount)), 'success');
                    } else {
                        showToast(tSuccess.msg_phone_saved || 'Номер телефона сохранён', 'success');
                    }
                    refreshNotifBadge();
                }, 600);
            } catch (err) {
                logError('settings:phoneChange', err);
                const tErr = getSettingsT();
                if (err?.code === '23505') {
                    showToast(tErr.msg_phone_in_use || 'Этот номер телефона уже привязан к другому аккаунту', 'error');
                } else {
                    showToast(tErr.msg_save_error || 'Ошибка сохранения', 'error');
                }
                confirmPhoneChange.innerHTML = originalHTML;
                confirmPhoneChange.disabled = false;
            }
        });
    }

    if (removePhoneBtn) {
        document.addEventListener('click', (e) => {
            const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
            if (isConfirmingRemovePhone && !removePhoneBtn.contains(e.target) && !path.includes(removePhoneBtn)) {
                resetRemovePhoneConfirm();
            }
        });

        window.addEventListener('lang-changed', () => {
            if (isConfirmingRemovePhone) resetRemovePhoneConfirm();
        });

        removePhoneBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!currentPhoneE164) return;
            const t = getSettingsT();

            if (!isConfirmingRemovePhone) {
                isConfirmingRemovePhone = true;
                removePhoneBtn.classList.add('is-confirming');
                const confirmText = t.btn_confirm_remove || 'Удалить?';
                removePhoneBtn.innerHTML = `<i class="fa-solid fa-trash-can"></i><span>${confirmText}</span>`;
                removePhoneBtn.setAttribute('aria-label', confirmText);
                removePhoneBtn.setAttribute('title', confirmText);
                clearTimeout(removePhoneConfirmTimer);
                removePhoneConfirmTimer = setTimeout(resetRemovePhoneConfirm, 3500);
                return;
            }

            clearTimeout(removePhoneConfirmTimer);
            removePhoneConfirmTimer = null;
            isConfirmingRemovePhone = false;
            removePhoneBtn.classList.remove('is-confirming');
            removePhoneBtn.disabled = true;
            removePhoneBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            try {
                const { error } = await client
                    .from('profiles')
                    .update({
                        phone: null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', user.id);
                if (error) throw error;

                await client.auth.updateUser({ data: { phone: null } }).catch(() => { });

                currentPhoneE164 = null;
                syncPhoneDisplayUI();
                showToast(t.msg_phone_removed || 'Номер телефона удалён. Все ваши чеки остались в аккаунте.', 'success');
                window.dispatchEvent(new CustomEvent('phone-changed', { detail: { phone: null, boundCount: 0 } }));
            } catch (err) {
                logError('settings:phoneRemove', err);
                showToast(t.msg_save_error || 'Ошибка сохранения', 'error');
            } finally {
                resetRemovePhoneConfirm();
                removePhoneBtn.disabled = false;
            }
        });
    }

    const themeBtn = document.getElementById('settings-theme-toggle');
    const langBtn = document.getElementById('settings-lang-toggle');

    if (themeBtn) {
        updateThemeLabelSync();

        themeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            if (newTheme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
            } else {
                document.documentElement.removeAttribute('data-theme');
            }
            localStorage.setItem('valuon-theme', newTheme);
            updateThemeLabelSync();
            window.dispatchEvent(new CustomEvent('themeChange'));
        });
    }

    if (langBtn) {
        const readCurrentLang = () => (
            window.getValuonLang
                ? window.getValuonLang()
                : (localStorage.getItem('valuon-lang') || document.documentElement.lang || 'en')
        );

        const updateLangBtn = () => {
            const lang = readCurrentLang();
            const label = document.getElementById('settings-lang-label');
            if (label) label.textContent = lang.toUpperCase();
        };

        updateLangBtn();

        langBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const currentLang = readCurrentLang();
            const newLang = currentLang === 'ru' ? 'en' : 'ru';
            if (window.applyDashboardLang) {
                window.applyDashboardLang(newLang);
            }
        });

        window.addEventListener('lang-changed', updateLangBtn);
    }

    // --- In-App Password Change (Security Section) ---
    const changePasswordBtn = document.getElementById('change-password-btn');
    const passwordChangeWrap = document.getElementById('password-change-wrap');
    const passwordChangeForm = document.getElementById('password-change-form');
    const newPwInput = document.getElementById('settings-new-password');
    const confirmPwInput = document.getElementById('settings-confirm-password');
    const cancelPasswordBtn = document.getElementById('cancel-password-btn');
    const savePasswordBtn = document.getElementById('save-password-btn');
    const pwErrorEl = document.getElementById('settings-password-error');

    if (changePasswordBtn && passwordChangeWrap && passwordChangeForm) {
        const strengthContainer = initPasswordStrength('settings-new-password', { getLang: getSettingsLang });
        const matchCtrl = initPasswordMatch('settings-new-password', 'settings-confirm-password', { getLang: getSettingsLang });

        const setPwError = (msg) => {
            if (pwErrorEl) pwErrorEl.textContent = msg || '';
        };

        const setPasswordFormOpen = (open) => {
            passwordChangeWrap.classList.toggle('is-open', open);
            passwordChangeWrap.setAttribute('aria-hidden', String(!open));
            changePasswordBtn.classList.toggle('hidden', open);
            if (!open) {
                passwordChangeForm.reset();
                setPwError('');
                strengthContainer?.classList.remove('ps-visible');
                matchCtrl?.update();
                passwordChangeForm.querySelectorAll('input[type="text"]').forEach(inp => { inp.type = 'password'; });
                passwordChangeForm.querySelectorAll('.pw-eye-btn i').forEach(ic => { ic.className = 'fa-regular fa-eye'; });
            } else {
                setTimeout(() => newPwInput?.focus(), 120);
            }
        };

        changePasswordBtn.addEventListener('click', () => setPasswordFormOpen(true));
        cancelPasswordBtn?.addEventListener('click', () => setPasswordFormOpen(false));

        passwordChangeForm.querySelectorAll('[data-pw-toggle]').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = document.getElementById(btn.dataset.pwToggle);
                if (!target) return;
                const show = target.type === 'password';
                target.type = show ? 'text' : 'password';
                const icon = btn.querySelector('i');
                if (icon) icon.className = show ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
            });
        });

        [newPwInput, confirmPwInput].forEach(inp => {
            inp?.addEventListener('input', () => setPwError(''));
        });

        let pwSubmitting = false;
        passwordChangeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (pwSubmitting) return;
            const t = getSettingsT();
            const lang = getSettingsLang();

            const newPw = newPwInput?.value || '';
            const confPw = confirmPwInput?.value || '';

            const strength = checkPasswordStrength(newPw);
            if (!strength.isValid) {
                setPwError(t.pw_err_weak || (lang === 'en' ? 'New password is too weak' : 'Новый пароль слишком слабый'));
                newPwInput?.focus();
                return;
            }
            if (newPw !== confPw) {
                setPwError(t.pw_err_mismatch || (lang === 'en' ? 'Passwords do not match' : 'Пароли не совпадают'));
                confirmPwInput?.focus();
                return;
            }

            pwSubmitting = true;
            setPwError('');
            if (savePasswordBtn) savePasswordBtn.disabled = true;

            try {
                const { error: updateErr } = await client.auth.updateUser({ password: newPw });
                if (updateErr) {
                    const code = updateErr.code || '';
                    const msg = String(updateErr.message || '').toLowerCase();
                    if (code === 'same_password' || msg.includes('different from the old password')) {
                        setPwError(t.pw_err_same || (lang === 'en' ? 'New password must be different from the current one' : 'Новый пароль должен отличаться от текущего'));
                    } else {
                        setPwError(t.pw_update_failed || (lang === 'en' ? 'Failed to update password' : 'Не удалось обновить пароль'));
                    }
                    return;
                }

                setPasswordFormOpen(false);
                if (typeof window.showToast === 'function') {
                    window.showToast(t.pw_updated_toast || (lang === 'en' ? 'Password updated successfully' : 'Пароль успешно обновлён'), 'success');
                }
            } catch (err) {
                logError('settings:changePassword', err);
                setPwError(t.pw_update_failed || (lang === 'en' ? 'Failed to update password' : 'Не удалось обновить пароль'));
            } finally {
                pwSubmitting = false;
                if (savePasswordBtn) savePasswordBtn.disabled = false;
            }
        });
    }
}

let settingsInitialized = false;

function updateThemeLabelSync() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const icon = document.querySelector('#settings-theme-toggle i');
    if (icon) icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    const label = document.getElementById('settings-theme-label');
    if (!label) return;
    const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
    const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
    label.textContent = isDark ? (t.setting_light_theme || 'Светлая') : (t.setting_dark_theme || 'Тёмная');
}

updateThemeLabelSync();
window.addEventListener('lang-changed', updateThemeLabelSync);
window.addEventListener('themeChange', updateThemeLabelSync);

async function ensureSettingsLoaded() {
    requestAnimationFrame(() => {
        document.querySelectorAll('#view-settings [data-animate]').forEach(el => el.classList.add('is-visible'));
    });
    if (settingsInitialized) return;
    settingsInitialized = true;
    updateThemeLabelSync();
    try {
        await initSettings();
    } catch (e) {
        logError('settings:init', e);
        settingsInitialized = false;
    }
}

document.querySelectorAll('[data-view="settings"]').forEach(el => {
    el.addEventListener('click', ensureSettingsLoaded);
});

window.addEventListener('dashboard-view-changed', (e) => {
    if (e.detail?.viewId === 'view-settings') {
        ensureSettingsLoaded();
    }
});

if (window.location.hash === '#view-settings' || window.__targetView === 'view-settings' || sessionStorage.getItem('dashboard-view') === 'view-settings') {
    ensureSettingsLoaded();
}