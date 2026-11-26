import { supabase, setSessionOnly } from './supabase-client.js';
import { checkSignupRateLimit, isValidEmail, logError, mountTurnstile } from './security.js';
import { initPasswordStrength, checkPasswordStrength, initPasswordMatch } from './password-strength.js';
import { getAuthSession } from './dashboard-auth.js';
import { populateDialCodeSelect, wirePhoneInputPair, getDefaultPhoneCountry } from './phone-utils.js';
import { prefersReducedMotion } from './segmented-indicator.js';

const getLang = () => (window.getValuonLang ? window.getValuonLang() : 'en');

function parseLocalIsoDate(iso) {
    if (typeof iso !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return null;
    }
    return date;
}

function localizedError(message) {
    const err = new Error(message);
    err.isLocalized = true;
    return err;
}

function formatSignupError(err, lang) {
    if (err?.isLocalized && err.message) return err.message;
    const isRu = lang === 'ru';
    const code = String(err?.code || '').toLowerCase();
    const msg = String(err?.message || '').toLowerCase();

    if (code === 'user_already_exists' || msg.includes('user already registered') || msg.includes('already been registered')) {
        return isRu ? 'Этот email уже зарегистрирован' : 'This email is already registered';
    }
    if (code === 'email_address_invalid' || msg.includes('unable to validate email') || msg.includes('invalid format') || msg.includes('is invalid')) {
        return isRu ? 'Введите корректный email' : 'Enter a valid email';
    }
    if (code === 'weak_password' || msg.includes('password should be') || msg.includes('known to be weak')) {
        return isRu ? 'Пароль не соответствует требованиям безопасности' : 'Password does not meet security requirements';
    }
    if (code === 'over_email_send_rate_limit' || err?.status === 429 || msg.includes('rate limit') || msg.includes('only request this after')) {
        return isRu ? 'Слишком много попыток. Попробуйте через минуту' : 'Too many attempts. Please try again in a minute';
    }
    if (msg.includes('captcha')) {
        return isRu ? 'Ошибка проверки капчи. Попробуйте ещё раз' : 'Captcha verification failed. Please try again';
    }
    if (code === 'signup_disabled' || msg.includes('signups not allowed')) {
        return isRu ? 'Регистрация временно недоступна' : 'Signups are temporarily unavailable';
    }
    if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed')) {
        return isRu ? 'Ошибка сети. Проверьте подключение к интернету' : 'Network error. Check your internet connection';
    }
    return isRu ? 'Ошибка регистрации. Попробуйте позже' : 'Registration error. Please try again later';
}

if (typeof window.renderCurrencyOptions === 'function') {
    window.renderCurrencyOptions(document.getElementById('currency'), getLang());
}

const regPhoneCountryEl = document.getElementById('register-phone-country');
if (regPhoneCountryEl) {
    populateDialCodeSelect(regPhoneCountryEl, getLang(), getDefaultPhoneCountry(null, getLang()));
}

window.addEventListener('lang-changed', (e) => {
    const nextLang = e.detail?.lang || getLang();
    const curEl = document.getElementById('currency');
    if (curEl && typeof window.renderCurrencyOptions === 'function') {
        window.renderCurrencyOptions(curEl, nextLang);
    }
    if (regPhoneCountryEl) {
        const prevPhoneCode = regPhoneCountryEl.value;
        populateDialCodeSelect(regPhoneCountryEl, nextLang, prevPhoneCode || getDefaultPhoneCountry(null, nextLang));
    }
    if (typeof CustomSelect !== 'undefined') CustomSelect.refreshAll();
    if (typeof CustomDatePicker !== 'undefined') CustomDatePicker.refreshAll();
});

let registerWidgetId = null;

document.addEventListener('DOMContentLoaded', async () => {
    let { session } = await getAuthSession();
    if (session) {
        window.location.href = 'dashboard.html';
        return;
    }

    mountTurnstile({
        containerId: 'register-turnstile',
        skeletonId: 'register-turnstile-skel',
        sitekey: '0x4AAAAAADxC9yNLOh3uKLe-',
        onRender: (id) => { registerWidgetId = id; },
    });

    initPasswordStrength('password', { getLang });
    initPasswordMatch('password', 'confirm-password', { getLang });

    const regPhoneInput = document.getElementById('register-phone');
    const regPhonePair = (regPhoneCountryEl && regPhoneInput)
        ? wirePhoneInputPair(regPhoneCountryEl, regPhoneInput)
        : null;

    const setupPasswordToggle = (btnClass, inputId) => {
        const toggleBtn = document.querySelector(btnClass);
        const passwordInput = document.getElementById(inputId);
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
    };

    setupPasswordToggle('.toggle-password', 'password');
    setupPasswordToggle('.toggle-password-confirm', 'confirm-password');

    function scrollToField(el) {
        if (!el) return;
        const reduced = prefersReducedMotion();
        const wrap = el.closest('.input-group') || el.closest('.form-options') || el.parentNode;
        const target = wrap || el;
        target.scrollIntoView({
            behavior: reduced ? 'auto' : 'smooth',
            block: 'center',
        });
        if (wrap && !reduced) {
            wrap.classList.remove('shake');
            void wrap.offsetWidth;
            wrap.classList.add('shake');
            setTimeout(function () { wrap.classList.remove('shake'); }, 400);
        }
        const focusTarget = (el._cdpInput instanceof HTMLElement && el._cdpInput)
            || (el.tagName === 'SELECT' && wrap?.querySelector('.custom-select-trigger'))
            || (el.tabIndex === -1 && wrap?.querySelector('.custom-datepicker-input, .custom-select-trigger'))
            || el;
        focusTarget.focus({ preventScroll: true });
    }

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            var lang = getLang();
            var firstErr = null;

            function check(cond, msg, el) {
                if (cond) {
                    if (!firstErr) { firstErr = msg; scrollToField(el); }
                    return true;
                }
                return false;
            }

            var emailEl = document.getElementById('email');
            var phoneEl = document.getElementById('register-phone');
            var passwordEl = document.getElementById('password');
            var confirmEl = document.getElementById('confirm-password');
            var firstNameEl = document.getElementById('first-name');
            var lastNameEl = document.getElementById('last-name');
            var birthdateEl = document.getElementById('birthdate');
            var currencyEl = document.getElementById('currency');
            var termsEl = document.getElementById('terms');

            var email = emailEl.value.trim().toLowerCase();
            var hasPhone = regPhonePair ? regPhonePair.hasInput() : false;
            var normalizedPhone = hasPhone ? regPhonePair.getNormalized() : null;
            var password = passwordEl.value;
            var confirmPassword = confirmEl.value;
            var firstName = firstNameEl.value.trim();
            var lastName = lastNameEl.value.trim();
            var birthdate = birthdateEl?.value || '';
            var currency = currencyEl?.value || '';

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const birthDateObj = birthdate ? parseLocalIsoDate(birthdate) : null;
            let actualAge = null;
            if (birthDateObj) {
                const age = today.getFullYear() - birthDateObj.getFullYear();
                const monthDiff = today.getMonth() - birthDateObj.getMonth();
                const dayDiff = today.getDate() - birthDateObj.getDate();
                actualAge = age - (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? 1 : 0);
            }

            if (check(!email, lang === 'ru' ? 'Введите email' : 'Enter your email', emailEl)) { }
            else if (check(!isValidEmail(email), lang === 'ru' ? 'Введите корректный email' : 'Enter a valid email', emailEl)) { }
            else if (check(hasPhone && !normalizedPhone, lang === 'ru' ? 'Введите корректный номер телефона' : 'Enter a valid phone number', phoneEl)) { }
            else if (check(!firstName, lang === 'ru' ? 'Введите ваше имя' : 'Please enter your first name', firstNameEl)) { }
            else if (check(!lastName, lang === 'ru' ? 'Введите вашу фамилию' : 'Please enter your last name', lastNameEl)) { }
            else if (check(Boolean(birthdate) && !birthDateObj, lang === 'ru' ? 'Проверьте корректность даты рождения' : 'Please check the birth date', birthdateEl)) { }
            else if (check(Boolean(birthdate) && birthDateObj > today, lang === 'ru' ? 'Дата рождения не может быть в будущем' : 'Birth date cannot be in the future', birthdateEl)) { }
            else if (check(Boolean(birthdate) && actualAge < 16, lang === 'ru' ? 'Вам должно быть не менее 16 лет' : 'You must be at least 16 years old', birthdateEl)) { }
            else if (check(Boolean(birthdate) && actualAge > 120, lang === 'ru' ? 'Проверьте корректность даты рождения' : 'Please check the birth date', birthdateEl)) { }
            else if (check(!currency, lang === 'ru' ? 'Выберите валюту' : 'Please select a currency', currencyEl)) { }
            else if (check(!password, lang === 'ru' ? 'Введите пароль' : 'Enter a password', passwordEl)) { }
            else if (check(!confirmPassword, lang === 'ru' ? 'Подтвердите пароль' : 'Confirm your password', confirmEl)) { }
            else if (check(password !== confirmPassword, lang === 'ru' ? 'Пароли не совпадают' : 'Passwords do not match', confirmEl)) { }
            else {
                var strength = checkPasswordStrength(password);
                if (check(!strength.isValid, lang === 'ru' ? 'Пароль слишком слабый. Используйте минимум 8 символов, буквы и цифры.' : 'Password is too weak. Use at least 8 characters, letters and numbers.', passwordEl)) { }
            }

            if (check(!termsEl.checked, lang === 'ru' ? 'Примите условия использования' : 'Accept the terms of use', termsEl)) { }
            if (firstErr) {
                showToast(firstErr, 'warning');
                return;
            }

            var btn = registerForm.querySelector('button[type="submit"]');
            var originalText = btn.innerHTML;

            try {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

                const captchaToken = (typeof turnstile !== 'undefined' && registerWidgetId !== null)
                    ? turnstile.getResponse(registerWidgetId)
                    : null;
                if (!captchaToken) {
                    throw localizedError(lang === 'ru' ? 'Подтвердите, что вы не робот' : 'Please complete the captcha');
                }

                const rateLimitCheck = checkSignupRateLimit(email);
                if (!rateLimitCheck.allowed) {
                    throw localizedError(lang === 'ru'
                        ? 'Слишком много попыток регистрации с этого email. Попробуйте позже.'
                        : 'Too many signup attempts from this email. Try again later.');
                }

                setSessionOnly(false);
                const { data, error } = await supabase.functions.invoke('register-user', {
                    body: {
                        email,
                        password,
                        phone: normalizedPhone || null,
                        firstName,
                        lastName,
                        birthdate: birthdate || null,
                        currency,
                        captchaToken
                    }
                });

                let fnErrorCode = data?.error || null;
                if (error) {
                    try {
                        const errBody = await error.context?.json?.();
                        if (errBody?.error) fnErrorCode = errBody.error;
                    } catch (_) { /* ignore non-JSON error body */ }
                }

                if (fnErrorCode) {
                    const errorMap = {
                        phone_taken: {
                            el: phoneEl,
                            msg: lang === 'ru'
                                ? 'Этот номер телефона уже привязан к другому аккаунту'
                                : 'This phone number is already linked to another account',
                        },
                        email_taken: {
                            el: emailEl,
                            msg: lang === 'ru' ? 'Этот email уже зарегистрирован' : 'This email is already registered',
                        },
                        captcha_failed: {
                            el: null,
                            msg: lang === 'ru' ? 'Проверка капчи не пройдена. Попробуйте снова' : 'Captcha verification failed. Please try again',
                        },
                        rate_limited: {
                            el: null,
                            msg: lang === 'ru' ? 'Слишком много попыток. Подождите немного' : 'Too many attempts. Please wait a moment',
                        },
                        weak_password: {
                            el: passwordEl,
                            msg: lang === 'ru'
                                ? 'Пароль слишком слабый. Используйте минимум 8 символов, буквы и цифры.'
                                : 'Password is too weak. Use at least 8 characters, letters and numbers.',
                        },
                        invalid_phone: {
                            el: phoneEl,
                            msg: lang === 'ru' ? 'Введите корректный номер телефона' : 'Enter a valid phone number',
                        },
                        invalid_email: {
                            el: emailEl,
                            msg: lang === 'ru' ? 'Введите корректный email' : 'Enter a valid email',
                        },
                        invalid_birthdate: {
                            el: birthdateEl,
                            msg: lang === 'ru' ? 'Укажите корректную дату рождения' : 'Enter a valid date of birth',
                        },
                    };
                    const mapped = errorMap[fnErrorCode];
                    if (mapped) {
                        if (mapped.el) scrollToField(mapped.el);
                        throw localizedError(mapped.msg);
                    }
                    throw error || new Error(fnErrorCode);
                }

                if (error) throw error;

                if (data?.session?.access_token && data?.session?.refresh_token) {
                    const { error: sessionErr } = await supabase.auth.setSession({
                        access_token: data.session.access_token,
                        refresh_token: data.session.refresh_token
                    });
                    if (sessionErr) throw sessionErr;

                    const { error: lazyBindError } = await supabase.rpc('bind_pending_receipts');
                    if (lazyBindError) {
                        logError('reg:lazyBind', lazyBindError);
                        showToast(lang === 'ru' ? 'Не удалось привязать старые чеки от партнёров' : 'Failed to link old partner receipts', 'warning');
                    }

                    window.location.href = 'dashboard.html';
                } else {
                    const confirmScreen = document.getElementById('register-confirm-screen');
                    if (confirmScreen) {
                        const titleEl = document.getElementById('register-confirm-title');
                        const descEl = document.getElementById('register-confirm-desc');
                        const resendBtn = document.getElementById('register-resend-btn');
                        const goLoginEl = document.getElementById('register-go-login');
                        const updateConfirmDesc = (curLang) => {
                            if (!descEl) return;
                            descEl.textContent = curLang === 'ru'
                                ? `Мы отправили письмо со ссылкой подтверждения на ${email}. Перейдите по ссылке в письме, чтобы завершить регистрацию.`
                                : `We sent a confirmation link to ${email}. Click the link in the email to finish signing up.`;
                        };
                        if (titleEl) titleEl.textContent = lang === 'ru' ? 'Проверьте почту' : 'Check your email';
                        updateConfirmDesc(lang);
                        window.addEventListener('lang-changed', () => updateConfirmDesc(getLang()));
                        if (resendBtn) {
                            resendBtn.textContent = lang === 'ru' ? 'Отправить письмо повторно' : 'Resend confirmation email';
                            resendBtn.onclick = async () => {
                                const isRuNow = getLang() === 'ru';
                                resendBtn.disabled = true;
                                resendBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
                                try {
                                    const { error: resendErr } = await supabase.auth.resend({ type: 'signup', email });
                                    if (resendErr) throw resendErr;
                                    showToast(isRuNow ? 'Письмо отправлено повторно!' : 'Confirmation email resent!', 'success');
                                    let sec = 60;
                                    const tick = () => {
                                        const ruTick = getLang() === 'ru';
                                        if (sec <= 0) {
                                            resendBtn.disabled = false;
                                            resendBtn.textContent = ruTick ? 'Отправить письмо повторно' : 'Resend confirmation email';
                                            return;
                                        }
                                        resendBtn.textContent = ruTick ? `Повторно через ${sec} с` : `Resend in ${sec}s`;
                                        sec--;
                                        setTimeout(tick, 1000);
                                    };
                                    tick();
                                } catch (resendErr) {
                                    logError('reg:resend', resendErr);
                                    const ruErr = getLang() === 'ru';
                                    showToast(ruErr ? 'Не удалось отправить письмо. Попробуйте позже.' : 'Failed to resend email. Try again later.', 'error');
                                    resendBtn.disabled = false;
                                    resendBtn.textContent = ruErr ? 'Отправить письмо повторно' : 'Resend confirmation email';
                                }
                            };
                        }
                        if (goLoginEl) goLoginEl.textContent = lang === 'ru' ? 'Перейти ко входу' : 'Go to Login';
                        registerForm.classList.add('hidden');
                        const authCard = registerForm.closest('.auth-card');
                        authCard?.querySelector('.auth-logo h1')?.classList.add('hidden');
                        authCard?.querySelector('.auth-subtitle')?.classList.add('hidden');
                        confirmScreen.classList.remove('hidden');
                        confirmScreen.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
                    } else {
                        const msg = lang === 'ru'
                            ? 'Регистрация успешна! Проверьте почту для подтверждения.'
                            : 'Registration successful! Check your email to confirm.';
                        showToast(msg, 'success');
                        setTimeout(() => { window.location.href = 'login.html'; }, 2000);
                    }
                }
            } catch (err) {
                logError('reg:signup', err);
                showToast(formatSignupError(err, lang), 'error');
                btn.innerHTML = originalText;
                btn.disabled = false;
                if (typeof turnstile !== 'undefined' && registerWidgetId !== null) turnstile.reset(registerWidgetId);
            }
        });
    }
});