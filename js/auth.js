import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-client.js';
import { checkLoginRateLimit, setLoadingButton, resetLoadingButton, isValidEmail, logError } from './security.js';
import { populateDialCodeSelect, wirePhoneInputPair, getDefaultPhoneCountry } from './phone-utils.js';
import { createSegmentedIndicator, prefersReducedMotion } from './segmented-indicator.js';
import { attachModalA11y } from './modal-a11y.js';

function getSupabaseClient(rememberMe) {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            storage: rememberMe ? localStorage : sessionStorage,
            autoRefreshToken: true,
            persistSession: true
        }
    });
}

function waitForTurnstile(timeoutMs = 5000) {
    return new Promise((resolve) => {
        if (typeof turnstile !== 'undefined') return resolve(true);
        const start = Date.now();
        const check = setInterval(() => {
            if (typeof turnstile !== 'undefined') {
                clearInterval(check);
                resolve(true);
            } else if (Date.now() - start > timeoutMs) {
                clearInterval(check);
                resolve(false);
            }
        }, 50);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    let { data: { session } } = await getSupabaseClient(true).auth.getSession();
    if (!session) {
        ({ data: { session } } = await getSupabaseClient(false).auth.getSession());
    }

    if (session) {
        window.location.href = 'dashboard.html';
        return;
    }

    let loginWidgetId = null;
    waitForTurnstile().then((ready) => {
        if (!ready) return;
        loginWidgetId = turnstile.render('#login-turnstile', {
            sitekey: '0x4AAAAAADxC9yNLOh3uKLe-',
            theme: 'auto'
        });
        document.getElementById('login-turnstile-skel')?.classList.add('loaded');
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
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
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

                const client = getSupabaseClient(rememberMe);
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

                    if (rememberMe) {
                        localStorage.setItem('valuon-remember-login', JSON.stringify({ mode: 'phone', value: normalizedPhone }));
                    } else {
                        localStorage.removeItem('valuon-remember-login');
                    }
                } else {
                    if (rememberMe) {
                        localStorage.setItem('valuon-remember-email', email);
                        localStorage.setItem('valuon-remember-login', JSON.stringify({ mode: 'email', value: email }));
                    } else {
                        localStorage.removeItem('valuon-remember-email');
                        localStorage.removeItem('valuon-remember-login');
                    }

                    const { data, error } = await client.auth.signInWithPassword({
                        email,
                        password,
                        options: { captchaToken }
                    });

                    if (error) throw error;
                    activeSession = data.session;
                }

                if (activeSession) {
                    const card = loginForm.closest('.auth-card');
                    const reduced = prefersReducedMotion();
                    btn.innerHTML = `<i class="fa-solid fa-circle-check" style="font-size:1.25rem;${reduced ? '' : 'animation:checkPop 0.35s cubic-bezier(0.34,1.56,0.64,1) both;'}color:var(--success);"></i>`;
                    if (!reduced) {
                        await new Promise(r => setTimeout(r, 800));
                        if (card) card.classList.add('auth-card--leaving');
                        await new Promise(r => setTimeout(r, 350));
                    }
                    window.location.href = 'dashboard.html';
                }
            } catch (err) {
                logError('auth:login', err);
                const msg = loginMode === 'phone'
                    ? (isRu ? 'Неверный номер телефона или пароль' : 'Invalid phone number or password')
                    : (isRu ? 'Неверный email или пароль' : 'Invalid email or password');
                showToast(msg);
                resetLoadingButton(btn, originalText);
                if (typeof turnstile !== 'undefined' && loginWidgetId !== null) turnstile.reset(loginWidgetId);
            }
        });
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
        if (forgotWidgetId === null && typeof turnstile !== 'undefined') {
            forgotWidgetId = turnstile.render('#forgot-turnstile', {
                sitekey: '0x4AAAAAADxC9yNLOh3uKLe-',
                theme: 'auto'
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

                const client = getSupabaseClient(false);
                const { error } = await client.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/reset-password.html`,
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
                if (typeof turnstile !== 'undefined' && forgotWidgetId !== null) turnstile.reset(forgotWidgetId);
            } finally {
                resetLoadingButton(btn, originalText);
            }
        });
    }
});