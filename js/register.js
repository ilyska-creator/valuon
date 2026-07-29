import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-client.js';
import { checkSignupRateLimit } from './security.js';
import { initPasswordStrength, checkPasswordStrength } from './password-strength.js';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const getLang = () => localStorage.getItem('valuon-lang') || 'ru';

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

let registerWidgetId = null;

document.addEventListener('DOMContentLoaded', async () => {
    let { data: { session } } = await supabase.auth.getSession();
    if (session) {
        window.location.href = 'dashboard.html';
        return;
    }

    if (await waitForTurnstile()) {
        registerWidgetId = turnstile.render('#register-turnstile', {
            sitekey: '0x4AAAAAADxC9yNLOh3uKLe-',
            theme: 'auto'
        });
        document.getElementById('register-turnstile-skel')?.classList.add('loaded');
    }

    initPasswordStrength('password', { getLang });

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
                setTimeout(() => icon.classList.remove('anim-pop'), 350);
            });
        }
    };

    setupPasswordToggle('.toggle-password', 'password');
    setupPasswordToggle('.toggle-password-confirm', 'confirm-password');

    function scrollToField(el) {
        if (!el) return;
        var wrap = el.closest('.input-group') || el.closest('.form-options') || el.parentNode;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (wrap) {
            wrap.classList.remove('shake');
            void wrap.offsetWidth;
            wrap.classList.add('shake');
            setTimeout(function () { wrap.classList.remove('shake'); }, 500);
        }
        // preventScroll stops the browser from immediately jumping to the
        // focused field, which was cancelling the smooth scroll-to-top above.
        el.focus({ preventScroll: true });
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
            var passwordEl = document.getElementById('password');
            var confirmEl = document.getElementById('confirm-password');
            var firstNameEl = document.getElementById('first-name');
            var lastNameEl = document.getElementById('last-name');
            var birthdateEl = document.getElementById('birthdate');
            var termsEl = document.getElementById('terms');

            var email = emailEl.value.trim().toLowerCase();
            var password = passwordEl.value;
            var confirmPassword = confirmEl.value;
            var firstName = firstNameEl.value.trim();
            var lastName = lastNameEl.value.trim();
            var birthdate = birthdateEl?.value || '';

            if (check(!email, lang === 'ru' ? 'Введите email' : 'Enter your email', emailEl)) { }
            else if (check(!firstName, lang === 'ru' ? 'Введите ваше имя' : 'Please enter your first name', firstNameEl)) { }
            else if (check(!lastName, lang === 'ru' ? 'Введите вашу фамилию' : 'Please enter your last name', lastNameEl)) { }
            else if (check(!birthdate, lang === 'ru' ? 'Укажите дату рождения' : 'Please enter your date of birth', birthdateEl)) { }
            else if (check(!password, lang === 'ru' ? 'Введите пароль' : 'Enter a password', passwordEl)) { }
            else if (check(!confirmPassword, lang === 'ru' ? 'Подтвердите пароль' : 'Confirm your password', confirmEl)) { }
            else if (check(password !== confirmPassword, lang === 'ru' ? 'Пароли не совпадают' : 'Passwords do not match', confirmEl)) { }
            else {
                var strength = checkPasswordStrength(password);
                if (check(strength.score < 3, lang === 'ru' ? 'Пароль слишком слабый. Используйте минимум 8 символов, заглавные, строчные буквы, цифры и спецсимволы.' : 'Password is too weak. Use at least 8 characters, uppercase, lowercase, numbers and special characters.', passwordEl)) { }
            }

            if (check(!termsEl.checked, lang === 'ru' ? 'Примите условия использования' : 'Accept the terms of use', termsEl)) { }
            if (firstErr) {
                showToast(firstErr, 'warning');
                return;
            }

            var btn = registerForm.querySelector('button[type="submit"]');
            var originalText = btn.innerHTML;

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const birthDateObj = new Date(birthdate);

            if (birthDateObj > today) {
                scrollToField(birthdateEl);
                showToast(lang === 'ru' ? 'Дата рождения не может быть в будущем' : 'Birth date cannot be in the future', 'warning');
                return;
            }

            const age = today.getFullYear() - birthDateObj.getFullYear();
            const monthDiff = today.getMonth() - birthDateObj.getMonth();
            const dayDiff = today.getDate() - birthDateObj.getDate();
            const actualAge = age - (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? 1 : 0);

            if (actualAge < 16) {
                scrollToField(birthdateEl);
                showToast(lang === 'ru' ? 'Вам должно быть не менее 16 лет' : 'You must be at least 16 years old', 'warning');
                return;
            }

            if (actualAge > 120) {
                scrollToField(birthdateEl);
                showToast(lang === 'ru' ? 'Проверьте корректность даты рождения' : 'Please check the birth date', 'warning');
                return;
            }

            try {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';


                const rateLimitCheck = checkSignupRateLimit(email);
                if (!rateLimitCheck.allowed) {
                    throw new Error(lang === 'ru'
                        ? 'Слишком много попыток регистрации с этого email. Попробуйте позже.'
                        : 'Too many signup attempts from this email. Try again later.');
                }

                const captchaToken = (typeof turnstile !== 'undefined' && registerWidgetId !== null)
                    ? turnstile.getResponse(registerWidgetId)
                    : null;
                if (!captchaToken) {
                    throw new Error(lang === 'ru' ? 'Подтвердите, что вы не робот' : 'Please complete the captcha');
                }

                const displayName = `${firstName} ${lastName}`;


                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        captchaToken,
                        data: {
                            display_name: displayName,
                            first_name: firstName,
                            last_name: lastName,
                            birthdate: birthdate,
                            created_at: new Date().toISOString()
                        }
                    }
                });

                if (error) throw error;

                if (data.user) {

                    const { error: profileError } = await supabase.from('profiles').upsert({
                        id: data.user.id,
                        email: email.toLowerCase().trim(),
                        first_name: firstName,
                        last_name: lastName,
                        birthdate: birthdate
                    }, { onConflict: 'id' });

                    if (profileError) {
                        console.error('❌ Ошибка сохранения профиля:', profileError);
                        showToast(lang === 'ru' ? 'Ошибка сохранения данных профиля' : 'Error saving profile data', 'error');
                    } else {
                        const { error: lazyBindError } = await supabase
                            .from('business_receipts')
                            .update({ status: 'verified' })
                            .eq('customer_email', email.toLowerCase().trim())
                            .eq('status', 'pending')
                            .select('id');

                        if (lazyBindError) {
                            console.error('❌ Ошибка привязки бизнес-чеков (lazy binding):', lazyBindError);
                        }
                    }
                }

                if (data.session) {
                    window.location.href = 'dashboard.html';
                } else {
                    const msg = lang === 'ru'
                        ? 'Регистрация успешна! Проверьте почту для подтверждения.'
                        : 'Registration successful! Check your email to confirm.';
                    showToast(msg, 'success');
                    setTimeout(() => { window.location.href = 'login.html'; }, 2000);
                }
            } catch (err) {
                console.error(err);
                let errorMsg = err.message;
                if (err.message.includes('User already registered')) {
                    errorMsg = lang === 'ru' ? 'Этот email уже зарегистрирован' : 'This email is already registered';
                }
                showToast(errorMsg, 'error');
                btn.innerHTML = originalText;
                btn.disabled = false;
                if (typeof turnstile !== 'undefined' && registerWidgetId !== null) turnstile.reset(registerWidgetId);
            }
        });
    }
});