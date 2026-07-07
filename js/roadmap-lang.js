document.addEventListener('DOMContentLoaded', () => {
    const roadmapTranslations = {
        ru: {
            roadmap_back: "← На главную",
            roadmap_title: "Дорожная карта Valuon: единая платформа официальных чеков",
            roadmap_desc: "План развития от рабочего MVP до единой точки доступа к официальным чекам в разных странах. Гарантии и перепродажа — полезная надстройка поверх этого ядра, а не самоцель.",

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

            step0_badge: "Ближайшие 30 дней",
            step0_role_tag: "Роль А + Роль Б — основа",
            step0_title: "Шаг 0: техническая база под честное «официально»",
            step0_item_1: "Исправлена ошибка: статус чека при создании и при импорте теперь отображается сразу, без переключения языка",
            step0_item_2: "Настоящая криптографическая подпись чека (Ed25519/WebCrypto) вместо обычного хеша",
            step0_item_3: "Полный аудит RLS-политик Supabase по всем таблицам",
            step0_item_4: "Явное разделение статусов: чек, выпущенный Valuon, и чек, импортированный из государственной системы — не одно поле «verified» на оба случая",
            step0_item_5: "Воронка аналитики: активация → первый чек → возврат на 7-й и 30-й день",

            step1_badge: "Месяцы 1–3",
            step1_role_tag: "Роль А",
            step1_title: "Шаг 1: доказать Роль А на одном рынке",
            step1_item_1: "Пилот в Эстонии: 5–10 малых продавцов/мастерских без собственной кассовой системы — Valuon как их единственная система цифровых чеков",
            step1_item_2: "Параллельный точечный пилот в США — там нет даже федерального требования просто выдавать чек",
            step1_item_3: "Событийные уведомления: истечение гарантии и её продление на 12 месяцев после ремонта по Праву на ремонт (действует с 31.07.2026)",
            step1_item_4: "Метрика: Retention D30 ≥ 25% — а не число выпущенных чеков",
            step1_gate: "Точка решения (день 90): если retention низкий — рассмотреть встраиваемый виджет вместо отдельного приложения, прежде чем продолжать инвестировать в B2C.",

            step2_badge: "Месяцы 3–6",
            step2_role_tag: "Роль Б",
            step2_title: "Шаг 2: первая интеграция для Роли Б",
            step2_item_1: "Один интеграционный коннектор к POS/кассовому API в фискализированной стране (например, TSE-приложение Shopify для Германии)",
            step2_item_2: "Импорт уже подписанного государством чека — с явной пометкой источника подписи, без выдачи его за собственную подпись Valuon",
            step2_item_3: "3–5 пилотных магазинов на этой интеграции — не 50 сразу, цель шага чисто техническая",
            step2_item_4: "Юридическая консультация по конкретному вопросу: можно ли называть импортированный чек «официальным» на стороне Valuon",

            step3_badge: "Месяцы 6–12",
            step3_role_tag: "Роль А + Роль Б",
            step3_title: "Шаг 3: расширение и решение о географии",
            step3_item_1: "Расширение Роли А на Ирландию или Финляндию — только если Эстония показала повторное использование чека пользователем",
            step3_item_2: "Расширение Роли Б на Францию — обязательная сертификация касс с сентября 2026 форсирует продавцов пересматривать системы именно сейчас",
            step3_item_3: "Выбор одной основной юрисдикции для юрлица (Эстония)",
            step3_item_4: "Платные тарифы Merchant Starter/Bridge — только после того, как пилотные магазины подтвердят готовность платить",
            step3_gate: "Точка решения: платный тариф запускается по предзаказу или письменному подтверждению магазина, а не одновременно с самим пилотом.",

            step4_badge: "Год 2",
            step4_role_tag: "Роль А + Роль Б → решение по Роли В",
            step4_title: "Шаг 4: масштабирование и решение по Роли В",
            step4_item_1: "Измеримая функция реестра: у пользователя — чеки из нескольких магазинов и стран в одном месте",
            step4_item_2: "Решение об инвестициях в сертификацию Роли В в одной стране — только под подтверждённый спрос, не заранее",
            step4_item_3: "Расширение на новые категории товаров и страны — только после измеримого эффекта в уже проверенных нишах",
            step4_item_4: "Более сложная инфраструктура (Merkle-дерево, DID, ZK-proofs) — только под запрос конкретного партнёра (страховая, площадка перепродажи)",

            out_of_scope_title: "Что мы сознательно не обещаем сейчас",
            out_of_scope_desc: "Раньше в планах Valuon фигурировали формулировки, которые опережали то, что реально построено. Здесь мы явно проговариваем, что отложено — и почему.",
            out_of_scope_item_1: "Единый глобальный реестр и лоббирование стандарта ISO/CEN — раньше Шага 4 и без подтверждённого спроса партнёров это преждевременно",
            out_of_scope_item_2: "Кросс-граничный паспорт покупки (например, из Китая для сервиса в Германии) — интересная идея на будущее, не задача ближайших 12 месяцев",
            out_of_scope_item_3: "Соответствие Digital Product Passport (DPP/ESPR) — это паспорт материалов продукта, не подтверждение покупки; электроника в DPP ожидается не раньше 2028–2029",
            out_of_scope_item_4: "Замена фискальных систем (TSE/RKSV/NF525 и др.) — Valuon встраивается поверх них, а не конкурирует с ними за подпись чека",

            footer_copyright: "© 2026 Valuon. Все права защищены."
        },
        en: {
            roadmap_back: "← Back to Home",
            roadmap_title: "Valuon Roadmap: a unified platform for official digital receipts",
            roadmap_desc: "Development plan from a working MVP to a single access point for official receipts across countries. Warranty and resale features are a useful layer on top of this core, not the goal itself.",

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

            step0_badge: "Next 30 days",
            step0_role_tag: "Role A + Role B — foundation",
            step0_title: "Step 0: technical foundation for an honest \"official\"",
            step0_item_1: "Fixed: receipt status now shows immediately on creation and import, without needing to switch language",
            step0_item_2: "Real cryptographic receipt signing (Ed25519/WebCrypto) instead of a plain hash",
            step0_item_3: "Full RLS policy audit across all Supabase tables",
            step0_item_4: "Explicit separation of statuses: a receipt issued by Valuon vs. one imported from a government system — not one \"verified\" field for both",
            step0_item_5: "Analytics funnel: activation → first receipt → D7/D30 return",

            step1_badge: "Months 1–3",
            step1_role_tag: "Role A",
            step1_title: "Step 1: prove Role A in one market",
            step1_item_1: "Estonia pilot: 5–10 small merchants/repair shops without their own cash register system — Valuon as their only digital receipt system",
            step1_item_2: "Parallel small-scale US pilot — there isn't even a federal requirement to issue a receipt at all",
            step1_item_3: "Event-based notifications: warranty expiry and its 12-month extension after repair under the Right to Repair (in force from 31 July 2026)",
            step1_item_4: "Metric: D30 retention ≥ 25% — not the number of receipts issued",
            step1_gate: "Decision point (day 90): if retention is low, consider an embeddable widget instead of a standalone app before investing further in B2C.",

            step2_badge: "Months 3–6",
            step2_role_tag: "Role B",
            step2_title: "Step 2: first integration for Role B",
            step2_item_1: "One POS/cash register API connector in a fiscalized country (e.g. Shopify's TSE app for Germany)",
            step2_item_2: "Import an already government-signed receipt — clearly labelled by signature source, never presented as Valuon's own signature",
            step2_item_3: "3–5 pilot merchants on this integration, not 50 at once — the goal of this step is purely technical",
            step2_item_4: "Legal consultation on one specific question: can an imported receipt be called \"official\" on Valuon's side",

            step3_badge: "Months 6–12",
            step3_role_tag: "Role A + Role B",
            step3_title: "Step 3: expansion and a geography decision",
            step3_item_1: "Expand Role A to Ireland or Finland — only if Estonia showed repeat use of the receipt by users",
            step3_item_2: "Expand Role B to France — mandatory cash register certification from September 2026 forces merchants to reconsider their systems right now",
            step3_item_3: "Choose one primary legal jurisdiction (Estonia)",
            step3_item_4: "Launch paid Merchant Starter/Bridge tiers — only after pilot merchants confirm willingness to pay",
            step3_gate: "Decision point: the paid tier launches on pre-order or written merchant confirmation, not at the same time as the pilot itself.",

            step4_badge: "Year 2",
            step4_role_tag: "Role A + Role B → Role C decision",
            step4_title: "Step 4: scaling and the Role C decision",
            step4_item_1: "A measurable registry function: a user has receipts from multiple merchants and countries in one place",
            step4_item_2: "Decide on investing in Role C certification in one country — only under confirmed demand, not preemptively",
            step4_item_3: "Expand to new product categories/countries — only after a measurable effect in already-proven niches",
            step4_item_4: "More complex infrastructure (Merkle tree, DID, ZK-proofs) — only on request from a specific partner (insurer, resale marketplace)",

            out_of_scope_title: "What we deliberately aren't promising right now",
            out_of_scope_desc: "Earlier Valuon plans included language that outran what was actually built. Here we spell out what's deferred, and why.",
            out_of_scope_item_1: "A single global registry and lobbying for an ISO/CEN standard — premature before Step 4 and without confirmed partner demand",
            out_of_scope_item_2: "A cross-border purchase passport (e.g. from China for service in Germany) — an interesting future idea, not a task for the next 12 months",
            out_of_scope_item_3: "Digital Product Passport (DPP/ESPR) compliance — that's a product materials passport, not proof of purchase; electronics aren't expected in DPP before 2028–2029",
            out_of_scope_item_4: "Replacing fiscal systems (TSE/RKSV/NF525, etc.) — Valuon builds on top of them, not competes with them for the signature",

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