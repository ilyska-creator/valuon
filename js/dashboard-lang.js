const dashboardTranslations = {
    ru: {
        page_title: "Valuon — Личный кабинет",
        nav_items: "Мои вещи",
        nav_receipts: "Чеки и документы",
        nav_notifications: "Уведомления",
        nav_settings: "Настройки",
        btn_logout: "Выйти",
        dashboard_title: "Мои активы",
        btn_add: "+ Добавить вещь",
        stat_total: "Всего вещей",
        stat_active: "Активных гарантий",
        stat_expiring: "Истекают скоро",
        section_recent: "Недавние покупки",
        empty_state: "У вас пока нет добавленных вещей.",
        ui_theme: "Тема",
        ui_logout: "Выйти"
    },
    en: {
        page_title: "Valuon — Dashboard",
        nav_items: "My Items",
        nav_receipts: "Receipts & Docs",
        nav_notifications: "Notifications",
        nav_settings: "Settings",
        btn_logout: "Log Out",
        dashboard_title: "My Assets",
        btn_add: "+ Add Item",
        stat_total: "Total Items",
        stat_active: "Active Warranties",
        stat_expiring: "Expiring Soon",
        section_recent: "Recent Purchases",
        ui_theme: "Theme",
        ui_logout: "Logout",
        empty_state: "You haven't added any items yet."
    }
};

function applyDashboardLang(lang) {
    const t = dashboardTranslations[lang] || dashboardTranslations.ru;

    document.title = t.page_title;

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.innerHTML = t[key];
    });

    const langBtn = document.getElementById('lang-toggle');
    if (langBtn) {
        const span = langBtn.querySelector('span');
        if (span) span.textContent = lang.toUpperCase();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    let currentLang = localStorage.getItem('valuon-lang') || 'ru';
    applyDashboardLang(currentLang);

    const langToggle = document.getElementById('lang-toggle');
    if (langToggle) {
        langToggle.addEventListener('click', (e) => {
            e.preventDefault();
            currentLang = currentLang === 'ru' ? 'en' : 'ru';
            localStorage.setItem('valuon-lang', currentLang);
            applyDashboardLang(currentLang);
        });
    }

    window.addEventListener('storage', (e) => {
        if (e.key === 'valuon-lang') {
            applyDashboardLang(e.newValue || 'ru');
        }
    });
});