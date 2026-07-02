document.addEventListener('DOMContentLoaded', () => {
    const translations = {
        ru: {
            page_title: "Valuon — Roadmap",
            roadmap_back: "← На главную",
            roadmap_title: "Путь к глобальной инфраструктуре доверия",
            roadmap_desc: "Мы строим экосистему, где каждая покупка имеет свой цифровой паспорт. Вот наши ключевые этапы развития.",

            phase_1_badge: "🚀 Q3 2026: Сейчас",
            phase_1_title: "Запуск MVP и Первая База",
            phase_1_item_1: "Ручное добавление товаров и чеков",
            phase_1_item_2: "Базовый трекер сроков гарантии",
            phase_1_item_3: "Библиотека PDF-инструкций",
            phase_1_item_4: "Темная тема и мультиязычность (RU/EN)",
            phase_1_item_5: "Сбор первых 1,000 пользователей",
            phase_1_item_6: "Интеграция с Supabase Auth & Storage",

            phase_2_badge: "🧠 Q4 2026",
            phase_2_title: "AI-Автоматизация и Умный Анализ",
            phase_2_item_1: "OCR-распознавание чеков по фото",
            phase_2_item_2: "Автоопределение серийных номеров и моделей",
            phase_2_item_3: "Карта авторизованных сервисных центров",
            phase_2_item_4: "Push-уведомления об окончании гарантии",
            phase_2_item_5: "Интеграция с email-клиентами для авто-импорта",
            phase_2_item_6: "База знаний стандартных гарантий брендов",

            phase_3_badge: "👥 Q1-Q2 2027",
            phase_3_title: "Сообщество и Семейный доступ",
            phase_3_item_1: "Shared Access: доступ к гарантиям для семьи",
            phase_3_item_2: "Публичные отзывы о сервисах и ремонте",
            phase_3_item_3: "Экспорт цифрового паспорта в PDF",
            phase_3_item_4: "Чат поддержки внутри карточки товара",
            phase_3_item_5: "Геймификация: достижения за порядок в вещах",

            phase_4_badge: "🤝 Q3-Q4 2027",
            phase_4_title: "B2B Партнерства и Экосистема",
            phase_4_item_1: "API для крупных ритейлеров (автодобавление)",
            phase_4_item_2: "Verified Resale Marketplace (продажа б/у с гарантией)",
            phase_4_item_3: "Интеграция со страховыми компаниями",
            phase_4_item_4: "Программа лояльности за активное использование",
            phase_4_item_5: "White-label решение для магазинов электроники",

            phase_5_badge: "🌍 2028+",
            phase_5_title: "Глобальный Стандарт Владельца",
            phase_5_item_1: "Поддержка 50+ стран и локальных законов",
            phase_5_item_2: "Децентрализованная верификация прав собственности",
            phase_5_item_3: "Аналитика качества продукции для производителей",
            phase_5_item_4: "NFT-сертификаты для люксовых товаров",
            phase_5_item_5: "IoT-интеграция: умные вещи сами сообщают о поломке",

            footer_copyright: "© 2026 Valuon Inc. Все права защищены."
        },
        en: {
            page_title: "Valuon — Roadmap",
            roadmap_back: "← Back to Home",
            roadmap_title: "Path to Global Trust Infrastructure",
            roadmap_desc: "We are building an ecosystem where every purchase has its own digital passport. Here are our key development stages.",

            phase_1_badge: "🚀 Q3 2026: Now",
            phase_1_title: "MVP Launch & First Database",
            phase_1_item_1: "Manual addition of items and receipts",
            phase_1_item_2: "Basic warranty deadline tracker",
            phase_1_item_3: "PDF manuals library",
            phase_1_item_4: "Dark theme and multilingual support (RU/EN)",
            phase_1_item_5: "Collecting first 1,000 users",
            phase_1_item_6: "Integration with Supabase Auth & Storage",

            phase_2_badge: "🧠 Q4 2026",
            phase_2_title: "AI Automation & Smart Analysis",
            phase_2_item_1: "OCR receipt recognition from photos",
            phase_2_item_2: "Auto-detection of serial numbers and models",
            phase_2_item_3: "Map of authorized service centers",
            phase_2_item_4: "Push notifications for warranty expiry",
            phase_2_item_5: "Integration with email clients for auto-import",
            phase_2_item_6: "Brand standard warranties knowledge base",

            phase_3_badge: "👥 Q1-Q2 2027",
            phase_3_title: "Community & Family Access",
            phase_3_item_1: "Shared Access: family warranty management",
            phase_3_item_2: "Public reviews on services and repairs",
            phase_3_item_3: "Export digital passport to PDF",
            phase_3_item_4: "In-app support chat per item",
            phase_3_item_5: "Gamification: achievements for organization",

            phase_4_badge: "🤝 Q3-Q4 2027",
            phase_4_title: "B2B Partnerships & Ecosystem",
            phase_4_item_1: "API for major retailers (auto-add purchases)",
            phase_4_item_2: "Verified Resale Marketplace (sell used with warranty)",
            phase_4_item_3: "Integration with insurance companies",
            phase_4_item_4: "Loyalty program for active usage",
            phase_4_item_5: "White-label solution for electronics stores",

            phase_5_badge: "🌍 2028+",
            phase_5_title: "Global Ownership Standard",
            phase_5_item_1: "Support for 50+ countries and local laws",
            phase_5_item_2: "Decentralized ownership verification",
            phase_5_item_3: "Product quality analytics for manufacturers",
            phase_5_item_4: "NFT certificates for luxury goods",
            phase_5_item_5: "IoT integration: smart devices report failures",

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