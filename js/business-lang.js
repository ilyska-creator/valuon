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


        chart_title: '📊 Динамика выписки чеков',
        chart_week: 'Неделя',
        chart_month: 'Месяц',
        chart_year: 'Год',
        chart_empty: 'Нет данных для графика',
        chart_label_receipts: 'Количество продаж',
        chart_period_week: 'За последние 7 дней',
        chart_period_month: 'За последние 30 дней',
        chart_period_year: 'За последние 12 месяцев',

        loading_shop: 'Проверка данных магазина...',
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


        chart_title: '📊 Receipt Issuance Dynamics',
        chart_week: 'Week',
        chart_month: 'Month',
        chart_year: 'Year',
        chart_empty: 'No data for chart',
        chart_label_receipts: 'Sales count',
        chart_period_week: 'Last 7 days',
        chart_period_month: 'Last 30 days',
        chart_period_year: 'Last 12 months',

        loading_shop: 'Checking store data...',
    }
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


    const backLink = document.querySelector('.back-link span');
    if (backLink) backLink.textContent = t.back_to_dashboard;


    const shopTitle = document.querySelector('#create-shop-view h1');
    if (shopTitle) shopTitle.textContent = t.shop_registration_title;

    const shopDesc = document.querySelector('.setup-subtitle');
    if (shopDesc) shopDesc.textContent = t.shop_registration_desc;


    const labels = {
        'shop_name': t.shop_name_label,
        'tax_id': t.tax_id_label,
        'address': t.address_label,
    };

    for (const [id, label] of Object.entries(labels)) {
        const labelEl = document.querySelector(`label[for="${id}"]`);
        if (labelEl) labelEl.textContent = label;
    }


    const inputs = {
        'shop_name': t.shop_name_placeholder,
        'tax_id': t.tax_id_placeholder,
    };

    for (const [id, placeholder] of Object.entries(inputs)) {
        const input = document.getElementById(id);
        if (input) input.placeholder = placeholder;
    }


    const addressInput = document.getElementById('address');
    if (addressInput) addressInput.placeholder = t.address_placeholder;

    const hints = document.querySelectorAll('.field-hint');
    hints.forEach((hint, idx) => {
        const hintTexts = [t.shop_name_hint, t.tax_id_hint, t.address_hint];
        if (hintTexts[idx]) hint.textContent = hintTexts[idx];
    });

    const registerBtn = document.querySelector('#create-shop-form button[type="submit"]');
    if (registerBtn) registerBtn.innerHTML = `<i class="fa-solid fa-check-circle"></i> ${t.register_shop_btn}`;


    const dashboardH1 = document.querySelector('#shop-dashboard-view .content-header h1');
    if (dashboardH1) dashboardH1.textContent = t.my_shop;

    const createBtn = document.getElementById('open-create-receipt-btn');
    if (createBtn) createBtn.innerHTML = `<i class="fa-solid fa-plus"></i> ${t.create_receipt_btn}`;


    const statLabels = document.querySelectorAll('.stat-label');
    if (statLabels[0]) statLabels[0].textContent = t.total_receipts_label;
    if (statLabels[1]) statLabels[1].textContent = t.pending_receipts_label;


    const receiptsTitle = document.querySelector('.receipts-list-container .section-title');
    if (receiptsTitle) receiptsTitle.textContent = t.issued_receipts_title;


    const noReceiptsTitle = document.querySelector('#no-receipts-msg h3');
    if (noReceiptsTitle) noReceiptsTitle.textContent = t.no_receipts_title;

    const noReceiptsDesc = document.querySelector('#no-receipts-msg p');
    if (noReceiptsDesc) noReceiptsDesc.textContent = t.no_receipts_desc;

    const firstReceiptBtn = document.getElementById('create-first-receipt-btn');
    if (firstReceiptBtn) firstReceiptBtn.innerHTML = `<i class="fa-solid fa-plus"></i> ${t.create_first_receipt_btn}`;


    const modalTitle = document.querySelector('#create-receipt-modal .modal-header h2');
    if (modalTitle) modalTitle.textContent = t.issue_receipt_title;


    const formLabels = {
        'customer_email': t.customer_email_label,
        'purchase_date': t.purchase_date_label,
        'payment_method': t.payment_method_label,
    };

    for (const [name, label] of Object.entries(formLabels)) {
        const input = document.querySelector(`[name="${name}"]`);
        if (input) {
            const labelEl = input.previousElementSibling;
            if (labelEl && labelEl.tagName === 'LABEL') {
                labelEl.textContent = label;
            }
        }
    }


    const customerEmailInput = document.querySelector('[name="customer_email"]');
    if (customerEmailInput) {
        customerEmailInput.placeholder = t.customer_email_placeholder;
        const hint = customerEmailInput.nextElementSibling;
        if (hint && hint.tagName === 'SMALL') hint.textContent = t.customer_email_hint;
    }

    // Позиции чека (товар/кол-во/цена/налог/гарантия) с версии с несколькими
    // товарами живут в <template id="receipt-item-template"> и рендерятся
    // через data-field, а не name="" — переводим их через общий
    // data-i18n/data-i18n-placeholder/data-i18n-title проход ниже, который
    // применяется и к document, и к содержимому самого template (см.
    // applyDataI18n), чтобы новые склонированные строки сразу были на
    // нужном языке.


    const paymentSelect = document.querySelector('[name="payment_method"]');
    if (paymentSelect) {
        const options = paymentSelect.querySelectorAll('option');
        if (options[0]) options[0].textContent = t.payment_card;
        if (options[1]) options[1].textContent = t.payment_cash;
    }


    const cancelBtns = document.querySelectorAll('.modal-actions .btn-outline');
    cancelBtns.forEach(btn => {
        if (btn.textContent.includes('Отмена') || btn.textContent.includes('Cancel')) {
            btn.textContent = t.cancel_btn;
        }
    });

    const submitBtn = document.querySelector('#issue-receipt-form button[type="submit"]');
    if (submitBtn) submitBtn.textContent = t.issue_receipt_submit;


    const deleteTitle = document.querySelector('#delete-confirm-modal h2');
    if (deleteTitle) deleteTitle.textContent = t.delete_receipt_title;

    const deleteDesc = document.querySelector('#delete-confirm-modal p');
    if (deleteDesc) deleteDesc.textContent = t.delete_receipt_desc;

    const deleteBtn = document.getElementById('confirm-delete-btn');
    if (deleteBtn) deleteBtn.innerHTML = `<i class="fa-solid fa-trash"></i> ${t.delete_btn}`;


    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) themeBtn.setAttribute('aria-label', t.theme_toggle_title);


    const chartTitle = document.querySelector('.chart-section .section-title');
    if (chartTitle) chartTitle.textContent = t.chart_title;

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


document.addEventListener('DOMContentLoaded', () => {
    applyBusinessTranslations();
});

window.businessTranslations = businessTranslations;
window.businessCurrentLang = businessCurrentLang;
window.applyBusinessTranslations = applyBusinessTranslations;