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
        ui_logout: "Выйти",
        stat_expired: "Истекла гарантия",

        status_active: 'Активна',
        status_expiring: 'Заканчивается',
        status_warning: 'Заканчивается',
        status_expired: 'Истекла',
        days_left: 'Осталось {count} дней',
        warranty_expired_text: 'Гарантия истекла',
        timeline_start: 'Начало',
        timeline_end: 'Конец',
        brand_not_specified: 'Бренд не указан',
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
        empty_state: "You haven't added any items yet.",
        ui_theme: "Theme",
        ui_logout: "Logout",
        stat_expired: "Expired Warranties",

        status_active: 'Active',
        status_expiring: 'Expiring Soon',
        status_warning: 'Expiring Soon',
        status_expired: 'Expired',
        days_left: '{count} days left',
        warranty_expired_text: 'Warranty expired',
        timeline_start: 'Start',
        timeline_end: 'End',
        brand_not_specified: 'Brand not specified'

    }
};

let currentLang = localStorage.getItem('valuon-lang') || 'ru';

function applyDashboardLang(lang) {
    const t = dashboardTranslations[lang] || dashboardTranslations.ru;
    currentLang = lang;

    document.title = t.page_title;

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) {
            let text = t[key];

            if (el.hasAttribute('data-i18n-count')) {
                const count = el.getAttribute('data-i18n-count');
                text = text.replace('{count}', count);
            }

            el.textContent = text;
        }
    });

    const langBtn = document.getElementById('lang-toggle');
    if (langBtn) {
        const span = langBtn.querySelector('span');
        if (span) span.textContent = lang.toUpperCase();
    }

    localStorage.setItem('valuon-lang', lang);
}

window.applyDashboardLang = applyDashboardLang;

document.addEventListener('DOMContentLoaded', () => {
    applyDashboardLang(currentLang);

    const langToggle = document.getElementById('lang-toggle');
    if (langToggle) {
        langToggle.addEventListener('click', (e) => {
            e.preventDefault();
            const newLang = currentLang === 'ru' ? 'en' : 'ru';
            applyDashboardLang(newLang);
        });
    }

    window.addEventListener('storage', (e) => {
        if (e.key === 'valuon-lang') {
            applyDashboardLang(e.newValue || 'ru');
        }
    });
});