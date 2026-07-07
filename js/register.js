import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { checkSignupRateLimit, setLoadingButton, resetLoadingButton } from './security.js';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL)
    || 'https://qjnzawjivqvgupbgxdao.supabase.co';
const supabaseKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY)
    || 'sb_publishable__b1k1cuhxQEBn50III2tkQ_0DOOqe3V';
const supabase = createClient(supabaseUrl, supabaseKey);

const getLang = () => localStorage.getItem('valuon-lang') || 'ru';

document.addEventListener('DOMContentLoaded', () => {
    const setupPasswordToggle = (btnClass, inputId) => {
        const toggleBtn = document.querySelector(btnClass);
        const passwordInput = document.getElementById(inputId);
        if (toggleBtn && passwordInput) {
            toggleBtn.addEventListener('click', () => {
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);
                const icon = toggleBtn.querySelector('i');
                icon.className = type === 'password' ? 'fa-regular fa-eye' : 'fa-regular fa-eye-slash';
            });
        }
    };

    setupPasswordToggle('.toggle-password', 'password');
    setupPasswordToggle('.toggle-password-confirm', 'confirm-password');

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = registerForm.querySelector('button[type="submit"]');
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            const firstName = document.getElementById('first-name').value.trim();
            const lastName = document.getElementById('last-name').value.trim();
            const birthdate = document.getElementById('birthdate')?.value || '';
            const originalText = btn.innerHTML;
            const lang = getLang();

            if (password !== confirmPassword) {
                showToast(lang === 'ru' ? 'Пароли не совпадают' : 'Passwords do not match', 'error');
                return;
            }

            if (password.length < 6) {
                showToast(lang === 'ru' ? 'Пароль должен быть не менее 6 символов' : 'Password must be at least 6 characters', 'warning');
                return;
            }

            if (!firstName) {
                showToast(lang === 'ru' ? 'Введите ваше имя' : 'Please enter your first name', 'warning');
                return;
            }

            if (!lastName) {
                showToast(lang === 'ru' ? 'Введите вашу фамилию' : 'Please enter your last name', 'warning');
                return;
            }

            if (!birthdate) {
                showToast(lang === 'ru' ? 'Укажите дату рождения' : 'Please enter your date of birth', 'warning');
                return;
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const birthDateObj = new Date(birthdate);

            if (birthDateObj > today) {
                showToast(lang === 'ru' ? 'Дата рождения не может быть в будущем' : 'Birth date cannot be in the future', 'warning');
                return;
            }

            const age = today.getFullYear() - birthDateObj.getFullYear();
            const monthDiff = today.getMonth() - birthDateObj.getMonth();
            const dayDiff = today.getDate() - birthDateObj.getDate();
            const actualAge = age - (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? 1 : 0);

            if (actualAge < 14) {
                showToast(lang === 'ru' ? 'Вам должно быть не менее 14 лет' : 'You must be at least 14 years old', 'warning');
                return;
            }

            if (actualAge > 120) {
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

                const captchaToken = typeof turnstile !== 'undefined' ? turnstile.getResponse() : null;
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
                        showToast('Ошибка сохранения данных профиля', 'error');
                    } else {
                        console.log('✅ Профиль сохранен успешно');

                        const { error: lazyBindError, count } = await supabase
                            .from('business_receipts')
                            .update({ status: 'verified' })
                            .eq('customer_email', email.toLowerCase().trim())
                            .eq('status', 'pending')
                            .select('id', { count: 'exact' });

                        if (lazyBindError) {
                            
                            
                            console.error('❌ Ошибка привязки бизнес-чеков (lazy binding):', lazyBindError);
                        } else {
                            console.log(`✅ Привязано бизнес-чеков: ${count ?? 0}`);
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
                if (typeof turnstile !== 'undefined') turnstile.reset();
            }
        });
    }
});