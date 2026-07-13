document.addEventListener('DOMContentLoaded', () => {
    const roadmapTranslations = {
        ru: {
            roadmap_back: "← На главную",
            roadmap_title: "Дорожная карта Valuon: единая платформа официальных чеков",
            roadmap_desc: "План развития от рабочего MVP до единой платформы доступа к официальным чекам в разных странах.",

            roles_section_title: "Две роли Valuon, а не одна универсальная",
            role_a_tag: "Роль А",
            role_a_title: "Первичный эмитент",
            role_a_desc: "Эстония, Ирландия, Мальта, Финляндия, Лихтенштейн, США — там, где нет обязательной фискализации, чек Valuon может быть настоящим официальным цифровым чеком, а не имитацией.",
            role_b_tag: "Роль Б",
            role_b_title: "Реестр поверх официального",
            role_b_desc: "Германия, Франция, Италия, Испания и другие — чек уже подписан государственно сертифицированной кассой. Valuon подключается к этим данным и даёт чеку вторую жизнь у покупателя.",
            role_c_tag: "Роль В — отложено",
            role_c_title: "Собственная сертификация",
            role_c_desc: "Стать сертифицированным фискальным провайдером самим (как fiskaly/efsta) — дорогой многолетний путь. Решение принимается не раньше 2028 года, под подтверждённый масштаб.",
            roles_note: "Гарантии, история владения и перепродажа техники работают поверх обеих ролей как надстройка — они делают возврат в приложение осмысленным, но не являются целью сами по себе.",

            step0_badge: "Уже готово",
            step0_role_tag: "Роль А + Роль Б — основа",
            step0_context: "Рабочий продукт, который можно открыть, зарегистрироваться и начать использовать. Дальнейшие этапы строятся поверх этой базы.",
            step0_title: "MVP: текущий этап — что уже сделано",
            step0_item_1: "Регистрация с email/паролем, подтверждение email, восстановление пароля",
            step0_item_2: "Проверка от ботов при входе и регистрации",
            step0_item_3: "Смена email, редактирование имени/фамилии в настройках",
            step0_item_4: "Добавление вещи вручную: название, тип, бренд, цена, серийный номер, дата покупки, срок гарантии",
            step0_item_5: "Автоматический расчёт даты окончания гарантии",
            step0_item_6: "Календарь гарантий с переключением месяцев",
            step0_item_7: "Раздел уведомлений: гарантия ≤30 дней или истекла",
            step0_item_8: "Загрузка фото/PDF чека, drag&drop, привязка к вещи",
            step0_item_9: "Бизнес: создание магазина, генерация Ed25519 ключей",
            step0_item_10: "Бизнес: выписка чека с несколькими позициями и цифровой подписью",
            step0_item_11: "Бизнес: PDF с QR-кодом, график продаж",
            step0_item_12: "Верификация: сканирование QR камерой, загрузка PDF, проверка Ed25519",
            step0_item_13: "Тёмная/светлая тема, мультиязычность RU/EN",

            step1_badge: "Текущая работа",
            step1_role_tag: "Инфраструктура",
            step1_title: "Этап 1: доработка технической базы",
            step1_context: "Прежде чем звать больше магазинов и пользователей — нужно укрепить то, что уже построено.",
            step1_item_3: "Выгрузить и закоммитить RLS-политики в SQL-миграции",
            step1_item_4: "Подключить проверку сложности пароля на регистрации и сбросе",
            step1_item_5: "Добавить CSP-заголовки (vercel.json)",
            step1_item_7: "Настроить проверку MIME-типа файлов в Storage bucket",
            step1_item_8: "Добавить версию формата в подписываемые данные чека",
            step1_item_9: "«Заморозить» данные магазина на чеке при проверке подписи",
            step1_item_10: "Починить округление сумм в PDF",
            step1_item_11: "Ограничения CHECK на значения позиций чека в БД",
            step1_gate: "Без этого этапа масштабировать нельзя — рост числа магазинов и чеков увеличит ущерб от уже найденных проблем.",

            step2_badge: "Месяцы 1–3",
            step2_role_tag: "Роль А + активация",
            step2_context: "Ручной ввод чека — главный барьер возврата. OCR, импорт из почты и push-уведомления должны сделать приложение привычкой, а не одноразовым экспериментом.",
            step2_title: "Этап 2: активация покупателя — retention D30",
            step2_item_1: "Автозаполнение полей вещи по фото чека (OCR)",
            step2_item_2: "Импорт чеков из почты (Amazon, Ozon, AliExpress и др.)",
            step2_item_3: "Push-уведомления об истечении гарантии",
            step2_item_4: "Фактическая отправка еженедельной рассылки (cron / Edge Function)",
            step2_item_5: "Добавление даты окончания гарантии в Google/Apple Calendar",
            step2_item_6: "Журнал сервисного обслуживания вещи (ремонты, даты, стоимость)",
            step2_item_7: "Мастер гарантийного обращения: письмо продавцу со ссылкой на чек",
            step2_item_9: "Передача вещи новому владельцу при перепродаже (QR с историей)",
            step2_item_10: "PWA-версия с камерой в один тап",

            step3_badge: "Месяцы 3–6",
            step3_role_tag: "Роль Б + бизнес-инструменты",
            step3_context: "Магазины не будут выписывать чеки вручную. Нужны интеграции с кассами, API и бесшовный онбординг — только тогда выписка чека станет естественной частью продажи.",
            step3_title: "Этап 3: инструменты для бизнеса",
            step3_item_1: "Плагины к кассам и e-commerce (Shopify, WooCommerce, Lightspeed)",
            step3_item_2: "Публичный REST API для программной выписки чеков",
            step3_item_3: "Вебхуки на события (чек выписан, чек верифицирован)",
            step3_item_4: "Мультипользовательские аккаунты магазина (роли сотрудников)",
            step3_item_5: "Кастомный брендинг чека и страницы верификации",
            step3_item_6: "Массовый импорт исторических чеков через CSV",
            step3_item_7: "Workflow возврата/обмена/аннулирования чека",
            step3_item_8: "Ротация и отзыв криптоключей магазина",
            step3_item_9: "Экспорт чеков для бухгалтерии (CSV/XML под 1С, DATEV)",
            step3_item_10: "Расширенная аналитика: LTV, средний чек, доля гарантийных обращений",

            step4_badge: "Месяцы 6–12",
            step4_role_tag: "B2B2C-инфраструктура",
            step4_context: "Сейчас в продукте нет платёжного функционала вообще. Первые тарифы — только после того, как пилотные магазины подтвердят готовность платить.",
            step4_title: "Этап 4: монетизация и сетевой эффект",
            step4_item_1: "Тарифные планы и биллинг (сейчас платёжного функционала нет)",
            step4_item_2: "Публичный виджет «Verified by Valuon» для сайта магазина",
            step4_item_3: "Платный API верификации для страховых и площадок перепродажи",
            step4_item_4: "Продажа расширенной гарантии в момент выписки чека (комиссия)",
            step4_item_5: "Онбординг-чеклист для нового магазина в дашборде",
            step4_gate: "Платный тариф запускается только после письменного подтверждения магазинов, а не одновременно с пилотом.",

            step5_badge: "Год 2",
            step5_role_tag: "А + Б → решение по В",
            step5_context: "Из одной страны и одной роли — в несколько юрисдикций. Каждый новый рынок запускается только после измеримого успеха на предыдущем.",
            step5_title: "Этап 5: географическое и юридическое расширение",
            step5_item_1: "Пилот Роли А в Эстонии (5–10 продавцов) — Valuon как их единственная система чеков",
            step5_item_2: "Параллельный точечный пилот Роли А в США",
            step5_item_3: "Первая интеграция Роли Б: коннектор к TSE/кассовому API (Германия)",
            step5_item_4: "Юридическая консультация: можно ли называть импортированный чек «официальным»",
            step5_item_5: "Расширение Роли А на Ирландию/Финляндию при успехе Эстонии",
            step5_item_6: "Расширение Роли Б на Францию (сертификация касс с сентября 2026)",
            step5_item_7: "Выбор основной юрисдикции для юрлица (Эстония)",
            step5_item_8: "Решение по Роли В — только под подтверждённый спрос, не раньше 2028",
            step5_gate: "Ключевая метрика: Retention D30 ≥ 25%. Если retention низкий — рассмотреть встраиваемый виджет вместо отдельного приложения.",


            footer_copyright: "© 2026 Valuon. Все права защищены."
        },
        en: {
            roadmap_back: "← Back to Home",
            roadmap_title: "Valuon Roadmap: a unified platform for official digital receipts",
            roadmap_desc: "Development plan from a working MVP to a unified access platform for official receipts across countries.",

            roles_section_title: "Two roles for Valuon, not one universal one",
            role_a_tag: "Role A",
            role_a_title: "Primary issuer",
            role_a_desc: "Estonia, Ireland, Malta, Finland, Liechtenstein, the US — where receipt fiscalization isn't mandatory, a Valuon receipt can be a genuine official digital receipt, not an imitation of one.",
            role_b_tag: "Role B",
            role_b_title: "Registry on top of the official one",
            role_b_desc: "Germany, France, Italy, Spain and others — the receipt is already signed by a certified fiscal cash register. Valuon connects to that data and gives the receipt a second life for the buyer.",
            role_c_tag: "Role C — deferred",
            role_c_title: "Becoming a certified provider",
            role_c_desc: "Becoming a certified fiscal middleware provider ourselves (like fiskaly/efsta) is an expensive, multi-year path. Decided no earlier than 2028, once scale is proven.",
            roles_note: "Warranty tracking, ownership history and resale work on top of both roles as an add-on layer — they make returning to the app meaningful, but they aren't the goal on their own.",

            step0_badge: "Already shipped",
            step0_role_tag: "Role A + Role B — foundation",
            step0_context: "A working product you can open, sign up for, and start using today. All further stages build on this foundation.",
            step0_title: "MVP: current stage — what's already built",
            step0_item_1: "Email/password registration, email confirmation, password recovery",
            step0_item_2: "Bot protection on login and registration",
            step0_item_3: "Email change, name editing in settings",
            step0_item_4: "Manual item entry: name, type, brand, price, serial number, purchase date, warranty term",
            step0_item_5: "Automatic warranty end date calculation",
            step0_item_6: "Warranty calendar with month switching",
            step0_item_7: "Notifications section: warranty ≤30 days or expired",
            step0_item_8: "Receipt photo/PDF upload, drag&drop, attachment to item",
            step0_item_9: "Business: store creation, Ed25519 key generation",
            step0_item_10: "Business: multi-item receipt issuance with digital signature",
            step0_item_11: "Business: PDF with QR code, sales chart",
            step0_item_12: "Verification: QR camera scan, PDF upload, Ed25519 check",
            step0_item_13: "Dark/light theme, RU/EN multilingual support",

            step1_badge: "Current work",
            step1_role_tag: "Infrastructure",
            step1_title: "Stage 1: strengthen the technical foundation",
            step1_context: "Before inviting more stores and users — strengthen what's already built.",
            step1_item_3: "Export and commit RLS policies as SQL migrations",
            step1_item_4: "Enable password strength check on registration and reset",
            step1_item_5: "Add CSP headers (vercel.json)",
            step1_item_7: "Configure MIME type verification on Storage bucket",
            step1_item_8: "Add format version to signed receipt data",
            step1_item_9: "Freeze store data on receipt at signature verification time",
            step1_item_10: "Fix rounding discrepancies in PDF totals",
            step1_item_11: "Add CHECK constraints on receipt line items in DB",
            step1_gate: "Cannot scale without this stage — more stores and receipts will amplify damage from already-known issues.",

            step2_badge: "Months 1–3",
            step2_role_tag: "Role A + activation",
            step2_context: "Manual receipt entry is the #1 barrier to return. OCR, email import, and push notifications should turn the app into a habit, not a one-time experiment.",
            step2_title: "Stage 2: customer activation — D30 retention",
            step2_item_1: "Auto-fill item fields from receipt photo (OCR)",
            step2_item_2: "Import receipts from email (Amazon, Ozon, AliExpress, etc.)",
            step2_item_3: "Push notifications for warranty expiry",
            step2_item_4: "Actual weekly newsletter delivery (cron / Edge Function)",
            step2_item_5: "One-click add warranty end date to Google/Apple Calendar",
            step2_item_6: "Service history log for each item (repairs, dates, cost)",
            step2_item_7: "Warranty claim wizard: pre-filled email to seller with receipt link",
            step2_item_9: "Transfer item to new owner on resale (QR with ownership history)",
            step2_item_10: "PWA with one-tap camera access",

            step3_badge: "Months 3–6",
            step3_role_tag: "Role B + business tools",
            step3_context: "Stores won't issue receipts manually. We need POS integrations, an API, and seamless onboarding — only then does receipt issuance become a natural part of the sale.",
            step3_title: "Stage 3: tools for business",
            step3_item_1: "Plugins for POS and e-commerce (Shopify, WooCommerce, Lightspeed)",
            step3_item_2: "Public REST API for programmatic receipt issuance",
            step3_item_3: "Webhooks for events (receipt issued, receipt verified)",
            step3_item_4: "Multi-user store accounts with employee roles",
            step3_item_5: "Custom receipt and verification page branding",
            step3_item_6: "Bulk historical receipt import via CSV",
            step3_item_7: "Return/exchange/void workflow for issued receipts",
            step3_item_8: "Store key rotation and revocation",
            step3_item_9: "Accounting export (CSV/XML for 1C, DATEV, etc.)",
            step3_item_10: "Advanced analytics: LTV, average order, warranty claim rate",

            step4_badge: "Months 6–12",
            step4_role_tag: "B2B2C infrastructure",
            step4_context: "The product currently has no payment functionality at all. First paid tiers only launch after pilot stores confirm willingness to pay.",
            step4_title: "Stage 4: monetization and network effects",
            step4_item_1: "Pricing plans and billing (currently no payment functionality)",
            step4_item_2: "Public 'Verified by Valuon' widget for merchant websites",
            step4_item_3: "Paid verification API for insurers and resale marketplaces",
            step4_item_4: "Extended warranty upsell at receipt issuance time (commission)",
            step4_item_5: "Onboarding checklist for new stores in the dashboard",
            step4_gate: "Paid tier launches only after written merchant confirmation, not at the same time as the pilot.",

            step5_badge: "Year 2",
            step5_role_tag: "A + B → C decision",
            step5_context: "From one country and one role to multiple jurisdictions. Each new market launches only after measurable success in the previous one.",
            step5_title: "Stage 5: geographic and legal expansion",
            step5_item_1: "Role A pilot in Estonia (5–10 merchants) — Valuon as their only receipt system",
            step5_item_2: "Parallel small-scale Role A pilot in the US",
            step5_item_3: "First Role B integration: TSE/cash register API connector (Germany)",
            step5_item_4: "Legal consultation: can an imported receipt be called 'official'",
            step5_item_5: "Expand Role A to Ireland/Finland on Estonia success",
            step5_item_6: "Expand Role B to France (cash register certification from Sep 2026)",
            step5_item_7: "Choose primary legal jurisdiction (Estonia)",
            step5_item_8: "Role C decision — only under confirmed demand, not before 2028",
            step5_gate: "Key metric: D30 retention ≥ 25%. If retention is low, consider an embeddable widget instead of a standalone app.",


            footer_copyright: "© 2026 Valuon. All rights reserved."
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

            if (el.classList.contains('card-status')) {
                const icon = el.querySelector('i');
                const iconHtml = icon ? icon.outerHTML + ' ' : '';
                el.innerHTML = `${iconHtml}${t[key]}`;
            } else {
                el.textContent = t[key];
            }
        });

        const langBtn = document.getElementById('lang-toggle');
        if (langBtn) {
            const span = langBtn.querySelector('span');
            if (span) span.textContent = lang.toUpperCase();
        }

        localStorage.setItem('valuon-lang', lang);
    }

    applyRoadmapTranslations(currentLang);

    const langToggle = document.getElementById('lang-toggle');
    if (langToggle) {
        langToggle.addEventListener('click', () => {
            const newLang = currentLang === 'ru' ? 'en' : 'ru';
            applyRoadmapTranslations(newLang);
        });
    }

    window.addEventListener('storage', (e) => {
        if (e.key === 'valuon-lang') {
            applyRoadmapTranslations(e.newValue || 'ru');
        }
    });
});

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
