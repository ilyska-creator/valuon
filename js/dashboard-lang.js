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
        modal_title: "Добавить новую вещь",
        label_name: "Название товара",
        label_type: "Тип устройства",
        label_brand: "Бренд",
        label_price: "Цена покупки ($)",
        label_store: "Магазин / Продавец",
        label_serial: "Серийный номер",
        label_date: "Дата покупки",
        label_months: "Срок гарантии (мес.)",
        label_location: "Место хранения",
        btn_cancel: "Отмена",
        btn_save: "Сохранить",
        ph_store: "DNS, Ozon, М.Видео...",
        ph_location: "Дом, Офис, Дача...",

        modal_upload_receipt: "Загрузить чек",
        btn_upload: "Загрузить чек",
        btn_submit_upload: "Загрузить",
        label_receipt_name: "Название чека",
        label_receipt_file: "Файл чека",
        upload_select_hint: "Нажмите для выбора файла (Макс. 10 МБ)",
        label_amount: "Сумма ($)",
        label_purchase_date: "Дата покупки",
        label_store: "Магазин",
        label_linked_item: "Привязать к товару",
        option_no_link: "Не привязывать",
        link_hint_manual: "Ручной ввод данных",
        status_verified: "Проверен",
        status_pending: "Обработка",
        btn_view: "Просмотр",
        btn_download: "Скачать",
        btn_delete: "Удалить",
        delete_receipt_title: "Удалить чек?",
        delete_receipt_desc: "Файл и запись будут удалены безвозвратно.",
        section_documents: "Ваши документы",
        upload_title: "Перетащите фото чека сюда",
        upload_hint: "или нажмите для выбора файла • JPG, PNG, PDF • Макс. 10 МБ",


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
        brand_not_specified: 'Brand not specified',
        modal_title: "Add New Item",
        label_name: "Item Name",
        label_type: "Device Type",
        label_brand: "Brand",
        label_price: "Purchase Price ($)",
        label_store: "Store / Seller",
        label_serial: "Serial Number",
        label_date: "Purchase Date",
        label_months: "Warranty Period (mo.)",
        label_location: "Storage Location",
        btn_cancel: "Cancel",
        btn_save: "Save",
        ph_store: "Apple Store, Amazon, Best Buy...",
        ph_location: "Home, Office, Storage...",


        modal_upload_receipt: "Upload Receipt",
        btn_upload: "Upload Receipt",
        label_receipt_name: "Receipt Name",
        label_receipt_file: "Receipt File",
        upload_select_hint: "Click to select file (Max 10 MB)",
        label_amount: "Amount ($)",
        label_purchase_date: "Purchase Date",
        label_store: "Store",
        label_linked_item: "Link to Item",
        option_no_link: "Don't link",
        link_hint_manual: "Manual data entry",
        status_verified: "Verified",
        status_pending: "Processing",
        btn_view: "View",
        btn_download: "Download",
        btn_delete: "Delete",
        delete_receipt_title: "Delete receipt?",
        delete_receipt_desc: "File and record will be permanently deleted.",
        section_documents: "Your Documents",
        upload_title: "Drag & drop receipt photo here",
        upload_hint: "or click to select file • JPG, PNG, PDF • Max 10 MB",
        btn_submit_upload: "Upload",

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
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (t[key]) el.placeholder = t[key];
    });

    const langBtn = document.getElementById('lang-toggle');
    if (langBtn) {
        const span = langBtn.querySelector('span');
        if (span) span.textContent = lang.toUpperCase();
    }

    localStorage.setItem('valuon-lang', lang);
    const typeLabels = {
        ru: { laptop: '💻 Ноутбук', phone: '📱 Смартфон', tablet: '📟 Планшет', watch: '⌚ Часы', headphones: '🎧 Наушники', camera: '📷 Камера', console: '🎮 Консоль', appliance: '🏠 Бытовая техника', other: '📦 Другое' },
        en: { laptop: '💻 Laptop', phone: '📱 Phone', tablet: '📟 Tablet', watch: '⌚ Watch', headphones: '🎧 Headphones', camera: '📷 Camera', console: '🎮 Console', appliance: '🏠 Appliance', other: '📦 Other' }
    };

    document.querySelectorAll('select[name="type"] option').forEach(opt => {
        const val = opt.value;
        if (typeLabels[lang]?.[val]) opt.textContent = typeLabels[lang][val];


    });

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