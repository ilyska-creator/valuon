import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://qjnzawjivqvgupbgxdao.supabase.co';
const supabaseKey = 'sb_publishable__b1k1cuhxQEBn50III2tkQ_0DOOqe3V';
const supabase = createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', () => {
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

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = registerForm.querySelector('button[type="submit"]');
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const originalText = btn.innerHTML;

            try {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Регистрация...';

                const { data, error } = await supabase.auth.signUp({
                    email: email,
                    password: password
                });

                if (error) throw error;

                if (data.session) {
                    window.location.href = 'dashboard.html';
                } else {
                    alert('Регистрация успешна! Проверьте почту для подтверждения.');
                    window.location.href = 'login.html';
                }
            } catch (err) {
                console.error(err);
                alert(err.message || 'Ошибка регистрации. Попробуйте снова.');
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }
});