import { supabase, setSessionOnly } from './supabase-client.js';
import { checkLoginRateLimit, resetLoginRateLimit, setLoadingButton, resetLoadingButton, isValidEmail, logError, mountTurnstile } from './security.js';
import { populateDialCodeSelect, wirePhoneInputPair, getDefaultPhoneCountry } from './phone-utils.js';
import { createSegmentedIndicator, prefersReducedMotion } from './segmented-indicator.js';
import { attachModalA11y } from './modal-a11y.js';

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        window.location.href = 'dashboard.html';
        return;
    }

    let loginWidgetId = null;
    mountTurnstile({
        containerId: 'login-turnstile',
        skeletonId: 'login-turnstile-skel',
        sitekey: '0x4AAAAAADxC9yNLOh3uKLe-',
        onRender: (id) => { loginWidgetId = id; },
    });

    const currentLang = localStorage.getItem('valuon-lang') || 'ru';
    const emailGroup = document.getElementById('login-email-group');
    const phoneGroup = document.getElementById('login-phone-group');
    const emailInput = document.getElementById('email');
    const phoneCountryEl = document.getElementById('login-phone-country');
    const phoneInput = document.getElementById('login-phone');
    const rememberCheckbox = document.getElementById('remember');
    const modeSwitchEl = document.querySelector('.auth-mode-switch');
    const modeIndicatorEl = document.getElementById('auth-mode-indicator');
    const modeButtons = document.querySelectorAll('[data-login-mode]');
    const modeIndicator = createSegmentedIndicator(modeSwitchEl, modeIndicatorEl, {
        itemSelector: '[data-login-mode]',
        activeClass: 'active'
    });

    let loginMode = 'email';
    let phonePair = null;

    if (phoneCountryEl && phoneInput) {
        populateDialCodeSelect(phoneCountryEl, currentLang, getDefaultPhoneCountry(null, currentLang));
        if (typeof CustomSelect !== 'undefined') CustomSelect.init(phoneGroup);
        phonePair = wirePhoneInputPair(phoneCountryEl, phoneInput);
    }

    window.addEventListener('lang-changed', (e) => {
        const nextLang = e.detail?.lang || localStorage.getItem('valuon-lang') || 'ru';
        if (phoneCountryEl) {
            const prevCode = phoneCountryEl.value;
            populateDialCodeSelect(phoneCountryEl, nextLang, prevCode || getDefaultPhoneCountry(null, nextLang));
            if (typeof CustomSelect !== 'undefined') CustomSelect.refreshAll();
        }
        modeIndicator.update(true);
    });

    function setLoginMode(mode, { focus = false, instant = false } = {}) {
        loginMode = mode === 'phone' ? 'phone' : 'email';
        const isPhone = loginMode === 'phone';
        modeButtons.forEach((btn) => {
            const isActive = btn.dataset.loginMode === loginMode;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
        modeIndicator.update(instant);
        if (emailGroup) {
            emailGroup.classList.toggle('is-active', !isPhone);
            emailGroup.setAttribute('aria-hidden', String(isPhone));
            emailGroup.inert = isPhone;
        }
        if (phoneGroup) {
            phoneGroup.classList.toggle('is-active', isPhone);
            phoneGroup.setAttribute('aria-hidden', String(!isPhone));
            phoneGroup.inert = !isPhone;
        }
        if (emailInput) emailInput.required = !isPhone;
        if (phoneInput) phoneInput.required = isPhone;
        if (isPhone) {
            phonePair?.syncTrigger();
            if (focus) phoneInput?.focus();
        } else if (focus) {
            emailInput?.focus();
        }
    }

    modeButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            if (btn.dataset.loginMode === loginMode) return;
            setLoginMode(btn.dataset.loginMode, { focus: true });
        });
    });

    // Restore remembered login (supports both new unified JSON key and legacy email key)
    let restored = false;
    try {
        const rawSaved = localStorage.getItem('valuon-remember-login');
        if (rawSaved) {
            const parsed = JSON.parse(rawSaved);
            if (parsed?.mode === 'phone' && parsed?.value && phonePair) {
                setLoginMode('phone', { focus: false, instant: true });
                phonePair.setFromE164(parsed.value);
                if (rememberCheckbox) rememberCheckbox.checked = true;
                restored = true;
            } else if (parsed?.mode === 'email' && parsed?.value && emailInput) {
                setLoginMode('email', { focus: false, instant: true });
                emailInput.value = parsed.value;
                if (rememberCheckbox) rememberCheckbox.checked = true;
                restored = true;
            }
        }
    } catch (_) { /* ignore malformed storage */ }

    if (!restored) {
        modeIndicator.update(true);
    }

    if (!restored) {
        const savedEmail = localStorage.getItem('valuon-remember-email');
        if (savedEmail && emailInput) {
            emailInput.value = savedEmail;
            if (rememberCheckbox) rememberCheckbox.checked = true;
        }
    }

    const toggleBtn = document.querySelector('.toggle-password');
    const passwordInput = document.getElementById('password');
    if (toggleBtn && passwordInput) {
        toggleBtn.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            const icon = toggleBtn.querySelector('i');
            icon.className = type === 'password' ? 'fa-regular fa-eye' : 'fa-regular fa-eye-slash';
            icon.classList.add('anim-pop');
            setTimeout(() => icon.classList.remove('anim-pop'), 300);
        });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        let lastLoginSubmitAt = 0;
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nowTs = Date.now();
            if (nowTs - lastLoginSubmitAt < 400) return;
            lastLoginSubmitAt = nowTs;
            const btn = loginForm.querySelector('button[type="submit"]');
            const password = document.getElementById('password').value;
            const rememberMe = document.getElementById('remember')?.checked;
            const originalText = btn.innerHTML;
            const lang = localStorage.getItem('valuon-lang') || 'ru';
            const isRu = lang === 'ru';

            let email = '';
            let normalizedPhone = '';
            let rateLimitKey = '';

            if (loginMode === 'phone') {
                const hasPhone = phonePair ? phonePair.hasInput() : Boolean(phoneInput?.value.trim());
                if (!hasPhone && !password) {
                    showToast(isRu ? 'Введите номер телефона и пароль' : 'Enter your phone number and password', 'warning');
                    phoneInput?.focus();
                    return;
                }
                if (!hasPhone) {
                    showToast(isRu ? 'Введите номер телефона' : 'Enter your phone number', 'warning');
                    phoneInput?.focus();
                    return;
                }
                normalizedPhone = phonePair ? phonePair.getNormalized() : null;
                if (!normalizedPhone) {
                    showToast(isRu ? 'Введите корректный номер телефона' : 'Enter a valid phone number', 'warning');
                    phoneInput?.focus();
                    return;
                }
                if (!password) {
                    showToast(isRu ? 'Введите пароль' : 'Enter your password', 'warning');
                    passwordInput?.focus();
                    return;
                }
                rateLimitKey = normalizedPhone;
            } else {
                email = emailInput.value.trim();
                if (!email && !password) {
                    showToast(isRu ? 'Введите email и пароль' : 'Enter your email and password', 'warning');
                    emailInput?.focus();
                    return;
                }
                if (!email) {
                    showToast(isRu ? 'Введите email' : 'Enter your email', 'warning');
                    emailInput?.focus();
                    return;
                }
                if (!isValidEmail(email)) {
                    showToast(isRu ? 'Введите корректный email' : 'Enter a valid email', 'warning');
                    emailInput?.focus();
                    return;
                }
                if (!password) {
                    showToast(isRu ? 'Введите пароль' : 'Enter your password', 'warning');
                    passwordInput?.focus();
                    return;
                }
                rateLimitKey = email;
            }

            const captchaToken = (typeof turnstile !== 'undefined' && loginWidgetId !== null)
                ? turnstile.getResponse(loginWidgetId)
                : null;
            if (!captchaToken) {
                showToast(isRu ? 'Подтвердите, что вы не робот' : 'Please complete the captcha', 'warning');
                return;
            }

            const rateLimitCheck = checkLoginRateLimit(rateLimitKey, lang);
            if (!rateLimitCheck.allowed) {
                showToast(isRu
                    ? `Слишком много попыток входа. Попробуйте через ${rateLimitCheck.resetIn}`
                    : `Too many login attempts. Try again in ${rateLimitCheck.resetIn}`);
                return;
            }

            try {
                setLoadingButton(btn);

                setSessionOnly(!rememberMe);
                const client = supabase;
                let activeSession = null;

                if (loginMode === 'phone') {
                    const { data, error } = await client.functions.invoke('phone-login', {
                        body: {
                            phone: normalizedPhone,
                            password,
                            captchaToken
                        }
                    });

                    if (error || !data?.session?.access_token || !data?.session?.refresh_token) {
                        throw error || new Error('Invalid credentials');
                    }

                    const { data: sessionData, error: sessionErr } = await client.auth.setSession({
                        access_token: data.session.access_token,
                        refresh_token: data.session.refresh_token
                    });
                    if (sessionErr) throw sessionErr;
                    activeSession = sessionData?.session || data.session;
                } else {
                    const { data, error } = await client.auth.signInWithPassword({
                        email,
                        password,
                        options: { captchaToken }
                    });

                    if (error) throw error;
                    activeSession = data.session;
                }

                if (!activeSession) {
                    throw new Error('No active session returned');
                }

                resetLoginRateLimit(rateLimitKey);

                if (loginMode === 'phone') {
                    if (rememberMe) {
                        localStorage.setItem('valuon-remember-login', JSON.stringify({ mode: 'phone', value: normalizedPhone }));
                    } else {
                        localStorage.removeItem('valuon-remember-login');
                        localStorage.removeItem('valuon-remember-email');
                    }
                } else {
                    if (rememberMe) {
                        localStorage.setItem('valuon-remember-email', email);
                        localStorage.setItem('valuon-remember-login', JSON.stringify({ mode: 'email', value: email }));
                    } else {
                        localStorage.removeItem('valuon-remember-email');
                        localStorage.removeItem('valuon-remember-login');
                    }
                }

                const getSafeRedirect = () => {
                    const raw = new URLSearchParams(window.location.search).get('redirect');
                    if (!raw) return 'dashboard.html';
                    if (raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\') && !/^\/(login|register)(\.html)?([?#]|$)/i.test(raw)) {
                        return raw;
                    }
                    return 'dashboard.html';
                };

                const reduced = prefersReducedMotion();
                btn.innerHTML = `<i class="fa-solid fa-circle-check" style="font-size:1.25rem;${reduced ? '' : 'animation:checkPop 0.25s cubic-bezier(0.34,1.56,0.64,1) both;'}color:var(--success);"></i>`;
                if (!reduced) {
                    await new Promise(r => setTimeout(r, 180));
                }
                window.location.href = getSafeRedirect();
            } catch (err) {
                setSessionOnly(false);
                logError('auth:login', err);
                const errMsgLower = String(err?.message || '').toLowerCase();
                const errCode = String(err?.code || '').toLowerCase();
                const errStatus = Number(err?.status || 0);
                const resendBox = document.getElementById('resend-confirm-box');
                if (resendBox) resendBox.classList.add('hidden');

                let msg;
                if (!navigator.onLine || errMsgLower.includes('failed to fetch') || errMsgLower.includes('networkerror') || errMsgLower.includes('load failed')) {
                    msg = isRu
                        ? 'Ошибка сети. Проверьте подключение к интернету и попробуйте снова.'
                        : 'Network error. Check your internet connection and try again.';
                } else if (errStatus === 429 || errCode === 'over_request_rate_limit' || errMsgLower.includes('too many requests') || errMsgLower.includes('rate limit')) {
                    msg = isRu
                        ? 'Слишком много попыток входа. Подождите немного и попробуйте снова.'
                        : 'Too many login attempts. Please wait a moment and try again.';
                } else if (loginMode === 'email' && (errCode === 'email_not_confirmed' || errMsgLower.includes('email not confirmed'))) {
                    msg = isRu
                        ? 'Email не подтверждён. Проверьте почту или отправьте письмо повторно.'
                        : 'Email is not confirmed. Check your inbox or resend the confirmation email.';
                    if (resendBox && email) {
                        const resendText = document.getElementById('resend-confirm-text');
                        const resendBtn = document.getElementById('resend-confirm-btn');
                        if (resendText) {
                            resendText.textContent = isRu
                                ? `Письмо подтверждения для ${email} не пришло?`
                                : `Didn't receive the confirmation email for ${email}?`;
                        }
                        if (resendBtn) {
                            resendBtn.textContent = isRu ? 'Отправить письмо повторно' : 'Resend confirmation email';
                            resendBtn.dataset.email = email;
                            resendBtn.disabled = false;
                        }
                        resendBox.classList.remove('hidden');
                    }
                } else {
                    msg = loginMode === 'phone'
                        ? (isRu ? 'Неверный номер телефона или пароль' : 'Invalid phone number or password')
                        : (isRu ? 'Неверный email или пароль' : 'Invalid email or password');
                }
                showToast(msg);
                resetLoadingButton(btn, originalText);
                if (typeof turnstile !== 'undefined' && loginWidgetId !== null) turnstile.reset(loginWidgetId);
            }
        });

        const resendConfirmBtn = document.getElementById('resend-confirm-btn');
        if (resendConfirmBtn) {
            resendConfirmBtn.addEventListener('click', async () => {
                const targetEmail = resendConfirmBtn.dataset.email || emailInput?.value.trim();
                const isRuNow = (localStorage.getItem('valuon-lang') || 'ru') === 'ru';
                if (!targetEmail) return;
                resendConfirmBtn.disabled = true;
                const prevText = resendConfirmBtn.textContent;
                resendConfirmBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
                try {
                    const { error: resendErr } = await supabase.auth.resend({
                        type: 'signup',
                        email: targetEmail
                    });
                    if (resendErr) throw resendErr;
                    showToast(
                        isRuNow ? 'Письмо подтверждения отправлено повторно!' : 'Confirmation email resent!',
                        'success'
                    );
                    let cooldown = 60;
                    const tick = () => {
                        if (cooldown <= 0) {
                            resendConfirmBtn.disabled = false;
                            resendConfirmBtn.textContent = isRuNow ? 'Отправить письмо повторно' : 'Resend confirmation email';
                            return;
                        }
                        resendConfirmBtn.textContent = isRuNow ? `Повторно через ${cooldown} с` : `Resend in ${cooldown}s`;
                        cooldown--;
                        setTimeout(tick, 1000);
                    };
                    tick();
                } catch (resendErr) {
                    logError('auth:resendConfirm', resendErr);
                    showToast(
                        isRuNow ? 'Не удалось отправить письмо. Попробуйте позже.' : 'Failed to resend email. Try again later.',
                        'error'
                    );
                    resendConfirmBtn.disabled = false;
                    resendConfirmBtn.textContent = prevText;
                }
            });
        }
    }

    const forgotLink = document.querySelector('.forgot-link');
    const forgotModal = document.getElementById('forgot-modal');
    const forgotClose = forgotModal?.querySelector('.forgot-close');
    const forgotForm = document.getElementById('forgot-form');
    const forgotEmailInput = document.getElementById('forgot-email');
    const forgotPhoneHint = document.getElementById('forgot-phone-hint');
    const stepEmail = document.getElementById('forgot-step-email');
    const stepSuccess = document.getElementById('forgot-step-success');
    const backToLoginBtn = forgotModal?.querySelector('.forgot-back-login');

    let forgotWidgetId = null;

    function openForgotModal() {
        if (!forgotModal) return;

        const mainEmail = loginMode === 'email'
            ? (emailInput?.value.trim() || '')
            : (localStorage.getItem('valuon-remember-email') || '');
        if (mainEmail && forgotEmailInput) {
            forgotEmailInput.value = mainEmail;
        }

        if (forgotPhoneHint) {
            forgotPhoneHint.classList.toggle('hidden', loginMode !== 'phone');
        }

        stepEmail?.classList.remove('hidden');
        stepSuccess?.classList.add('hidden');

        forgotModal.classList.add('active');
        document.documentElement.classList.add('modal-open');

        // Рендерим виджет только сейчас, когда контейнер уже видим —
        // Turnstile не умеет авто-рендериться в display:none элементах.
        if (forgotWidgetId === null && !forgotModal.dataset.turnstileMounted) {
            forgotModal.dataset.turnstileMounted = '1';
            mountTurnstile({
                containerId: 'forgot-turnstile',
                skeletonId: 'forgot-turnstile-skel',
                sitekey: '0x4AAAAAADxC9yNLOh3uKLe-',
                shouldRender: () => forgotModal.classList.contains('active'),
                onAbort: () => { delete forgotModal.dataset.turnstileMounted; },
                onRender: (id) => { forgotWidgetId = id; },
            });
        }
    }

    function closeForgotModal() {
        if (forgotModal?.classList.contains('closing')) return;
        forgotModal?.classList.add('closing');
        forgotModal?.classList.remove('active');
        document.documentElement.classList.remove('modal-open');
        const delay = prefersReducedMotion() ? 0 : 350;
        setTimeout(() => {
            forgotModal?.classList.remove('closing');
        }, delay);
    }

    if (forgotLink) {
        forgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            openForgotModal();
        });
    }

    // Автооткрытие модалки восстановления, если пришли сюда с reset-password.html
    // после протухшей ссылки (см. кнопку "Запросить новую ссылку", ?forgot=1).
    if (new URLSearchParams(window.location.search).get('forgot') === '1') {
        openForgotModal();
        // Убираем параметр из адресной строки, чтобы при обновлении страницы
        // модалка не открывалась повторно без причины.
        window.history.replaceState({}, '', window.location.pathname);
    }

    if (forgotClose) {
        forgotClose.addEventListener('click', closeForgotModal);
    }

    if (forgotModal) {
        attachModalA11y(forgotModal, { mode: 'active', onClose: closeForgotModal });
        forgotModal.addEventListener('click', (e) => {
            if (e.target === forgotModal) closeForgotModal();
        });
    }

    if (backToLoginBtn) {
        backToLoginBtn.addEventListener('click', closeForgotModal);
    }

    if (forgotForm) {
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = forgotForm.querySelector('button[type="submit"]');
            const email = forgotEmailInput?.value.trim();
            const originalText = btn.innerHTML;
            const lang = (localStorage.getItem('valuon-lang') || 'ru') === 'ru';


            if (!email) {
                showToast(lang
                    ? 'Введите email адрес'
                    : 'Please enter your email');
                return;
            }


            if (!isValidEmail(email)) {
                showToast(lang
                    ? 'Пожалуйста, введите корректный email адрес'
                    : 'Please enter a valid email address');
                return;
            }

            const captchaToken = (typeof turnstile !== 'undefined' && forgotWidgetId !== null)
                ? turnstile.getResponse(forgotWidgetId)
                : null;
            if (!captchaToken) {
                showToast(lang ? 'Подтвердите, что вы не робот' : 'Please complete the captcha', 'warning');
                return;
            }

            const rlLang = localStorage.getItem('valuon-lang') || 'ru';
            const rateLimitCheck = checkLoginRateLimit(`reset_${email}`, rlLang);
            if (!rateLimitCheck.allowed) {
                showToast(rlLang === 'ru'
                    ? `Слишком много попыток. Попробуйте через ${rateLimitCheck.resetIn}`
                    : `Too many attempts. Try again in ${rateLimitCheck.resetIn}`);
                return;
            }

            try {
                setLoadingButton(btn);
                setSessionOnly(false);

                const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                const resetPath = isLocalHost ? '/reset-password.html' : '/reset-password';
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}${resetPath}`,
                    captchaToken
                });

                if (error) throw error;

                stepEmail?.classList.add('hidden');
                stepSuccess?.classList.remove('hidden');

            } catch (err) {
                logError('auth:forgotPassword', err);
                showToast(lang
                    ? 'Ошибка отправки. Проверьте email и попробуйте снова.'
                    : 'Failed to send. Check email and try again.');
            } finally {
                if (typeof turnstile !== 'undefined' && forgotWidgetId !== null) turnstile.reset(forgotWidgetId);
                resetLoadingButton(btn, originalText);
            }
        });
    }
});