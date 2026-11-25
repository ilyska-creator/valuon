import { getAuthSession } from './dashboard-auth.js';

// Переводы, мобильное меню, плавный скролл и состояние шапки работают
// в js/index-lang.js (не-модульный скрипт, не зависит от Supabase CDN).
// Этот модуль отвечает только за подмену CTA для авторизованных пользователей.

async function checkAuthOnHome() {
    const { session } = await getAuthSession();

    if (session) {
        const lang = localStorage.getItem('valuon-lang') || 'ru';
        const isEn = lang === 'en';

        document.querySelectorAll('.nav-list a[href="login.html"], .nav-list a[href="register.html"]').forEach(link => {
            link.href = 'dashboard.html';
            link.setAttribute('data-i18n', 'nav_dashboard');
            link.textContent = isEn ? 'Dashboard' : 'В кабинет';
        });

        document.querySelectorAll('.hero-actions a[href="register.html"]').forEach(link => {
            link.href = 'dashboard.html';
            const labelEl = link.querySelector('[data-i18n]') || link;
            labelEl.setAttribute('data-i18n', 'hero_btn_dashboard');
            labelEl.textContent = isEn ? 'Go to Dashboard' : 'Перейти в кабинет';
        });

        document.querySelectorAll('.hero-actions a[href="login.html"]').forEach(link => {
            link.hidden = true;
            link.style.display = 'none';
        });

        if (typeof window.applyIndexTranslations === 'function') {
            window.applyIndexTranslations();
        }
    }
}

if (document.querySelector('.hero-actions')) {
    checkAuthOnHome().catch(e => console.warn('checkAuthOnHome failed:', e));
}
