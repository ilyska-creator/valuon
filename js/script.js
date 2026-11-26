import { getAuthSession } from './dashboard-auth.js';

// Переводы, мобильное меню, плавный скролл и состояние шапки работают
// в js/index-lang.js (не-модульный скрипт, не зависит от Supabase CDN).
// Этот модуль отвечает только за подмену CTA для авторизованных пользователей.

async function checkAuthOnHome() {
    const { session } = await getAuthSession();
    if (typeof window.setHomeAuthUI === 'function') {
        window.setHomeAuthUI(Boolean(session));
    }
}

if (document.querySelector('.hero-actions')) {
    checkAuthOnHome().catch(e => console.warn('checkAuthOnHome failed:', e));
}
