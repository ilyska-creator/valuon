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

        country_label: 'Страна',
        country_placeholder: 'Выберите страну',
        country_search_placeholder: 'Поиск страны...',
        country_hint: 'Страна регистрации бизнеса — она будет указана в чеке',
        country_search_empty: 'Ничего не найдено',

        currency_label: 'Валюта',
        currency_placeholder: 'Выберите валюту',
        currency_search_placeholder: 'Поиск валюты...',
        currency_hint: 'Валюта, в которой будут выписываться чеки — изменить её позже будет нельзя',
        currency_search_empty: 'Ничего не найдено',

        register_shop_btn: 'Зарегистрировать магазин',
        registering_shop: 'Создание...',


        my_shop: 'Мой магазин',
        create_receipt_btn: 'Создать чек',
        verify_btn: 'Проверить чек',

        total_receipts_label: 'Всего чеков',
        pending_receipts_label: 'Ожидают привязки',
        total_revenue_label: 'Общая выручка',
        avg_receipt_label: 'Средний чек',

        issued_receipts_title: 'Выписанные чеки',
        no_receipts_title: 'У вас пока нет выписанных чеков',
        no_receipts_desc: 'Нажмите кнопку «Создать чек», чтобы выдать первый цифровой документ клиенту.',
        create_first_receipt_btn: 'Создать первый чек',


        issue_receipt_title: 'Выписать новый чек',
        issue_receipt_subtitle: 'Данные клиента и позиции чека',

        section_client: 'Клиент',
        section_items: 'Позиции',
        section_summary: 'Итог',

        customer_mode_email: 'Email',
        customer_mode_phone: 'Телефон',
        customer_email_label: 'Email покупателя',
        customer_phone_label: 'Телефон покупателя',
        phone_country_search: 'Поиск страны или кода...',
        customer_email_placeholder: 'client@example.com',
        customer_email_hint: 'Если клиент зарегистрирован, чек привяжется автоматически',

        error_email_required: 'Введите email покупателя',
        error_email_invalid: 'Некорректный формат email',
        error_phone_required: 'Введите номер телефона покупателя',
        error_phone_invalid: 'Некорректный формат номера телефона',
        field_required: 'Заполните это поле',
        error_item_name: 'Укажите название товара',
        error_item_qty: 'Количество должно быть не меньше 1',

        success_title: 'Чек выписан!',
        success_client_label: 'Клиент',
        success_status_label: 'Статус',
        success_new_btn: 'Выписать ещё',
        success_done_btn: 'Готово',

        item_name_label: 'Товар',
        item_name_placeholder: 'MacBook Air M2',

        items_section_title: 'Позиции товара',
        item_position_label: 'Позиция',

        qty_label: 'Кол-во',
        qty_default: '1',

        price_label: 'Цена за ед.',
        price_placeholder: '0.00',

        vat_rate_label: 'Налог',
        vat_rate_placeholder: '0',
        vat_rate_hint: 'Укажите ставку налога в вашем регионе',

        warranty_months_label: 'Гарантия, мес.',
        warranty_months_placeholder: '12',
        months_suffix: 'мес.',
        warranty_hint: '0 = нет гарантии',
        warranty_suffix: 'мес.',
        discount_label: 'Скидка',
        discount_placeholder: '0',
        category_label: 'Категория',
        category_none: 'Без категории',
        category_search_placeholder: 'Поиск категории...',
        category_search_empty: 'Ничего не найдено',
        discount_word: 'скидка',
        add_item_btn: 'Добавить товар',
        remove_item_title: 'Удалить товар',
        total_label: 'Итого:',

        purchase_date_label: 'Дата покупки',

        payment_method_label: 'Оплата',
        payment_card: 'Карта',
        payment_cash: 'Наличные',

        cancel_btn: 'Отмена',
        issue_receipt_submit: 'Выписать чек',
        issuing_label: 'Выписка...',

        item_subtotal_label: 'Сумма',
        units: { one: 'позиция', few: 'позиции', many: 'позиций' },
        qty_word: 'шт.',
        vat_word: 'НДС:',

        draft_title: 'Черновик не сохранён',
        draft_desc: 'Вы изменили данные чека. Сохранить черновик, чтобы продолжить позже?',
        draft_save: 'Сохранить черновик',
        draft_discard: 'Не сохранять',
        draft_saved: 'Черновик сохранён',


        delete_receipt_title: 'Удалить чек?',
        delete_receipt_desc: 'Это действие необратимо. Чек будет удален из системы безвозвратно.',
        delete_btn: 'Удалить',

        terminals_widget_title: 'Кассовые аппараты',
        terminals_count_zero: 'Кассовые аппараты не добавлены',
        terminals_count_one: '1 кассовый аппарат',
        terminals_count_few: '{n} кассовых аппарата',
        terminals_count_many: '{n} кассовых аппаратов',
        terminals_modal_title: 'Кассовые аппараты',
        terminals_modal_subtitle: 'Устройства, с которых выписываются чеки',
        no_terminals_title: 'Пока нет кассовых аппаратов',
        no_terminals_desc: 'Добавьте первый аппарат, чтобы указывать его в чеках.',
        add_terminal_btn: 'Добавить кассовый аппарат',
        terminal_form_title: 'Новый кассовый аппарат',
        terminal_form_subtitle: 'Серийный номер будет печататься на каждом чеке',
        terminal_name_label: 'Название',
        terminal_name_placeholder: 'Касса №1',
        terminal_serial_label: 'Серийный номер',
        terminal_serial_placeholder: 'CR-2026-001',
        terminal_serial_hint: 'Печатается в каждом чеке (Reg. S/N)',
        terminal_model_label: 'Модель (опционально)',
        terminal_model_placeholder: 'Valuon POS Pro',
        terminal_location_label: 'Расположение (опционально)',
        terminal_location_placeholder: 'Зал, касса №1',
        save_terminal_btn: 'Сохранить',
        terminal_saving: 'Сохранение...',
        terminal_active: 'Активна',
        terminal_inactive: 'Деактивирована',
        terminal_required_name: 'Укажите название аппарата',
        terminal_required_serial: 'Укажите серийный номер',
        terminal_duplicate_serial: 'Аппарат с таким серийным номером уже существует',
        terminal_delete_error: 'Ошибка при удалении аппарата',
        terminal_in_use_deactivated: 'Касса используется в чеках — она деактивирована',
        delete_terminal_title: 'Удалить кассовый аппарат?',
        delete_terminal_desc: 'Чеки, уже выписанные с этого аппарата, сохранятся. Само устройство будет удалено из системы.',
        terminal_saved: 'Кассовый аппарат добавлен',
        terminal_deleted: 'Кассовый аппарат удалён',
        pos_select_label: 'Касса',
        pos_serial_label: 'Касса (КСО)',
        pos_no_terminal: 'Без кассы',
        pos_select_empty: 'Добавьте кассу в разделе «Кассовые аппараты»',

        theme_toggle_title: 'Переключить тему',


        status_verified: 'Привязан к клиенту',
        status_pending: 'Ожидает регистрации',
        download_btn: 'Скачать',
        download_receipt_title: 'Скачать чек',
        delete_btn_tooltip: 'Удалить чек',
        receipt_deleted_success: 'Чек успешно удален',
        receipt_delete_error: 'Ошибка при удалении чека',
        data_load_error: 'Ошибка загрузки данных',


        analytics_title: 'Аналитика',
        chart_sub_receipts: 'Продажи',
        chart_sub_revenue: 'Выручка',
        chart_title: 'Динамика выписки чеков',
        revenue_chart_label: 'Выручка',
        chart_week: 'Неделя',
        chart_month: 'Месяц',
        chart_year: 'Год',
        chart_empty: 'Нет данных для графика',
        chart_empty_week: 'За эту неделю пока нет чеков',
        chart_empty_month: 'В этом месяце пока нет чеков',
        chart_empty_year: 'За этот год пока нет чеков',
        chart_label_receipts: 'Количество продаж',
        chart_period_week: 'За последние 7 дней',
        chart_period_month: 'За последние 30 дней',
        chart_period_year: 'За последние 12 месяцев',

        shop_badge: 'Магазин',
        logo_label: 'Логотип (опционально)',
        logo_drop: 'Нажмите, чтобы выбрать логотип',
        logo_hint: 'PNG или JPG, до 2 МБ',
        logo_remove_title: 'Удалить',
        logo_bad_format: 'Только PNG и JPG.',
        logo_too_large: 'Файл слишком большой. Максимум 2 МБ.',
        loading_shop: 'Загружаем магазин…',
        loading_signatures: 'Проверяем подписи…',
        loading_sync: 'Синхронизируем данные…',

        filter_all: 'Все',
        filter_active: 'Активные',
        filter_closed: 'Возвраты',
        receipt_search_placeholder: 'Поиск по #RCP, email, телефону, товару...',
        receipt_search_clear: 'Очистить поиск',
        no_filtered_receipts_title: 'Нет чеков в этой категории',
        no_filtered_receipts_desc: 'Попробуйте выбрать другой фильтр.',
        no_search_receipts_title: 'Ничего не найдено',
        no_search_receipts_desc: 'Попробуйте изменить поисковый запрос или выбрать другой фильтр.',
        ledger_col_receipt: 'Чек и клиент',
        ledger_col_items: 'Позиции',
        ledger_col_meta: 'Дата и касса',
        ledger_col_status: 'Статус',
        ledger_col_amount: 'Сумма',
        ledger_col_actions: 'Действия',
        status_verified_short: 'Привязан',
        status_pending_short: 'Ожидает',
        lifecycle_partially_refunded_short: 'Част. возврат',
        ledger_details_items: 'Состав чека',
        ledger_details_payment: 'Оплата',
        ledger_details_register: 'Касса',
        ledger_details_binding: 'Привязка',
        ledger_details_date: 'Дата и время',
        ledger_expand_label: 'Показать детали чека',
        ledger_col_item_name: 'Позиция',
        ledger_col_item_qty: 'Кол-во',
        ledger_col_item_warranty: 'Гарантия',
        ledger_col_item_total: 'Сумма',
        ledger_no_warranty: 'Без гарантии',
        ledger_unit_price_each: 'за шт.',
        ledger_summary_net: 'Нетто',
        ledger_summary_vat: 'НДС',
        ledger_summary_refunded: 'Возвращено',
        ledger_summary_total: 'Итого к учёту',
        ledger_action_copy: 'Копировать №',
        ledger_action_copied: 'Скопировано',
        ledger_action_verify: 'Проверить QR',
        ledger_copied_toast: 'Номер чека {num} скопирован',
        search_results_count: 'Найдено: {found} из {total}',
        search_reset_btn: 'Сбросить поиск',
        export_btn: 'Экспорт',
        export_tooltip: 'Экспорт чеков в Excel или CSV',
        export_xlsx_title: 'Excel (.xlsx)',
        export_xlsx_desc: '2 листа: Чеки и Позиции',
        export_csv_title: 'CSV для Excel (;)',
        export_csv_desc: 'Таблица с разделителем ;',
        export_scope_all: 'Все чеки: {n}',
        export_scope_filtered: 'По фильтру: {n} из {total}',
        export_xlsx_done: 'Excel-файл скачан (чеков: {n})',
        export_sheet_receipts: 'Чеки',
        export_sheet_items: 'Позиции',
        export_csv_btn: 'CSV',
        export_csv_tooltip: 'Экспорт реестра в CSV',
        export_csv_empty: 'Нет чеков для экспорта',
        export_csv_done: 'Экспортировано чеков: {n}',
        csv_col_number: 'Номер чека',
        csv_col_date: 'Дата',
        csv_col_email: 'Email клиента',
        csv_col_phone: 'Телефон клиента',
        csv_col_binding: 'Привязка',
        csv_col_lifecycle: 'Статус чека',
        csv_col_payment: 'Оплата',
        csv_col_register: 'Касса',
        csv_col_items: 'Позиции',
        csv_col_items_count: 'Позиций, шт.',
        csv_col_currency: 'Валюта',
        csv_col_net: 'Нетто',
        csv_col_gross: 'Итого брутто',
        csv_col_vat: 'НДС',
        csv_col_refunded: 'Возвращено',
        csv_col_net_revenue: 'К учёту',
        csv_col_reason: 'Причина',
        xlsx_item_col_name: 'Товар',
        xlsx_item_col_qty: 'Кол-во',
        xlsx_item_col_refunded_qty: 'Возвращено, шт.',
        xlsx_item_col_unit_price: 'Цена за ед.',
        xlsx_item_col_vat_rate: 'НДС, %',
        xlsx_item_col_warranty: 'Гарантия, мес.',
        lifecycle_active: 'Активен',

        lifecycle_voided: 'Аннулирован',
        lifecycle_refunded: 'Возврат',
        lifecycle_partially_refunded: 'Частичный возврат',
        lifecycle_manage_btn: 'Возврат',
        lifecycle_manage_tooltip: 'Возврат / Аннулирование',
        lifecycle_modal_title: 'Возврат или аннулирование',
        lifecycle_tab_refund: 'Оформить возврат',
        lifecycle_tab_void: 'Аннулировать чек',
        lifecycle_select_items: 'Позиции для возврата',
        lifecycle_select_all: 'Выбрать все',
        lifecycle_deselect_all: 'Снять выбор',
        lifecycle_refund_amount: 'Сумма возврата',
        lifecycle_kind_full: 'Полный возврат',
        lifecycle_kind_partial: 'Частичный возврат',
        lifecycle_reason_label: 'Причина',
        lifecycle_reason_placeholder: 'Укажите причину (увидит покупатель)',
        lifecycle_irreversible_note: 'Чек останется в реестре и у покупателя с новым статусом. Отменить это действие будет нельзя.',
        lifecycle_confirm_refund: 'Оформить возврат',
        lifecycle_confirm_void: 'Аннулировать чек',
        lifecycle_void_available: 'Аннулирование доступно в течение 24 часов после выписки (осталось ~{hours} ч.). Используйте, если чек выписан по ошибке.',
        lifecycle_void_expired: 'Прошло более 24 часов с момента выписки — аннулирование недоступно. Оформите возврат товара.',
        lifecycle_void_has_refunds: 'По этому чеку уже был частичный возврат — аннулирование недоступно. Вы можете вернуть оставшиеся позиции.',
        lifecycle_item_returned_badge: 'Возвращено',
        lifecycle_item_remaining: 'Доступно: {rem} из {qty}',
        lifecycle_item_returned_short: '−{n} возвр.',
        lifecycle_reason_prefix: 'Причина:',
        lifecycle_refunded_short: 'Возврат:',
        lifecycle_err_reason_required: 'Укажите причину операции',
        lifecycle_err_items_required: 'Выберите хотя бы одну позицию для возврата',
        lifecycle_err_migration: 'Обновите схему базы данных в Supabase (RPC change_receipt_lifecycle не найдена)',
        lifecycle_err_void_window: 'Срок аннулирования (24 часа) истёк. Оформите возврат.',
        lifecycle_err_already_closed: 'Чек уже закрыт (аннулирован или полностью возвращён).',
        lifecycle_err_generic: 'Не удалось обновить статус чека',
        lifecycle_success_void: 'Чек аннулирован',
        lifecycle_success_refund: 'Полный возврат оформлен',
        lifecycle_success_partial: 'Частичный возврат оформлен',
        lifecycle_presets_refund: ['Возврат товара покупателем', 'Товар не подошёл', 'Брак / неисправность', 'Отмена заказа'],
        lifecycle_presets_void: ['Ошибочно выписан чек', 'Опечатка в сумме / товаре', 'Дубликат чека', 'Неверный контакт клиента'],
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

        country_label: 'Country',
        country_placeholder: 'Select a country',
        country_search_placeholder: 'Search country...',
        country_hint: 'Country of business registration — shown on the receipt',
        country_search_empty: 'Nothing found',

        currency_label: 'Currency',
        currency_placeholder: 'Select a currency',
        currency_search_placeholder: 'Search currency...',
        currency_hint: 'Currency used for issuing receipts — cannot be changed later',
        currency_search_empty: 'Nothing found',

        register_shop_btn: 'Register Shop',
        registering_shop: 'Creating...',


        my_shop: 'My Shop',
        create_receipt_btn: 'Create Receipt',
        verify_btn: 'Verify Receipt',

        total_receipts_label: 'Total Receipts',
        pending_receipts_label: 'Pending Binding',
        total_revenue_label: 'Total Revenue',
        avg_receipt_label: 'Avg Receipt',

        issued_receipts_title: 'Issued Receipts',
        no_receipts_title: 'You have no receipts yet',
        no_receipts_desc: 'Click the "Create Receipt" button to issue your first digital document to a customer.',
        create_first_receipt_btn: 'Create First Receipt',

        issue_receipt_title: 'Issue New Receipt',
        issue_receipt_subtitle: 'Customer details and line items',

        section_client: 'Client',
        section_items: 'Line items',
        section_summary: 'Summary',

        customer_mode_email: 'Email',
        customer_mode_phone: 'Phone',
        customer_email_label: 'Customer Email',
        customer_phone_label: 'Customer Phone',
        phone_country_search: 'Search country or code...',
        customer_email_placeholder: 'client@example.com',
        customer_email_hint: 'If customer is registered, receipt will be linked automatically',

        error_email_required: 'Enter customer email',
        error_email_invalid: 'Invalid email format',
        error_phone_required: 'Enter customer phone number',
        error_phone_invalid: 'Invalid phone number format',
        field_required: 'Please fill out this field',
        error_item_name: 'Enter a product name',
        error_item_qty: 'Quantity must be at least 1',

        success_title: 'Receipt issued!',
        success_client_label: 'Client',
        success_status_label: 'Status',
        success_new_btn: 'Issue another',
        success_done_btn: 'Done',

        item_name_label: 'Product',
        item_name_placeholder: 'MacBook Air M2',

        items_section_title: 'Line items',
        item_position_label: 'Item',

        qty_label: 'Quantity',
        qty_default: '1',

        price_label: 'Price per Unit',
        price_placeholder: '0.00',

        vat_rate_label: 'Tax Rate',
        vat_rate_placeholder: '0',
        vat_rate_hint: 'Specify the tax rate in your region',

        warranty_months_label: 'Warranty, months',
        warranty_months_placeholder: '12',
        months_suffix: 'mo.',
        warranty_hint: '0 = no warranty',
        warranty_suffix: 'mo.',
        discount_label: 'Discount',
        discount_placeholder: '0',
        category_label: 'Category',
        category_none: 'No category',
        category_search_placeholder: 'Search category...',
        category_search_empty: 'Nothing found',
        discount_word: 'discount',
        add_item_btn: 'Add item',
        remove_item_title: 'Remove item',
        total_label: 'Total:',

        purchase_date_label: 'Purchase Date',

        payment_method_label: 'Payment Method',
        payment_card: 'Card',
        payment_cash: 'Cash',

        cancel_btn: 'Cancel',
        issue_receipt_submit: 'Issue Receipt',
        issuing_label: 'Issuing...',

        item_subtotal_label: 'Total',
        units: { one: 'item', few: 'items', many: 'items' },
        qty_word: 'pcs',
        vat_word: 'VAT:',

        draft_title: 'Unsaved Draft',
        draft_desc: 'You have made changes to the receipt. Save a draft to continue later?',
        draft_save: 'Save Draft',
        draft_discard: 'Discard',
        draft_saved: 'Draft saved',

        delete_receipt_title: 'Delete Receipt?',
        delete_receipt_desc: 'This action is irreversible. The receipt will be permanently deleted from the system.',
        delete_btn: 'Delete',

        terminals_widget_title: 'Cash Registers',
        terminals_count_zero: 'No cash registers added',
        terminals_count_one: '1 cash register',
        terminals_count_few: '{n} cash registers',
        terminals_count_many: '{n} cash registers',
        terminals_modal_title: 'Cash Registers',
        terminals_modal_subtitle: 'Devices used to issue receipts',
        no_terminals_title: 'No cash registers yet',
        no_terminals_desc: 'Add your first register to reference it on receipts.',
        add_terminal_btn: 'Add Cash Register',
        terminal_form_title: 'New Cash Register',
        terminal_form_subtitle: 'Serial number will be printed on every receipt',
        terminal_name_label: 'Name',
        terminal_name_placeholder: 'Register #1',
        terminal_serial_label: 'Serial Number',
        terminal_serial_placeholder: 'CR-2026-001',
        terminal_serial_hint: 'Printed on every receipt (Reg. S/N)',
        terminal_model_label: 'Model (optional)',
        terminal_model_placeholder: 'Valuon POS Pro',
        terminal_location_label: 'Location (optional)',
        terminal_location_placeholder: 'Floor, register #1',
        save_terminal_btn: 'Save',
        terminal_saving: 'Saving...',
        terminal_active: 'Active',
        terminal_inactive: 'Deactivated',
        terminal_required_name: 'Enter a register name',
        terminal_required_serial: 'Enter a serial number',
        terminal_duplicate_serial: 'A register with this serial number already exists',
        terminal_delete_error: 'Error deleting register',
        terminal_in_use_deactivated: 'Register is used in receipts — it has been deactivated',
        delete_terminal_title: 'Delete Cash Register?',
        delete_terminal_desc: 'Receipts already issued from this register will remain. The device itself will be removed from the system.',
        terminal_saved: 'Cash register added',
        terminal_deleted: 'Cash register deleted',
        pos_select_label: 'Cash Register',
        pos_serial_label: 'Register (КСО)',
        pos_no_terminal: 'No register',
        pos_select_empty: 'Add a register in the "Cash Registers" section',

        theme_toggle_title: 'Toggle Theme',

        status_verified: 'Linked to Customer',
        status_pending: 'Awaiting Registration',
        download_btn: 'Download',
        download_receipt_title: 'Download receipt',
        delete_btn_tooltip: 'Delete receipt',
        receipt_deleted_success: 'Receipt successfully deleted',
        receipt_delete_error: 'Error deleting receipt',
        data_load_error: 'Data loading error',


        analytics_title: 'Analytics',
        chart_sub_receipts: 'Sales',
        chart_sub_revenue: 'Revenue',
        chart_title: 'Receipt Issuance Dynamics',
        revenue_chart_label: 'Revenue',
        chart_week: 'Week',
        chart_month: 'Month',
        chart_year: 'Year',
        chart_empty: 'No data for chart',
        chart_empty_week: 'No receipts this week yet',
        chart_empty_month: 'No receipts this month yet',
        chart_empty_year: 'No receipts this year yet',
        chart_label_receipts: 'Sales count',
        chart_period_week: 'Last 7 days',
        chart_period_month: 'Last 30 days',
        chart_period_year: 'Last 12 months',

        shop_badge: 'Store',
        logo_label: 'Logo (optional)',
        logo_drop: 'Click to select a logo',
        logo_hint: 'PNG or JPG, up to 2 MB',
        logo_remove_title: 'Remove',
        logo_bad_format: 'Only PNG and JPG.',
        logo_too_large: 'File too large. Maximum 2 MB.',
        loading_shop: 'Loading shop…',
        loading_signatures: 'Checking signatures…',
        loading_sync: 'Syncing data…',

        filter_all: 'All',
        filter_active: 'Active',
        filter_closed: 'Refunds & Voids',
        receipt_search_placeholder: 'Search #RCP, email, phone, item...',
        receipt_search_clear: 'Clear search',
        no_filtered_receipts_title: 'No receipts in this category',
        no_filtered_receipts_desc: 'Try selecting another filter.',
        no_search_receipts_title: 'No matching receipts',
        no_search_receipts_desc: 'Try a different search query or filter.',
        ledger_col_receipt: 'Receipt / Customer',
        ledger_col_items: 'Items',
        ledger_col_meta: 'Date & POS',
        ledger_col_status: 'Status',
        ledger_col_amount: 'Amount',
        ledger_col_actions: 'Actions',
        status_verified_short: 'Linked',
        status_pending_short: 'Pending',
        lifecycle_partially_refunded_short: 'Partial refund',
        ledger_details_items: 'Receipt items',
        ledger_details_payment: 'Payment',
        ledger_details_register: 'Register',
        ledger_details_binding: 'Customer',
        ledger_details_date: 'Issued',
        ledger_expand_label: 'Toggle receipt details',
        ledger_col_item_name: 'Item',
        ledger_col_item_qty: 'Qty',
        ledger_col_item_warranty: 'Warranty',
        ledger_col_item_total: 'Total',
        ledger_no_warranty: 'No warranty',
        ledger_unit_price_each: 'each',
        ledger_summary_net: 'Net',
        ledger_summary_vat: 'VAT',
        ledger_summary_refunded: 'Refunded',
        ledger_summary_total: 'Net revenue',
        ledger_action_copy: 'Copy #',
        ledger_action_copied: 'Copied',
        ledger_action_verify: 'Verify QR',
        ledger_copied_toast: 'Receipt {num} copied',
        search_results_count: 'Found: {found} of {total}',
        search_reset_btn: 'Reset search',
        export_btn: 'Export',
        export_tooltip: 'Export receipts to Excel or CSV',
        export_xlsx_title: 'Excel (.xlsx)',
        export_xlsx_desc: '2 sheets: Receipts & Line Items',
        export_csv_title: 'CSV for Excel (;)',
        export_csv_desc: 'Semicolon-delimited table',
        export_scope_all: 'All receipts: {n}',
        export_scope_filtered: 'Filtered: {n} of {total}',
        export_xlsx_done: 'Excel downloaded ({n} receipts)',
        export_sheet_receipts: 'Receipts',
        export_sheet_items: 'Line Items',
        export_csv_btn: 'CSV',
        export_csv_tooltip: 'Export ledger to CSV',
        export_csv_empty: 'No receipts to export',
        export_csv_done: 'Exported {n} receipts',
        csv_col_number: 'Receipt #',
        csv_col_date: 'Date',
        csv_col_email: 'Customer Email',
        csv_col_phone: 'Customer Phone',
        csv_col_binding: 'Binding',
        csv_col_lifecycle: 'Receipt Status',
        csv_col_payment: 'Payment',
        csv_col_register: 'Register',
        csv_col_items: 'Items',
        csv_col_items_count: 'Items Qty',
        csv_col_currency: 'Currency',
        csv_col_net: 'Net',
        csv_col_gross: 'Gross Total',
        csv_col_vat: 'VAT',
        csv_col_refunded: 'Refunded',
        csv_col_net_revenue: 'Net Revenue',
        csv_col_reason: 'Reason',
        xlsx_item_col_name: 'Product',
        xlsx_item_col_qty: 'Qty',
        xlsx_item_col_refunded_qty: 'Refunded Qty',
        xlsx_item_col_unit_price: 'Unit Price',
        xlsx_item_col_vat_rate: 'VAT %',
        xlsx_item_col_warranty: 'Warranty (mo.)',
        lifecycle_active: 'Active',

        lifecycle_voided: 'Voided',
        lifecycle_refunded: 'Refunded',
        lifecycle_partially_refunded: 'Partial Refund',
        lifecycle_manage_btn: 'Refund',
        lifecycle_manage_tooltip: 'Refund / Void receipt',
        lifecycle_modal_title: 'Refund or Void Receipt',
        lifecycle_tab_refund: 'Issue Refund',
        lifecycle_tab_void: 'Void Receipt',
        lifecycle_select_items: 'Items to refund',
        lifecycle_select_all: 'Select all',
        lifecycle_deselect_all: 'Clear selection',
        lifecycle_refund_amount: 'Refund amount',
        lifecycle_kind_full: 'Full refund',
        lifecycle_kind_partial: 'Partial refund',
        lifecycle_reason_label: 'Reason',
        lifecycle_reason_placeholder: 'Specify a reason (visible to the customer)',
        lifecycle_irreversible_note: 'The receipt stays in the registry and the customer’s account with its updated status. This action cannot be undone.',
        lifecycle_confirm_refund: 'Confirm Refund',
        lifecycle_confirm_void: 'Void Receipt',
        lifecycle_void_available: 'Voiding is available within 24 hours of issuance (~{hours}h left). Use this if the receipt was issued by mistake.',
        lifecycle_void_expired: 'More than 24 hours have passed since issuance — voiding is unavailable. Issue a refund instead.',
        lifecycle_void_has_refunds: 'This receipt already has a partial refund — voiding is unavailable. You can refund the remaining items.',
        lifecycle_item_returned_badge: 'Refunded',
        lifecycle_item_remaining: 'Available: {rem} of {qty}',
        lifecycle_item_returned_short: '−{n} ref.',
        lifecycle_reason_prefix: 'Reason:',
        lifecycle_refunded_short: 'Refunded:',
        lifecycle_err_reason_required: 'Please provide a reason',
        lifecycle_err_items_required: 'Select at least one item to refund',
        lifecycle_err_migration: 'Please apply the Supabase SQL migration (RPC change_receipt_lifecycle not found)',
        lifecycle_err_void_window: 'The 24-hour void window has expired. Please issue a refund instead.',
        lifecycle_err_already_closed: 'This receipt is already closed (voided or fully refunded).',
        lifecycle_err_generic: 'Could not update receipt status',
        lifecycle_success_void: 'Receipt voided',
        lifecycle_success_refund: 'Full refund issued',
        lifecycle_success_partial: 'Partial refund issued',
        lifecycle_presets_refund: ['Customer return', 'Item did not fit', 'Defective item', 'Order cancelled'],
        lifecycle_presets_void: ['Issued by mistake', 'Wrong amount or item', 'Duplicate receipt', 'Wrong customer contact'],
    }
};

window.animateCount = function (el, target, duration) {
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

function formatMoney(value, currencyCode) {
    if (!Number.isFinite(value)) value = 0;
    const lang = localStorage.getItem('valuon-lang') || 'ru';
    if (typeof window.formatCurrency === 'function') {
        return window.formatCurrency(value, currencyCode || 'EUR', lang);
    }
    const sign = value < 0 ? '-' : '';
    const rounded = Math.round(Math.abs(value) * 100) / 100;
    const intPart = Math.floor(rounded);
    const decPart = Math.round((rounded - intPart) * 100);
    const formattedInt = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return sign + '€' + formattedInt + '.' + String(decPart).padStart(2, '0');
}

window.animateAmount = function (el, target, duration, currencyCode) {
    if (!el) return;
    const raw = el.textContent.replace(/[^0-9.\-]/g, '');
    const start = raw ? parseFloat(raw) : 0;
    if (start === target) { el.textContent = formatMoney(target, currencyCode); return; }

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
        el.textContent = formatMoney(current, currencyCode);

        if (progress < 1) {
            el._countRaf = requestAnimationFrame(step);
        } else {
            el.textContent = formatMoney(target, currencyCode);
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
    if (typeof CustomSelect !== 'undefined') CustomSelect.refreshAll();
    if (typeof CustomDatePicker !== 'undefined') CustomDatePicker.refreshAll();

    // Даёт business-panel.js шанс пересчитать динамические подписи
    // (например сумму на кнопке «Выписать чек»), которые applyDataI18n
    // выше только что сбросил на статичный текст перевода.
    document.dispatchEvent(new CustomEvent('valuon:lang-applied'));
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
        const card = el.closest('.receipt-ledger-item, .item-card');
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
    document.documentElement.lang = businessCurrentLang === 'en' ? 'en' : 'ru';
    window.businessCurrentLang = businessCurrentLang;
    applyBusinessTranslations();
    window.dispatchEvent(new CustomEvent('business-lang-changed'));
}


applyBusinessTranslations();

window.businessTranslations = businessTranslations;
window.businessCurrentLang = businessCurrentLang;
window.applyBusinessTranslations = applyBusinessTranslations;