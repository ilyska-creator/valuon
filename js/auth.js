import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { checkLoginRateLimit, setLoadingButton, resetLoadingButton, isValidEmail } from './security.js';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL)
    || 'https://qjnzawjivqvgupbgxdao.supabase.co';
const supabaseKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY)
    || 'sb_publishable__b1k1cuhxQEBn50III2tkQ_0DOOqe3V';

function getSupabaseClient(rememberMe) {
    return createClient(supabaseUrl, supabaseKey, {
        auth: {
            storage: rememberMe ? localStorage : sessionStorage,
            autoRefreshToken: true,
            persistSession: true
        }
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

    const savedEmail = localStorage.getItem('valuon-remember-email');
    const emailInput = document.getElementById('email');
    const rememberCheckbox = document.getElementById('remember');

    if (savedEmail && emailInput) {
        emailInput.value = savedEmail;
        if (rememberCheckbox) rememberCheckbox.checked = true;
    }

    const toggleBtn = document.querySelector('.toggle-password');
    const passwordInput = document.getElementById('password');
    if (toggleBtn && passwordInput) {
        toggleBtn.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            const icon = toggleBtn.querySelector('i');
            icon.className = type === 'password' ? 'fa-regular fa-eye' : 'fa-regular fa-eye-slash';
        });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = loginForm.querySelector('button[type="submit"]');
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const rememberMe = document.getElementById('remember')?.checked;
            const originalText = btn.innerHTML;

            const rateLimitCheck = checkLoginRateLimit(email);
            if (!rateLimitCheck.allowed) {
                const lang = localStorage.getItem('valuon-lang') === 'ru';
                showToast(lang
                    ? `Слишком много попыток входа. Попробуйте через ${rateLimitCheck.resetIn}`
                    : `Too many login attempts. Try again in ${rateLimitCheck.resetIn}`);
                return;
            }

            const captchaToken = typeof turnstile !== 'undefined' ? turnstile.getResponse() : null;
            if (!captchaToken) {
                const lang = localStorage.getItem('valuon-lang') === 'ru';
                showToast(lang ? 'Подтвердите, что вы не робот' : 'Please complete the captcha', 'warning');
                return;
            }

            try {
                setLoadingButton(btn);

                const client = getSupabaseClient(rememberMe);
                const { data, error } = await client.auth.signInWithPassword({
                    email,
                    password,
                    options: { captchaToken }
                });

                if (error) throw error;

                if (rememberMe) {
                    localStorage.setItem('valuon-remember-email', email);
                } else {
                    localStorage.removeItem('valuon-remember-email');
                }

                if (data.session) {
                    window.location.href = 'dashboard.html';
                }
            } catch (err) {
                console.error(err);
                const lang = localStorage.getItem('valuon-lang') === 'ru';
                const msg = lang
                    ? 'Неверный email или пароль'
                    : 'Invalid email or password';
                showToast(msg);
                resetLoadingButton(btn, originalText);
                if (typeof turnstile !== 'undefined') turnstile.reset();
            }
        });
    }

    const forgotLink = document.querySelector('.forgot-link');
    const forgotModal = document.getElementById('forgot-modal');
    const forgotClose = forgotModal?.querySelector('.forgot-close');
    const forgotForm = document.getElementById('forgot-form');
    const forgotEmailInput = document.getElementById('forgot-email');
    const stepEmail = document.getElementById('forgot-step-email');
    const stepSuccess = document.getElementById('forgot-step-success');
    const backToLoginBtn = forgotModal?.querySelector('.forgot-back-login');

    function openForgotModal() {
        if (!forgotModal) return;

        const mainEmail = document.getElementById('email')?.value.trim();
        if (mainEmail && forgotEmailInput) {
            forgotEmailInput.value = mainEmail;
        }

        stepEmail?.classList.remove('hidden');
        stepSuccess?.classList.add('hidden');

        forgotModal.classList.add('active');
    }

    function closeForgotModal() {
        forgotModal?.classList.remove('active');
    }

    if (forgotLink) {
        forgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            openForgotModal();
        });
    }

    if (forgotClose) {
        forgotClose.addEventListener('click', closeForgotModal);
    }

    if (forgotModal) {
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
            const lang = localStorage.getItem('valuon-lang') === 'ru';

            
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

            const rateLimitCheck = checkLoginRateLimit(`reset_${email}`);
            if (!rateLimitCheck.allowed) {
                showToast(lang
                    ? `Слишком много попыток. Попробуйте через ${rateLimitCheck.resetIn}`
                    : `Too many attempts. Try again in ${rateLimitCheck.resetIn}`);
                return;
            }

            try {
                setLoadingButton(btn);

                const client = getSupabaseClient(false);
                const { error } = await client.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/reset-password.html`
                });

                if (error) throw error;

                stepEmail?.classList.add('hidden');
                stepSuccess?.classList.remove('hidden');

            } catch (err) {
                console.error(err);
                showToast(lang === 'ru'
                    ? 'Ошибка отправки. Проверьте email и попробуйте снова.'
                    : 'Failed to send. Check email and try again.');
            } finally {
                resetLoadingButton(btn, originalText);
            }
        });
    }
});