document.addEventListener('DOMContentLoaded', () => {
    const privacyTranslations = {
        ru: {
            privacy_back: "← На главную",
            privacy_title: "Политика конфиденциальности",
            meta_description: "Valuon — Политика конфиденциальности. Какие данные мы собираем, зачем, как долго храним и какие у вас есть права по GDPR.",
            privacy_subtitle: "Какие данные мы собираем, зачем, как долго храним и какие у вас есть права.",
            privacy_updated: "Последнее обновление: 18 июля 2026 г.",

            privacy_toc_1: "Кто мы",
            privacy_toc_2: "Какие данные собираем",
            privacy_toc_3: "Зачем",
            privacy_toc_4: "Правовые основания",
            privacy_toc_5: "Кому передаём",
            privacy_toc_6: "Хранение",
            privacy_toc_7: "Ваши права",
            privacy_toc_8: "Cookie",
            privacy_toc_9: "Безопасность",
            privacy_toc_10: "Контакты",

            privacy_s1_title: "1. Кто мы и о чём этот документ",
            privacy_s1_p1: "Valuon — сервис цифровых чеков и учёта гарантий. Эта политика объясняет, какие персональные данные мы собираем при использовании сайта и приложения Valuon, зачем, на каком правовом основании, как долго храним и какие права есть у вас в отношении своих данных.",
            privacy_s1_p2: "Политика написана в соответствии с Общим регламентом по защите данных ЕС (GDPR, Регламент (ЕС) 2016/679). Мы находимся на этапе раннего пилота — если у вас есть вопросы, напишите нам напрямую по адресу из раздела «Контакты» ниже.",

            privacy_s2_title: "2. Какие данные мы собираем",
            privacy_s2_p1: "Мы собираем разные данные в зависимости от того, используете вы Valuon как покупатель или как продавец.",
            privacy_s2_h1: "Если вы покупатель",
            privacy_s2_c1: "Данные аккаунта: email, имя и фамилия, пароль (хранится в зашифрованном виде, мы его не видим)",
            privacy_s2_c2: "Данные о ваших вещах: название, тип, бренд, цена, серийный номер, дата покупки, срок гарантии",
            privacy_s2_c3: "Загруженные вами файлы: фото или PDF чеков",
            privacy_s2_c4: "Технические данные: тип устройства и браузера, IP-адрес — для защиты от злоупотреблений и мошенничества",
            privacy_s2_h2: "Если вы продавец (бизнес-панель)",
            privacy_s2_b1: "Данные магазина: название, идентификационный/налоговый номер, контактные данные",
            privacy_s2_b2: "Публичный криптографический ключ магазина (для проверки подлинности выпущенных чеков третьими лицами)",
            privacy_s2_b3: "Данные о выписанных чеках: состав, суммы, дата, способ оплаты, email покупателя (если указан)",
            privacy_s2_p2: "Приватный ключ подписи магазина хранится только на вашем устройстве и никогда не передаётся на сервер Valuon в открытом виде.",

            privacy_s3_title: "3. Зачем мы собираем эти данные",
            privacy_s3_i1: "Чтобы предоставлять сам сервис: хранить ваши чеки, считать сроки гарантии, показывать напоминания",
            privacy_s3_i2: "Чтобы продавец мог выпустить и криптографически подписать цифровой чек, а покупатель — проверить его подлинность",
            privacy_s3_i3: "Чтобы защищать аккаунты от несанкционированного доступа и мошенничества (проверка ботов при регистрации/входе)",
            privacy_s3_i4: "Чтобы отвечать на ваши обращения в поддержку",
            privacy_s3_i5: "Чтобы соблюдать применимые юридические обязательства",
            privacy_s3_p1: "Мы не продаём ваши персональные данные третьим лицам и не используем их для показа рекламы.",

            privacy_s4_title: "4. Правовые основания обработки",
            privacy_s4_th1: "Данные",
            privacy_s4_th2: "Основание по GDPR (ст. 6)",
            privacy_s4_r1a: "Аккаунт, чеки, вещи",
            privacy_s4_r1b: "Исполнение договора (п. 1b) — без этих данных сервис физически не может работать",
            privacy_s4_r2a: "Данные магазина и подпись чека",
            privacy_s4_r2b: "Исполнение договора с продавцом + законный интерес в защите подлинности чеков (п. 1f)",
            privacy_s4_r3a: "Технические/защитные данные (антибот, IP)",
            privacy_s4_r3b: "Законный интерес в защите сервиса от злоупотреблений (п. 1f)",
            privacy_s4_r4a: "Необязательные cookie/аналитика (если включены)",
            privacy_s4_r4b: "Ваше согласие (п. 1a) — запрашивается отдельно",

            privacy_s5_title: "5. Кому мы передаём данные",
            privacy_s5_p1: "Мы используем ограниченный набор поставщиков услуг (обработчиков данных), которые обрабатывают данные от нашего имени и по нашим инструкциям:",
            privacy_s5_i1: "Supabase — база данных, аутентификация и хранение файлов",
            privacy_s5_i2: "Cloudflare Turnstile — проверка от ботов при регистрации и входе",
            privacy_s5_i3: "Vercel — хостинг сайта",
            privacy_s5_p2: "Мы не передаём ваши данные рекламным сетям и не продаём их третьим лицам. Если в будущем появятся новые обработчики (например, провайдер email-рассылок), этот раздел будет обновлён заранее.",
            privacy_s5_h1: "Международная передача данных",
            privacy_s5_p3: "Персональные данные хранятся на серверах Supabase, расположенных в Германии — то есть физически внутри Европейской экономической зоны (ЕЭЗ). Отдельного механизма международной передачи данных (Standard Contractual Clauses и т.п.) не требуется, так как данные не покидают ЕЭЗ.",

            privacy_s6_title: "6. Как долго мы храним данные",
            privacy_s6_p1: "Данные аккаунта и связанные с ним чеки/вещи хранятся, пока ваш аккаунт активен. Если вы удаляете аккаунт, мы удаляем связанные с ним персональные данные в разумный срок, за исключением случаев, когда закон обязывает нас хранить определённые данные дольше (например, бухгалтерские данные продавца).",
            privacy_s6_p2: "Технические логи (для защиты от злоупотреблений) хранятся ограниченный срок и автоматически удаляются.",

            privacy_s7_title: "7. Ваши права",
            privacy_s7_p1: "В отношении своих персональных данных вы имеете право:",
            privacy_s7_i1: "На доступ — узнать, какие данные о вас у нас есть",
            privacy_s7_i2: "На исправление — попросить исправить неточные данные",
            privacy_s7_i3: "На удаление — попросить удалить свои данные («право быть забытым»)",
            privacy_s7_i4: "На ограничение обработки — в определённых случаях",
            privacy_s7_i5: "На переносимость данных — получить свои данные в машиночитаемом формате",
            privacy_s7_i6: "На возражение против обработки, основанной на законном интересе",
            privacy_s7_i7: "На отзыв согласия в любой момент, если обработка основана на согласии",
            privacy_s7_i8: "На подачу жалобы в надзорный орган по защите данных вашей страны",
            privacy_s7_p2: "Чтобы воспользоваться любым из этих прав, напишите нам на адрес из раздела «Контакты» — мы ответим в разумный срок.",

            privacy_s8_title: "8. Cookie и локальное хранилище",
            privacy_s8_p1: "Мы используем строго необходимые технические данные (localStorage) для запоминания ваших настроек — выбранного языка и темы оформления (светлая/тёмная). Эти данные не передаются на сервер и не используются для отслеживания.",
            privacy_s8_p2: "Сессия входа хранится через механизм аутентификации Supabase, необходимый для работы личного кабинета. Если в будущем мы добавим необязательную аналитику или другие не-технические cookie — перед их включением мы запросим ваше отдельное согласие через баннер на сайте.",

            privacy_s9_title: "9. Безопасность данных",
            privacy_s9_p1: "Мы применяем разумные технические и организационные меры защиты: шифрование паролей, политики доступа на уровне базы данных (Row Level Security), криптографическую подпись чеков (Ed25519), проверку от автоматизированных атак при входе и регистрации.",
            privacy_s9_p2: "Ни одна система не может гарантировать абсолютную защиту на 100% — если вам стало известно об уязвимости, пожалуйста, сообщите нам напрямую по контактам ниже, прежде чем публиковать информацию об этом публично.",

            privacy_s10_title: "10. Дети",
            privacy_s10_p1: "Valuon не предназначен для лиц младше 16 лет, и мы сознательно не собираем данные детей младше этого возраста. Если вам стало известно, что ребёнок предоставил нам свои данные, свяжитесь с нами — мы удалим их.",

            privacy_s11_title: "11. Изменения в этой политике",
            privacy_s11_p1: "Мы можем время от времени обновлять эту политику — например, по мере роста продукта или изменения законодательства. Дата последнего обновления указана в начале страницы. При существенных изменениях мы уведомим вас дополнительно (например, по email или баннером на сайте).",

            privacy_s12_title: "12. Контакты",
            privacy_s12_p1: "По любым вопросам о персональных данных и этой политике пишите нам:",

            footer_copyright: "© 2026 Valuon. Все права защищены."
        },
        en: {
            privacy_back: "← Back to Home",
            privacy_title: "Privacy Policy",
            meta_description: "Valuon — Privacy Policy. What data we collect, why, how long we keep it, and your rights under GDPR.",
            privacy_subtitle: "What data we collect, why, how long we keep it, and what rights you have.",
            privacy_updated: "Last updated: July 18, 2026",

            privacy_toc_1: "Who we are",
            privacy_toc_2: "Data we collect",
            privacy_toc_3: "Why",
            privacy_toc_4: "Legal basis",
            privacy_toc_5: "Who we share with",
            privacy_toc_6: "Retention",
            privacy_toc_7: "Your rights",
            privacy_toc_8: "Cookies",
            privacy_toc_9: "Security",
            privacy_toc_10: "Contact",

            privacy_s1_title: "1. Who we are and what this document is",
            privacy_s1_p1: "Valuon is a digital receipt and warranty tracking service. This policy explains what personal data we collect when you use the Valuon website and app, why, on what legal basis, how long we keep it, and what rights you have over your data.",
            privacy_s1_p2: "This policy is written in accordance with the EU General Data Protection Regulation (GDPR, Regulation (EU) 2016/679). We are currently in an early pilot stage — if you have questions, please contact us directly using the address in the \"Contact\" section below.",

            privacy_s2_title: "2. What data we collect",
            privacy_s2_p1: "We collect different data depending on whether you use Valuon as a buyer or as a merchant.",
            privacy_s2_h1: "If you are a buyer",
            privacy_s2_c1: "Account data: email, first and last name, password (stored encrypted, we never see it)",
            privacy_s2_c2: "Data about your items: name, type, brand, price, serial number, purchase date, warranty period",
            privacy_s2_c3: "Files you upload: photos or PDFs of receipts",
            privacy_s2_c4: "Technical data: device and browser type, IP address — to protect against abuse and fraud",
            privacy_s2_h2: "If you are a merchant (business panel)",
            privacy_s2_b1: "Store data: name, tax/registration ID, contact details",
            privacy_s2_b2: "The store's public cryptographic key (so third parties can verify the authenticity of issued receipts)",
            privacy_s2_b3: "Data about issued receipts: line items, amounts, date, payment method, buyer's email (if provided)",
            privacy_s2_p2: "The store's private signing key is stored only on your own device and is never transmitted to the Valuon server in plaintext.",

            privacy_s3_title: "3. Why we collect this data",
            privacy_s3_i1: "To provide the service itself: storing your receipts, calculating warranty periods, showing reminders",
            privacy_s3_i2: "So a merchant can issue and cryptographically sign a digital receipt, and a buyer can verify its authenticity",
            privacy_s3_i3: "To protect accounts from unauthorized access and fraud (bot checks on sign-up/sign-in)",
            privacy_s3_i4: "To respond to your support requests",
            privacy_s3_i5: "To comply with applicable legal obligations",
            privacy_s3_p1: "We do not sell your personal data to third parties or use it to serve ads.",

            privacy_s4_title: "4. Legal basis for processing",
            privacy_s4_th1: "Data",
            privacy_s4_th2: "GDPR basis (Art. 6)",
            privacy_s4_r1a: "Account, receipts, items",
            privacy_s4_r1b: "Performance of a contract (1b) — the service cannot function without this data",
            privacy_s4_r2a: "Store data and receipt signature",
            privacy_s4_r2b: "Performance of a contract with the merchant + legitimate interest in protecting receipt authenticity (1f)",
            privacy_s4_r3a: "Technical/protective data (anti-bot, IP)",
            privacy_s4_r3b: "Legitimate interest in protecting the service from abuse (1f)",
            privacy_s4_r4a: "Optional cookies/analytics (if enabled)",
            privacy_s4_r4b: "Your consent (1a) — requested separately",

            privacy_s5_title: "5. Who we share data with",
            privacy_s5_p1: "We use a limited set of service providers (data processors) who process data on our behalf and under our instructions:",
            privacy_s5_i1: "Supabase — database, authentication and file storage",
            privacy_s5_i2: "Cloudflare Turnstile — bot protection on sign-up and sign-in",
            privacy_s5_i3: "Vercel — website hosting",
            privacy_s5_p2: "We do not share your data with ad networks or sell it to third parties. If new processors are added in the future (e.g. an email delivery provider), this section will be updated in advance.",
            privacy_s5_h1: "International data transfers",
            privacy_s5_p3: "Personal data is stored on Supabase servers located in Germany — physically within the European Economic Area (EEA). No additional international transfer mechanism (such as Standard Contractual Clauses) is required, since the data never leaves the EEA.",

            privacy_s6_title: "6. How long we keep data",
            privacy_s6_p1: "Account data and associated receipts/items are kept while your account is active. If you delete your account, we delete the associated personal data within a reasonable time, except where the law requires us to keep certain data longer (e.g. a merchant's accounting records).",
            privacy_s6_p2: "Technical logs (for abuse protection) are kept for a limited period and deleted automatically.",

            privacy_s7_title: "7. Your rights",
            privacy_s7_p1: "Regarding your personal data, you have the right to:",
            privacy_s7_i1: "Access — find out what data we hold about you",
            privacy_s7_i2: "Rectification — ask us to correct inaccurate data",
            privacy_s7_i3: "Erasure — ask us to delete your data (\"right to be forgotten\")",
            privacy_s7_i4: "Restriction of processing — in certain cases",
            privacy_s7_i5: "Data portability — receive your data in a machine-readable format",
            privacy_s7_i6: "Object to processing based on legitimate interest",
            privacy_s7_i7: "Withdraw consent at any time, where processing is based on consent",
            privacy_s7_i8: "Lodge a complaint with your country's data protection authority",
            privacy_s7_p2: "To exercise any of these rights, write to us at the address in the \"Contact\" section — we will respond within a reasonable time.",

            privacy_s8_title: "8. Cookies and local storage",
            privacy_s8_p1: "We use strictly necessary technical storage (localStorage) to remember your preferences — selected language and light/dark theme. This data is never sent to a server and is not used for tracking.",
            privacy_s8_p2: "Your login session is handled via Supabase's authentication mechanism, required for your account dashboard to work. If we add optional analytics or other non-essential cookies in the future, we will ask for your separate consent via an on-site banner before enabling them.",

            privacy_s9_title: "9. Data security",
            privacy_s9_p1: "We apply reasonable technical and organizational safeguards: password encryption, database-level access policies (Row Level Security), cryptographic receipt signing (Ed25519), and bot protection on sign-in and sign-up.",
            privacy_s9_p2: "No system can guarantee 100% protection — if you become aware of a vulnerability, please report it to us directly using the contact details below before disclosing it publicly.",

            privacy_s10_title: "10. Children",
            privacy_s10_p1: "Valuon is not intended for individuals under 16, and we do not knowingly collect data from children under this age. If you become aware that a child has provided us with their data, please contact us and we will delete it.",

            privacy_s11_title: "11. Changes to this policy",
            privacy_s11_p1: "We may update this policy from time to time — for example, as the product grows or the law changes. The last-updated date is shown at the top of the page. For material changes, we will notify you additionally (e.g. by email or an on-site banner).",

            privacy_s12_title: "12. Contact",
            privacy_s12_p1: "For any questions about personal data and this policy, contact us at:",

            footer_copyright: "© 2026 Valuon. All rights reserved."
        }
    };

    let currentLang = localStorage.getItem('valuon-lang') || 'ru';

    function applyPrivacyTranslations(lang) {
        const t = privacyTranslations[lang] || privacyTranslations.ru;
        currentLang = lang;

        document.title = t.privacy_title + ' — Valuon';
        const desc = document.querySelector('meta[name="description"]');
        if (desc) desc.content = t.meta_description;

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (!t[key]) return;
            el.textContent = t[key];
        });

        const langBtn = document.getElementById('lang-toggle');
        if (langBtn) {
            const span = langBtn.querySelector('span');
            if (span) span.textContent = lang.toUpperCase();
        }

        localStorage.setItem('valuon-lang', lang);
    }

    applyPrivacyTranslations(currentLang);

    const langToggle = document.getElementById('lang-toggle');
    if (langToggle) {
        langToggle.addEventListener('click', () => {
            const newLang = currentLang === 'ru' ? 'en' : 'ru';
            applyPrivacyTranslations(newLang);
        });
    }

    window.addEventListener('storage', (e) => {
        if (e.key === 'valuon-lang') {
            applyPrivacyTranslations(e.newValue || 'ru');
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
