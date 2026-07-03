document.addEventListener('DOMContentLoaded', () => {
    const roadmapTranslations = {
        ru: {
            roadmap_back: "← На главную",
            roadmap_title: "Путь к цифровой инфраструктуре владения",
            roadmap_desc: "Мы строим экосистему, где каждая покупка имеет свой защищенный цифровой паспорт.",

            phase_1_badge: "Q3-Q4 2026: Сейчас",
            phase_1_title: "MVP и Валидация Ядра",
            phase_1_item_1: "Ручное добавление товаров и базовый трекинг",
            phase_1_item_2: "Точный алгоритм расчета сроков гарантии",
            phase_1_item_3: "Мультиязычность (RU/EN) и Темная тема",
            phase_1_item_4: "Сбор первой 1,000 активных пользователей",
            phase_1_item_5: "Интеграция Supabase Auth & RLS Security",

            phase_2_badge: "Q1-Q2 2027",
            phase_2_title: "AI-Автоматизация и OCR",
            phase_2_item_1: "Распознавание чеков через компьютерное зрение",
            phase_2_item_2: "Автозаполнение полей (дата, сумма, магазин)",
            phase_2_item_3: "Умные Push/Email уведомления об истечении",
            phase_2_item_4: "База знаний стандартных гарантий брендов",
            phase_2_item_5: "Экспорт данных в PDF/CSV",

            phase_3_badge: "Q3-Q4 2027",
            phase_3_title: "Сообщество и Семейный Доступ",
            phase_3_item_1: "Shared Access: управление гарантиями семьи",
            phase_3_item_2: "Публичные отзывы о сервисных центрах",
            phase_3_item_3: "Геймификация и достижения за порядок",
            phase_3_item_4: "Встроенный чат поддержки по товару",
            phase_3_item_5: "Запуск Premium подписки и Lifetime Deal",

            phase_4_badge: "2028",
            phase_4_title: "B2B Интеграции и Цифровые Чеки",
            phase_4_item_1: "API для ритейлеров (автодобавление покупок)",
            phase_4_item_2: "Генерация защищенных QR-кодов для возвратов",
            phase_4_item_3: "Verified Resale Marketplace (б/у с историей)",
            phase_4_item_4: "White-label решение для магазинов",
            phase_4_item_5: "Аналитика поломок для производителей",

            phase_5_badge: "2029+",
            phase_5_title: "Глобальный Стандарт Владения",
            phase_5_item_1: "Поддержка законодательства 50+ стран",
            phase_5_item_2: "Децентрализованная верификация прав",
            phase_5_item_3: "IoT-интеграция: умные вещи сообщают о поломке",
            phase_5_item_4: "NFT-сертификаты для люксовых активов",
            phase_5_item_5: "Страхование прямо в карточке товара",

            footer_copyright: "© 2026 Valuon Inc. Все права защищены."
        },
        en: {
            roadmap_back: "← Back to Home",
            roadmap_title: "Path to Digital Ownership Infrastructure",
            roadmap_desc: "We are building an ecosystem where every purchase has a secure digital passport.",

            phase_1_badge: "Q3-Q4 2026: Current",
            phase_1_title: "MVP & Core Validation",
            phase_1_item_1: "Manual item addition & basic tracking",
            phase_1_item_2: "Precise warranty duration algorithm",
            phase_1_item_3: "Multilingual support (RU/EN) & Dark Mode",
            phase_1_item_4: "First 1,000 active users milestone",
            phase_1_item_5: "Supabase Auth & RLS Security integration",

            phase_2_badge: "Q1-Q2 2027",
            phase_2_title: "AI Automation & OCR",
            phase_2_item_1: "Receipt recognition via Computer Vision",
            phase_2_item_2: "Auto-fill fields (date, amount, store)",
            phase_2_item_3: "Smart Push/Email expiry notifications",
            phase_2_item_4: "Brand standard warranty knowledge base",
            phase_2_item_5: "Data export to PDF/CSV",

            phase_3_badge: "Q3-Q4 2027",
            phase_3_title: "Community & Family Access",
            phase_3_item_1: "Shared Access: family warranty management",
            phase_3_item_2: "Public reviews for service centers",
            phase_3_item_3: "Gamification & achievements for organization",
            phase_3_item_4: "Built-in product support chat",
            phase_3_item_5: "Premium subscription & Lifetime Deal launch",

            phase_4_badge: "2028",
            phase_4_title: "B2B Integrations & Digital Receipts",
            phase_4_item_1: "Retailer API (auto-add purchases)",
            phase_4_item_2: "Secure QR-code generation for returns",
            phase_4_item_3: "Verified Resale Marketplace (used with history)",
            phase_4_item_4: "White-label solution for stores",
            phase_4_item_5: "Breakdown analytics for manufacturers",

            phase_5_badge: "2029+",
            phase_5_title: "Global Ownership Standard",
            phase_5_item_1: "Support for legislation in 50+ countries",
            phase_5_item_2: "Decentralized ownership verification",
            phase_5_item_3: "IoT integration: smart items report breakdowns",
            phase_5_item_4: "NFT certificates for luxury assets",
            phase_5_item_5: "In-app insurance for items",

            footer_copyright: "© 2026 Valuon Inc. All rights reserved."
        }
    };

    let currentLang = localStorage.getItem('valuon-lang') || 'ru';

    function applyTranslations() {
        document.title = translations[currentLang].page_title;

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (!translations[currentLang][key]) return;

            if (el.classList.contains('card-status')) {
                const icon = el.querySelector('i');
                const iconHtml = icon ? icon.outerHTML : '';
                el.innerHTML = `${iconHtml} ${translations[currentLang][key]}`;
            } else {
                el.innerHTML = translations[currentLang][key];
            }
        });
    }

    applyTranslations();

    window.addEventListener('storage', (e) => {
        if (e.key === 'valuon-lang') {
            currentLang = e.newValue || 'ru';
            applyTranslations();
        }
    });
});