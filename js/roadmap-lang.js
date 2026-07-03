document.addEventListener('DOMContentLoaded', () => {
    const roadmapTranslations = {
        ru: {
            roadmap_back: "← На главную",
            roadmap_title: "Дорожная карта развития Valuon",
            roadmap_desc: "План развития платформы от базового учёта гарантий до комплексной системы управления цифровыми активами и B2B-интеграций.",
            phase_1_badge: "Q3–Q4 2026: Текущий этап",
            phase_1_title: "MVP: Базовый учёт и валидация",
            phase_1_item_1: "Ручное добавление активов с точным расчётом гарантийных сроков",
            phase_1_item_2: "Поддержка тёмной темы и локализация (RU/EN)",
            phase_1_item_3: "Загрузка и хранение фото чеков с привязкой к карточке товара",
            phase_1_item_4: "Система уведомлений об истечении гарантийных сроков",
            phase_1_item_5: "Достижение метрики 1 000 MAU (Monthly Active Users)",
            phase_2_badge: "Q1–Q2 2027",
            phase_2_title: "Автоматизация ввода данных и OCR",
            phase_2_item_1: "OCR-сканирование чеков с извлечением даты, суммы, наименования и магазина",
            phase_2_item_2: "Автоматическое определение модели и срока гарантии по штрихкоду или серийному номеру",
            phase_2_item_3: "Настраиваемые уведомления: выбор каналов (Push/Email/Telegram) и порогов оповещения",
            phase_2_item_4: "База знаний гарантийных условий: автоматическая подстановка сроков для 500+ брендов",
            phase_2_item_5: "Экспорт списка покупок в PDF/CSV для личного учёта и планирования бюджета",
            phase_3_badge: "Q3–Q4 2027",
            phase_3_title: "Расширенный функционал для пользователей",
            phase_3_item_1: "Цифровой паспорт товара: верифицированная история покупки, ремонтов и обслуживания для перепродажи",
            phase_3_item_2: "Карта авторизованных сервисных центров с фильтрацией по бренду, модели и рейтингу пользователей",
            phase_3_item_3: "Трекинг стоимости владения: учёт расходов на ремонт, аксессуары и обслуживание по каждому активу",
            phase_3_item_4: "Напоминания о плановом обслуживании: замена фильтров, ТО, чистка по регламенту производителя",
            phase_3_item_5: "Монетизация: Premium-подписка (безлимит, OCR, приоритетная поддержка) и Lifetime Deal для ранних пользователей",
            phase_4_badge: "2028",
            phase_4_title: "B2B-интеграции и экосистема",
            phase_4_item_1: "Retailer API: автоматическая передача данных о покупке в Valuon при оформлении заказа онлайн или на кассе",
            phase_4_item_2: "Система цифровых возвратов: сканирование QR-кода покупателем → мгновенная верификация чека → оформление возврата без участия менеджера",
            phase_4_item_3: "White-label модуль: встроенный трекер гарантий под брендом магазина с кобрендингом и push-уведомлениями от ритейлера",
            phase_4_item_4: "Аналитический дашборд для производителей: частота отказов по моделям, география поломок, среднее время до первого обращения в сервис",
            phase_4_item_5: "Программа лояльности: триггерные рассылки перед окончанием гарантии с персональными предложениями на апгрейд или аксессуары",
            phase_5_badge: "2029+",
            phase_5_title: "Глобальная инфраструктура",
            phase_5_item_1: "Мультиюрисдикционная поддержка: адаптация гарантийных правил под законодательство 50+ стран",
            phase_5_item_2: "IoT-интеграция: подключённые устройства автоматически передают данные о состоянии и ошибках в профиль владельца",
            phase_5_item_3: "Встроенное страхование: оформление расширенной гарантии или страховки от поломок в один клик из карточки товара",
            phase_5_item_4: "Децентрализованная верификация: независимое подтверждение истории владения через открытые реестры (без привязки к конкретному вендору)",
            phase_5_item_5: "Предиктивная аналитика: прогноз остаточной стоимости актива на основе истории обслуживания и рыночных данных",
            footer_copyright: "© 2026 Valuon Inc. Все права защищены."
        },
        en: {
            roadmap_back: "← Back to Home",
            roadmap_title: "Valuon Product Roadmap",
            roadmap_desc: "Development plan from basic warranty tracking to a comprehensive digital asset management platform with B2B integrations.",
            phase_1_badge: "Q3–Q4 2026: Current",
            phase_1_title: "MVP: Core Tracking & Validation",
            phase_1_item_1: "Manual asset entry with precise warranty period calculation",
            phase_1_item_2: "Dark mode support and localization (RU/EN)",
            phase_1_item_3: "Receipt photo upload linked to product cards",
            phase_1_item_4: "Warranty expiry notification system",
            phase_1_item_5: "Reaching 1,000 MAU milestone",
            phase_2_badge: "Q1–Q2 2027",
            phase_2_title: "Data Automation & OCR",
            phase_2_item_1: "OCR receipt scanning with date, amount, item name and store extraction",
            phase_2_item_2: "Auto-detection of model and warranty period via barcode or serial number",
            phase_2_item_3: "Customizable notifications: channel selection (Push/Email/Telegram) and alert thresholds",
            phase_2_item_4: "Warranty knowledge base: auto-fill periods for 500+ brands",
            phase_2_item_5: "Purchase list export to PDF/CSV for personal accounting and budget planning",
            phase_3_badge: "Q3–Q4 2027",
            phase_3_title: "Advanced User Features",
            phase_3_item_1: "Digital product passport: verified purchase, repair and service history for resale",
            phase_3_item_2: "Authorized service center map with brand, model and user rating filters",
            phase_3_item_3: "Total cost of ownership tracking: repair, accessory and maintenance expenses per asset",
            phase_3_item_4: "Scheduled maintenance reminders: filter replacement, servicing, cleaning per manufacturer guidelines",
            phase_3_item_5: "Monetization: Premium subscription (unlimited, OCR, priority support) and Lifetime Deal for early adopters",
            phase_4_badge: "2028",
            phase_4_title: "B2B Integrations & Ecosystem",
            phase_4_item_1: "Retailer API: automatic purchase data transfer to Valuon at online checkout or POS",
            phase_4_item_2: "Digital return system: customer scans QR → instant receipt verification → return processed without staff involvement",
            phase_4_item_3: "White-label module: embedded warranty tracker under retailer branding with co-branded push notifications",
            phase_4_item_4: "Manufacturer analytics dashboard: failure rates by model, breakdown geography, average time to first service request",
            phase_4_item_5: "Loyalty program: trigger campaigns before warranty expiry with personalized upgrade or accessory offers",
            phase_5_badge: "2029+",
            phase_5_title: "Global Infrastructure",
            phase_5_item_1: "Multi-jurisdictional support: warranty rules adapted to legislation of 50+ countries",
            phase_5_item_2: "IoT integration: connected devices automatically report status and errors to owner profile",
            phase_5_item_3: "Embedded insurance: extended warranty or breakdown coverage in one click from product card",
            phase_5_item_4: "Decentralized verification: independent ownership history confirmation via open registries (vendor-agnostic)",
            phase_5_item_5: "Predictive analytics: residual value forecasting based on service history and market data",
            footer_copyright: "© 2026 Valuon Inc. All rights reserved."
        }
    };

    let currentLang = localStorage.getItem('valuon-lang') || 'ru';

    function applyRoadmapTranslations(lang) {
        const t = roadmapTranslations[lang] || roadmapTranslations.ru;
        currentLang = lang;

        document.title = t.roadmap_title;

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (!t[key]) return;

            // Сохраняем иконку внутри бейджей статусов
            if (el.classList.contains('card-status')) {
                const icon = el.querySelector('i');
                const iconHtml = icon ? icon.outerHTML + ' ' : '';
                el.innerHTML = `${iconHtml}${t[key]}`;
            } else {
                el.textContent = t[key];
            }
        });

        // Обновляем текст кнопки языка
        const langBtn = document.getElementById('lang-toggle');
        if (langBtn) {
            const span = langBtn.querySelector('span');
            if (span) span.textContent = lang.toUpperCase();
        }

        localStorage.setItem('valuon-lang', lang);
    }

    // Применяем переводы при загрузке
    applyRoadmapTranslations(currentLang);

    // Обработчик переключения языка
    const langToggle = document.getElementById('lang-toggle');
    if (langToggle) {
        langToggle.addEventListener('click', () => {
            const newLang = currentLang === 'ru' ? 'en' : 'ru';
            applyRoadmapTranslations(newLang);
        });
    }

    // Синхронизация между вкладками
    window.addEventListener('storage', (e) => {
        if (e.key === 'valuon-lang') {
            applyRoadmapTranslations(e.newValue || 'ru');
        }
    });
});

// Тема (отдельный IIFE, работает независимо)
(function () {
    const savedTheme = localStorage.getItem('valuon-theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');

    if (themeToggle) {
        updateThemeIcon();

        themeToggle.addEventListener('click', (e) => {
            e.preventDefault();
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('valuon-theme', newTheme);
            updateThemeIcon(newTheme);
        });
    }

    function updateThemeIcon(themeOverride) {
        const icon = themeToggle?.querySelector('i');
        if (!icon) return;
        const theme = themeOverride || document.documentElement.getAttribute('data-theme') || 'light';
        icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }

    window.addEventListener('storage', (e) => {
        if (e.key === 'valuon-theme') {
            const newTheme = e.newValue || 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            updateThemeIcon(newTheme);
        }
    });
});