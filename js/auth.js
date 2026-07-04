import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://qjnzawjivqvgupbgxdao.supabase.co';
const supabaseKey = 'sb_publishable__b1k1cuhxQEBn50III2tkQ_0DOOqe3V';

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
    // Проверка сессии
    const tempClient = getSupabaseClient(true);
    const { data: { session } } = await tempClient.auth.getSession();

    if (session) {
        window.location.href = 'dashboard.html';
        return;
    }

    // Запомненный email
    const savedEmail = localStorage.getItem('valuon-remember-email');
    const emailInput = document.getElementById('email');
    const rememberCheckbox = document.getElementById('remember');

    if (savedEmail && emailInput) {
        emailInput.value = savedEmail;
        if (rememberCheckbox) rememberCheckbox.checked = true;
    }

    // Переключение видимости пароля
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

    // Вход
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = loginForm.querySelector('button[type="submit"]');
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const rememberMe = document.getElementById('remember')?.checked;
            const originalText = btn.innerHTML;

            try {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

                const client = getSupabaseClient(rememberMe);
                const { data, error } = await client.auth.signInWithPassword({ email, password });

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
                let msg = err.message;
                if (msg.includes('Invalid login credentials')) {
                    msg = localStorage.getItem('valuon-lang') === 'ru'
                        ? 'Неверный email или пароль'
                        : 'Invalid email or password';
                }
                alert(msg);
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    // --- ВОССТАНОВЛЕНИЕ ПАРОЛЯ ---
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

            if (!email) return;

            try {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

                const client = getSupabaseClient(false);
                const { error } = await client.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/reset-password.html`
                });

                if (error) throw error;

                // Показываем экран успеха
                stepEmail?.classList.add('hidden');
                stepSuccess?.classList.remove('hidden');

            } catch (err) {
                console.error(err);
                const lang = localStorage.getItem('valuon-lang') || 'ru';
                alert(lang === 'ru'
                    ? 'Ошибка отправки. Проверьте email и попробуйте снова.'
                    : 'Failed to send. Check email and try again.');
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }
});

resetForm.classList.add('hidden');
document.getElementById('reset-header')?.classList.add('hidden');
successBlock?.classList.remove('hidden');