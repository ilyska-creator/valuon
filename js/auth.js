import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { checkLoginRateLimit, setLoadingButton, resetLoadingButton, isValidEmail } from './security.js';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL)
    || 'https://qjnzawjivqvgupbgxdao.supabase.co';
const supabaseKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY)
    || 'sb_publishable_AwSiUBE-lYKiQAvA_T5ryw_2r_JOOH8';

function getSupabaseClient(rememberMe) {
    return createClient(supabaseUrl, supabaseKey, {
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
    if (await waitForTurnstile()) {
        loginWidgetId = turnstile.render('#login-turnstile', {
            sitekey: '0x4AAAAAADxC9yNLOh3uKLe-',
            theme: 'auto'
        });
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

            const captchaToken = (typeof turnstile !== 'undefined' && loginWidgetId !== null)
                ? turnstile.getResponse(loginWidgetId)
                : null;
            if (!captchaToken) {
                const lang = localStorage.getItem('valuon-lang') === 'ru';
                showToast(lang ? 'Подтвердите, что вы не робот' : 'Please complete the captcha', 'warning');
                return;
            }

            try {
                setLoadingButton(btn);

                const client = getSupabaseClient(rememberMe);

                if (rememberMe) {
                    localStorage.setItem('valuon-remember-email', email);
                } else {
                    localStorage.removeItem('valuon-remember-email');
                }

                const { data, error } = await client.auth.signInWithPassword({
                    email,
                    password,
                    options: { captchaToken }
                });

                if (error) throw error;

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
                if (typeof turnstile !== 'undefined' && loginWidgetId !== null) turnstile.reset(loginWidgetId);
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

    let forgotWidgetId = null;

    function openForgotModal() {
        if (!forgotModal) return;

        const mainEmail = document.getElementById('email')?.value.trim();
        if (mainEmail && forgotEmailInput) {
            forgotEmailInput.value = mainEmail;
        }

        stepEmail?.classList.remove('hidden');
        stepSuccess?.classList.add('hidden');

        forgotModal.classList.add('active');

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
        setTimeout(() => {
            forgotModal?.classList.remove('active', 'closing');
        }, 250);
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

            const captchaToken = (typeof turnstile !== 'undefined' && forgotWidgetId !== null)
                ? turnstile.getResponse(forgotWidgetId)
                : null;
            if (!captchaToken) {
                showToast(lang ? 'Подтвердите, что вы не робот' : 'Please complete the captcha', 'warning');
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
                console.error(err);
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