import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://qjnzawjivqvgupbgxdao.supabase.co';
const supabaseKey = 'sb_publishable__b1k1cuhxQEBn50III2tkQ_0DOOqe3V';
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
            const originalText = btn.innerHTML;
            const lang = getLang();

            if (password !== confirmPassword) {
                alert(translations[lang].msg_pass_mismatch);
                return;
            }
            if (password.length < 6) {
                alert(translations[lang].msg_weak_pass);
                return;
            }

            try {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

                const { data, error } = await supabase.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: { created_at: new Date().toISOString() }
                    }
                });

                if (error) throw error;

                if (data.session) {
                    window.location.href = 'dashboard.html';
                } else {
                    const msg = lang === 'ru'
                        ? 'Регистрация успешна! Проверьте почту для подтверждения.'
                        : 'Registration successful! Check your email to confirm.';
                    alert(msg);
                    window.location.href = 'login.html';
                }
            } catch (err) {
                console.error(err);
                let errorMsg = err.message;
                if (err.message.includes('User already registered')) {
                    errorMsg = lang === 'ru' ? 'Этот email уже зарегистрирован' : 'This email is already registered';
                }
                alert(errorMsg);
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }
});