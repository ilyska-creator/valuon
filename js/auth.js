import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://qjnzawjivqvgupbgxdao.supabase.co';
const supabaseKey = 'sb_publishable__b1k1cuhxQEBn50III2tkQ_0DOOqe3V';

// Создаем клиент с динамическим хранилищем
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
    // Проверяем, есть ли активная сессия в любом хранилище
    const tempClient = getSupabaseClient(true); // Пробуем найти сессию везде
    const { data: { session } } = await tempClient.auth.getSession();

    if (session) {
        window.location.href = 'dashboard.html';
        return;
    }

    // Автозаполнение email
    const savedEmail = localStorage.getItem('valuon-remember-email');
    const emailInput = document.getElementById('email');
    const rememberCheckbox = document.getElementById('remember');

    if (savedEmail && emailInput) {
        emailInput.value = savedEmail;
        if (rememberCheckbox) rememberCheckbox.checked = true;
    }

    // Логика "глазика"
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

    // Обработка формы
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

                // Используем правильный клиент в зависимости от галочки
                const client = getSupabaseClient(rememberMe);

                const { data, error } = await client.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                if (error) throw error;

                // Сохраняем email для автозаполнения только если стоит галочка
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
});