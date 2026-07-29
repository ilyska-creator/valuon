const businessTranslations = {
    ru: {

        nav_items: 'Мои вещи',
        nav_receipts: 'Чеки',
        nav_business: 'Бизнес',
        nav_verify: 'QR',
        nav_notifications: 'Уведомления',
        nav_settings: 'Настройки',

        back_to_dashboard: 'Вернуться в личный кабинет',


        shop_registration_title: 'Регистрация магазина',
        shop_registration_desc: 'Создайте цифровой профиль вашего бизнеса для автоматической выдачи чеков клиентам.',

        shop_name_label: 'Название бизнеса',
        shop_name_placeholder: 'My Awesome Store',
        shop_name_hint: 'Как вас знают клиенты',

        tax_id_label: 'Налоговый номер (Tax ID / INN)',
        tax_id_placeholder: '1234567890',
        tax_id_hint: 'Основной идентификатор для налоговой отчетности',

        address_label: 'Юридический адрес',
        address_placeholder: 'ул. Примерная, д. 1, офис 101',
        address_hint: 'Адрес регистрации компании',

        register_shop_btn: 'Зарегистрировать магазин',


        my_shop: 'Мой магазин',
        create_receipt_btn: 'Создать чек',
        verify_btn: 'Проверить чек',

        total_receipts_label: 'Всего чеков',
        pending_receipts_label: 'Ожидают привязки',
        total_revenue_label: 'Общая выручка',
        avg_receipt_label: 'Средний чек',

        issued_receipts_title: '🧾 Выписанные чеки',
        no_receipts_title: 'У вас пока нет выписанных чеков',
        no_receipts_desc: 'Нажмите кнопку «Создать чек», чтобы выдать первый цифровой документ клиенту.',
        create_first_receipt_btn: 'Создать первый чек',


        issue_receipt_title: 'Выписать новый чек',

        customer_email_label: 'Email покупателя',
        customer_email_placeholder: 'client@example.com',
        customer_email_hint: 'Если клиент зарегистрирован, чек привяжется автоматически',

        item_name_label: 'Товар',
        item_name_placeholder: 'MacBook Air M2',

        qty_label: 'Кол-во',
        qty_default: '1',

        price_label: 'Цена за ед.',
        price_placeholder: '0.00',

        vat_rate_label: 'Налог (%)',
        vat_rate_placeholder: '0',
        vat_rate_hint: 'Укажите ставку налога в вашем регионе',

        warranty_months_label: 'Гарантия, мес.',
        warranty_months_placeholder: '12',
        warranty_hint: '0 = нет гарантии',
        warranty_suffix: 'мес.',
        add_item_btn: 'Добавить товар',
        remove_item_title: 'Удалить товар',
        total_label: 'Итого:',

        purchase_date_label: 'Дата покупки',

        payment_method_label: 'Оплата',
        payment_card: 'Карта',
        payment_cash: 'Наличные',

        cancel_btn: 'Отмена',
        issue_receipt_submit: 'Выписать чек',


        delete_receipt_title: 'Удалить чек?',
        delete_receipt_desc: 'Это действие необратимо. Чек будет удален из системы безвозвратно.',
        delete_btn: 'Удалить',

        theme_toggle_title: 'Переключить тему',


        status_verified: 'Привязан к клиенту',
        status_pending: 'Ожидает регистрации',
        download_btn: 'Скачать',
        download_receipt_title: 'Скачать чек',
        delete_btn_tooltip: 'Удалить чек',
        receipt_deleted_success: 'Чек успешно удален',
        receipt_delete_error: 'Ошибка при удалении чека',
        data_load_error: 'Ошибка загрузки данных',


        analytics_title: '📊 Аналитика',
        chart_sub_receipts: 'Продажи',
        chart_sub_revenue: 'Выручка',
        chart_title: '📊 Динамика выписки чеков',
        revenue_chart_label: 'Выручка',
        chart_week: 'Неделя',
        chart_month: 'Месяц',
        chart_year: 'Год',
        chart_empty: 'Нет данных для графика',
        chart_label_receipts: 'Количество продаж',
        chart_period_week: 'За последние 7 дней',
        chart_period_month: 'За последние 30 дней',
        chart_period_year: 'За последние 12 месяцев',

        shop_badge: 'Магазин',
        logo_label: 'Логотип (опционально)',
        logo_drop: 'Нажмите, чтобы выбрать логотип',
        logo_hint: 'PNG или JPG, до 2 МБ',
        logo_bad_format: 'Только PNG и JPG.',
        logo_too_large: 'Файл слишком большой. Максимум 2 МБ.',
        loading_shop: 'Загружаем магазин…',
        loading_signatures: 'Проверяем подписи…',
        loading_sync: 'Синхронизируем данные…',
    },
    en: {

        nav_items: 'My Items',
        nav_receipts: 'Receipts',
        nav_business: 'Business',
        nav_verify: 'QR',
        nav_notifications: 'Notifications',
        nav_settings: 'Settings',

        back_to_dashboard: 'Back to Dashboard',


        shop_registration_title: 'Shop Registration',
        shop_registration_desc: 'Create a digital profile for your business to automatically issue receipts to customers.',

        shop_name_label: 'Business Name',
        shop_name_placeholder: 'My Awesome Store',
        shop_name_hint: 'How your customers know you',

        tax_id_label: 'Tax ID / INN',
        tax_id_placeholder: '1234567890',
        tax_id_hint: 'Primary identifier for tax reporting',

        address_label: 'Legal Address',
        address_placeholder: 'Example Street, Building 1, Suite 101',
        address_hint: 'Company registration address',

        register_shop_btn: 'Register Shop',


        my_shop: 'My Shop',
        create_receipt_btn: 'Create Receipt',
        verify_btn: 'Verify Receipt',

        total_receipts_label: 'Total Receipts',
        pending_receipts_label: 'Pending Binding',
        total_revenue_label: 'Total Revenue',
        avg_receipt_label: 'Avg Receipt',

        issued_receipts_title: '🧾 Issued Receipts',
        no_receipts_title: 'You have no receipts yet',
        no_receipts_desc: 'Click the "Create Receipt" button to issue your first digital document to a customer.',
        create_first_receipt_btn: 'Create First Receipt',

        issue_receipt_title: 'Issue New Receipt',

        customer_email_label: 'Customer Email',
        customer_email_placeholder: 'client@example.com',
        customer_email_hint: 'If customer is registered, receipt will be linked automatically',

        item_name_label: 'Product',
        item_name_placeholder: 'MacBook Air M2',

        qty_label: 'Quantity',
        qty_default: '1',

        price_label: 'Price per Unit',
        price_placeholder: '0.00',

        vat_rate_label: 'Tax Rate (%)',
        vat_rate_placeholder: '0',
        vat_rate_hint: 'Specify the tax rate in your region',

        warranty_months_label: 'Warranty, months',
        warranty_months_placeholder: '12',
        warranty_hint: '0 = no warranty',
        warranty_suffix: 'mo.',
        add_item_btn: 'Add item',
        remove_item_title: 'Remove item',
        total_label: 'Total:',

        purchase_date_label: 'Purchase Date',

        payment_method_label: 'Payment Method',
        payment_card: 'Card',
        payment_cash: 'Cash',

        cancel_btn: 'Cancel',
        issue_receipt_submit: 'Issue Receipt',

        delete_receipt_title: 'Delete Receipt?',
        delete_receipt_desc: 'This action is irreversible. The receipt will be permanently deleted from the system.',
        delete_btn: 'Delete',

        theme_toggle_title: 'Toggle Theme',

        status_verified: 'Linked to Customer',
        status_pending: 'Awaiting Registration',
        download_btn: 'Download',
        download_receipt_title: 'Download receipt',
        delete_btn_tooltip: 'Delete receipt',
        receipt_deleted_success: 'Receipt successfully deleted',
        receipt_delete_error: 'Error deleting receipt',
        data_load_error: 'Data loading error',


        analytics_title: '📊 Analytics',
        chart_sub_receipts: 'Sales',
        chart_sub_revenue: 'Revenue',
        chart_title: '📊 Receipt Issuance Dynamics',
        revenue_chart_label: 'Revenue',
        chart_week: 'Week',
        chart_month: 'Month',
        chart_year: 'Year',
        chart_empty: 'No data for chart',
        chart_label_receipts: 'Sales count',
        chart_period_week: 'Last 7 days',
        chart_period_month: 'Last 30 days',
        chart_period_year: 'Last 12 months',

        shop_badge: 'Store',
        logo_label: 'Logo (optional)',
        logo_drop: 'Click to select a logo',
        logo_hint: 'PNG or JPG, up to 2 MB',
        logo_bad_format: 'Only PNG and JPG.',
        logo_too_large: 'File too large. Maximum 2 MB.',
        loading_shop: 'Loading shop…',
        loading_signatures: 'Checking signatures…',
        loading_sync: 'Syncing data…',
    }
};

window.animateCount = function(el, target, duration) {
    if (!el) return;
    const start = parseInt(el.textContent) || 0;
    if (start === target) { el.textContent = String(target); return; }

    if (duration == null) {
        const diff = Math.abs(target - start);
        if (diff <= 5) duration = 300;
        else if (diff <= 15) duration = 400;
        else if (diff <= 30) duration = 500;
        else if (diff <= 100) duration = 650;
        else duration = Math.min(1000, 450 + Math.floor(diff / 50) * 40);
    }

    if (el._countRaf) cancelAnimationFrame(el._countRaf);

    const startTime = performance.now();

    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(start + (target - start) * eased);
        el.textContent = String(current);

        if (progress < 1) {
            el._countRaf = requestAnimationFrame(step);
        } else {
            el.textContent = String(target);
            el._countRaf = null;
        }
    }

    el._countRaf = requestAnimationFrame(step);
};

function formatMoney(value) {
    if (!Number.isFinite(value)) return '$0.00';
    const sign = value < 0 ? '-' : '';
    const rounded = Math.round(Math.abs(value) * 100) / 100;
    const intPart = Math.floor(rounded);
    const decPart = Math.round((rounded - intPart) * 100);
    const formattedInt = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return sign + '$' + formattedInt + '.' + String(decPart).padStart(2, '0');
}

window.animateAmount = function(el, target, duration) {
    if (!el) return;
    const raw = el.textContent.replace(/[^0-9.\-]/g, '');
    const start = raw ? parseFloat(raw) : 0;
    if (start === target) { el.textContent = formatMoney(target); return; }

    if (duration == null) {
        const diff = Math.abs(target - start);
        if (diff <= 100) duration = 400;
        else if (diff <= 1000) duration = 600;
        else if (diff <= 10000) duration = 800;
        else duration = Math.min(1200, 600 + Math.floor(diff / 10000) * 40);
    }

    if (el._countRaf) cancelAnimationFrame(el._countRaf);

    const startTime = performance.now();

    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = start + (target - start) * eased;
        el.textContent = formatMoney(current);

        if (progress < 1) {
            el._countRaf = requestAnimationFrame(step);
        } else {
            el.textContent = formatMoney(target);
            el._countRaf = null;
        }
    }

    el._countRaf = requestAnimationFrame(step);
};

let businessCurrentLang = localStorage.getItem('valuon-lang') || 'ru';

// Применяет data-i18n / data-i18n-placeholder / data-i18n-title к любому
// корню — document.body, но и к DocumentFragment внутри <template>, куда
// document.querySelectorAll не заглядывает. Нужно, чтобы и уже открытая
// форма с позициями чека, и будущие склонированные через addItemRow()
// строки сразу были на актуальном языке.
function applyDataI18n(root, t) {
    if (!root) return;
    root.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.textContent = t[key];
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (t[key]) el.placeholder = t[key];
    });
    root.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (t[key]) el.setAttribute('title', t[key]);
    });
}

function applyBusinessTranslations() {
    const t = businessTranslations[businessCurrentLang] || businessTranslations.ru;

    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) themeBtn.setAttribute('aria-label', t.theme_toggle_title);

    const periodKeys = ['chart_week', 'chart_month', 'chart_year'];
    document.querySelectorAll('.chart-period-btn').forEach((btn, i) => {
        if (periodKeys[i] && t[periodKeys[i]]) btn.textContent = t[periodKeys[i]];
    });


    translateReceiptCards(t);


    applyDataI18n(document, t);
    const itemTemplate = document.getElementById('receipt-item-template');
    if (itemTemplate) applyDataI18n(itemTemplate.content, t);
}


function translateReceiptCards(t) {

    document.querySelectorAll('.item-status-badge[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.textContent = t[key];
    });


    document.querySelectorAll('.btn-download-receipt span[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.textContent = t[key];
    });


    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (t[key]) el.setAttribute('title', t[key]);
    });


    document.querySelectorAll('.receipt-date').forEach(el => {
        const card = el.closest('.item-card');
        if (card) {
            const dateStr = card.getAttribute('data-receipt-date');
            if (dateStr) {
                const locale = businessCurrentLang === 'en' ? 'en-US' : 'ru-RU';
                el.textContent = new Date(dateStr).toLocaleDateString(locale);
            }
        }
    });
}

function toggleBusinessLanguage() {
    businessCurrentLang = businessCurrentLang === 'ru' ? 'en' : 'ru';
    localStorage.setItem('valuon-lang', businessCurrentLang);
    window.businessCurrentLang = businessCurrentLang;
    applyBusinessTranslations();
    window.dispatchEvent(new CustomEvent('business-lang-changed'));
}


applyBusinessTranslations();

window.businessTranslations = businessTranslations;
window.businessCurrentLang = businessCurrentLang;
window.applyBusinessTranslations = applyBusinessTranslations;