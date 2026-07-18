document.addEventListener('DOMContentLoaded', () => {
    const termsTranslations = {
        ru: {
            terms_back: "← На главную",
            terms_title: "Условия использования",
            meta_description: "Valuon — Условия использования. Правила пользования сервисом для покупателей и продавцов, ограничение ответственности.",
            terms_subtitle: "Правила пользования сервисом Valuon для покупателей и продавцов.",
            terms_updated: "Последнее обновление: 18 июля 2026 г.",

            terms_toc_1: "Кто мы",
            terms_toc_2: "Сервис",
            terms_toc_3: "Аккаунт",
            terms_toc_4: "Для покупателей",
            terms_toc_5: "Для продавцов",
            terms_toc_6: "Статус чека",
            terms_toc_7: "Интел. собственность",
            terms_toc_8: "Отказ от гарантий",
            terms_toc_9: "Ответственность",
            terms_toc_10: "Прекращение доступа",
            terms_toc_11: "Изменения",
            terms_toc_12: "Право",
            terms_toc_13: "Контакты",

            terms_s1_title: "1. Кто мы и о чём этот документ",
            terms_s1_p1: "Эти условия использования («Условия») регулируют пользование сайтом и приложением Valuon — сервисом цифровых чеков и учёта гарантий. Регистрируясь или используя Valuon, вы соглашаетесь с этими Условиями. Если вы не согласны — пожалуйста, не используйте сервис.",
            terms_s1_p2a: "Мы находимся на этапе раннего пилота. Вопросы, связанные с обработкой персональных данных, отдельно описаны в",
            terms_s1_privacy_link: "Политике конфиденциальности",
            terms_s1_p2b: "— этот документ регулирует именно правила пользования сервисом.",

            terms_s2_title: "2. Что представляет собой сервис",
            terms_s2_p1: "Valuon позволяет продавцам выпускать цифровые чеки с криптографической подписью, а покупателям — хранить эти чеки, отслеживать сроки гарантии и проверять подлинность чека через страницу верификации.",
            terms_s2_p2: "Сервис предоставляется в текущем виде («as is»), находится в стадии активной разработки и пилотного запуска — набор функций может меняться, дополняться или временно быть недоступным.",

            terms_s3_title: "3. Регистрация и аккаунт",
            terms_s3_i1: "Сервис предназначен для лиц старше 16 лет.",
            terms_s3_i2: "Вы обязуетесь предоставлять точные данные при регистрации и поддерживать их в актуальном состоянии.",
            terms_s3_i3: "Вы несёте ответственность за сохранность своего пароля и за все действия, совершённые под вашим аккаунтом.",
            terms_s3_i4: "Если вы подозреваете несанкционированный доступ к своему аккаунту — сообщите нам немедленно по контактам в разделе 13.",

            terms_s4_title: "4. Правила для покупателей",
            terms_s4_i1: "Вы можете хранить в Valuon чеки собственных покупок и загружать файлы (фото/PDF), права на которые принадлежат вам или которые вы вправе использовать.",
            terms_s4_i2: "Запрещено загружать поддельные, чужие или вводящие в заблуждение чеки, выдавая их за подлинные.",
            terms_s4_i3: "Valuon не является стороной сделки купли-продажи между вами и продавцом и не несёт ответственности за качество товара, гарантийное обслуживание со стороны продавца или разрешение споров между вами и продавцом.",

            terms_s5_title: "5. Правила для продавцов (бизнес-панель)",
            terms_s5_i1: "Вы обязуетесь указывать точные данные о магазине и о выпускаемых чеках — суммы, состав, дату и способ оплаты.",
            terms_s5_i2: "Вы несёте единоличную ответственность за сохранность своего приватного ключа подписи. Он хранится на вашем устройстве и никогда не передаётся Valuon — мы не можем восстановить его в случае утери.",
            terms_s5_i3: "Запрещено выпускать чеки на несуществующие сделки или использовать сервис для мошеннических целей.",
            terms_s5_i4: "Вы соглашаетесь, что Valuon может приостановить или прекратить доступ магазина к сервису при обоснованном подозрении в злоупотреблении.",

            terms_s6_title: "6. Что именно гарантирует цифровая подпись чека",
            terms_s6_p1: "Криптографическая подпись Valuon (Ed25519) подтверждает, что данные чека — сумма, состав, дата — не были изменены после выпуска, и что чек был подписан ключом конкретного магазина. Она не является государственной фискализацией или сертификацией в юрисдикциях, где для этого требуется отдельный сертифицированный провайдер.",
            terms_s6_p2: "В странах, где закон обязывает продавца использовать сертифицированную кассовую систему, чек Valuon может дополнять, но не заменяет собой официальный фискальный документ, если иное прямо не указано в интерфейсе для конкретного магазина.",

            terms_s7_title: "7. Интеллектуальная собственность",
            terms_s7_p1: "Дизайн, код, логотип и товарный знак Valuon принадлежат нам или нашим лицензиарам. Используя сервис, вы не приобретаете никаких прав на них, кроме права пользоваться сервисом по назначению.",
            terms_s7_p2: "Данные и файлы, которые вы загружаете (чеки, фото, информация о товарах), остаются вашей собственностью. Вы предоставляете нам ограниченное право хранить и обрабатывать их исключительно для предоставления вам сервиса.",

            terms_s8_title: "8. Отказ от гарантий",
            terms_s8_p1: "Сервис предоставляется «как есть» и «по мере доступности», без каких-либо гарантий, явных или подразумеваемых, включая гарантии бесперебойной работы, отсутствия ошибок или пригодности для конкретной цели. Мы находимся на этапе пилота, и функциональность может изменяться.",

            terms_s9_title: "9. Ограничение ответственности",
            terms_s9_p1: "В максимально допустимой законом степени Valuon не несёт ответственности за косвенные, случайные или последующие убытки, возникшие в связи с использованием или невозможностью использования сервиса, включая утрату данных о гарантии или споры между покупателем и продавцом.",
            terms_s9_p2: "Ничто в этих Условиях не ограничивает ответственность в случаях, когда такое ограничение не допускается применимым законодательством (например, в отношении прав потребителей).",

            terms_s10_title: "10. Прекращение доступа",
            terms_s10_p1: "Вы можете удалить свой аккаунт в любой момент через настройки или, временно, написав нам по контактам ниже. Мы можем приостановить или прекратить доступ к аккаунту при нарушении этих Условий или при обоснованном подозрении в мошенничестве.",

            terms_s11_title: "11. Изменения в условиях",
            terms_s11_p1: "Мы можем обновлять эти Условия по мере развития сервиса. Дата последнего обновления указана в начале страницы. При существенных изменениях мы уведомим вас дополнительно (например, по email или баннером на сайте). Продолжение использования сервиса после изменений означает согласие с новой редакцией.",

            terms_s12_title: "12. Применимое право",
            terms_s12_p1: "Эти Условия толкуются в соответствии с законодательством юрисдикции регистрации Valuon.",

            terms_s13_title: "13. Контакты",
            terms_s13_p1: "По любым вопросам об этих Условиях пишите нам:",

            footer_copyright: "© 2026 Valuon. Все права защищены."
        },
        en: {
            terms_back: "← Back to Home",
            terms_title: "Terms of Service",
            meta_description: "Valuon — Terms of Service. Rules for using the service for buyers and merchants, limitation of liability.",
            terms_subtitle: "Rules for using the Valuon service for buyers and merchants.",
            terms_updated: "Last updated: July 18, 2026",

            terms_toc_1: "Who we are",
            terms_toc_2: "The service",
            terms_toc_3: "Account",
            terms_toc_4: "For buyers",
            terms_toc_5: "For merchants",
            terms_toc_6: "Receipt status",
            terms_toc_7: "Intellectual property",
            terms_toc_8: "Disclaimer",
            terms_toc_9: "Liability",
            terms_toc_10: "Termination",
            terms_toc_11: "Changes",
            terms_toc_12: "Governing law",
            terms_toc_13: "Contact",

            terms_s1_title: "1. Who we are and what this document is",
            terms_s1_p1: "These Terms of Service (\"Terms\") govern your use of the Valuon website and app — a digital receipt and warranty tracking service. By registering for or using Valuon, you agree to these Terms. If you do not agree, please do not use the service.",
            terms_s1_p2a: "We are currently in an early pilot stage. Matters related to personal data processing are described separately in our",
            terms_s1_privacy_link: "Privacy Policy",
            terms_s1_p2b: "— this document governs the rules of using the service itself.",

            terms_s2_title: "2. What the service is",
            terms_s2_p1: "Valuon lets merchants issue cryptographically signed digital receipts, and lets buyers store those receipts, track warranty periods, and verify a receipt's authenticity via the verification page.",
            terms_s2_p2: "The service is provided \"as is,\" is in active development and pilot stage, and its feature set may change, expand, or be temporarily unavailable.",

            terms_s3_title: "3. Registration and account",
            terms_s3_i1: "The service is intended for individuals aged 16 or older.",
            terms_s3_i2: "You agree to provide accurate information at registration and to keep it up to date.",
            terms_s3_i3: "You are responsible for keeping your password secure and for all activity under your account.",
            terms_s3_i4: "If you suspect unauthorized access to your account, notify us immediately using the contact details in section 13.",

            terms_s4_title: "4. Rules for buyers",
            terms_s4_i1: "You may store receipts of your own purchases in Valuon and upload files (photos/PDFs) that you own or are otherwise entitled to use.",
            terms_s4_i2: "You may not upload forged, third-party, or misleading receipts while representing them as genuine.",
            terms_s4_i3: "Valuon is not a party to the sale transaction between you and the merchant and is not responsible for product quality, warranty service provided by the merchant, or resolving disputes between you and the merchant.",

            terms_s5_title: "5. Rules for merchants (business panel)",
            terms_s5_i1: "You agree to provide accurate store information and accurate receipt data — amounts, line items, date, and payment method.",
            terms_s5_i2: "You are solely responsible for safeguarding your private signing key. It is stored on your own device and is never transmitted to Valuon — we cannot recover it if lost.",
            terms_s5_i3: "You may not issue receipts for transactions that did not occur, or use the service for fraudulent purposes.",
            terms_s5_i4: "You agree that Valuon may suspend or terminate a store's access to the service on reasonable suspicion of abuse.",

            terms_s6_title: "6. What the receipt's digital signature actually guarantees",
            terms_s6_p1: "Valuon's cryptographic signature (Ed25519) confirms that the receipt's data — amount, line items, date — has not been altered since issuance, and that the receipt was signed with a specific store's key. It is not a government fiscalization or certification in jurisdictions that require a separate certified provider for that purpose.",
            terms_s6_p2: "In countries where the law requires merchants to use a certified cash register system, a Valuon receipt may complement, but does not replace, the official fiscal document, unless explicitly stated otherwise in the interface for a specific store.",

            terms_s7_title: "7. Intellectual property",
            terms_s7_p1: "Valuon's design, code, logo, and trademark belong to us or our licensors. Using the service does not grant you any rights to them beyond the right to use the service as intended.",
            terms_s7_p2: "Data and files you upload (receipts, photos, item information) remain your property. You grant us a limited right to store and process them solely to provide you the service.",

            terms_s8_title: "8. Disclaimer of warranties",
            terms_s8_p1: "The service is provided \"as is\" and \"as available,\" without warranties of any kind, express or implied, including warranties of uninterrupted operation, error-free performance, or fitness for a particular purpose. We are in a pilot stage and functionality may change.",

            terms_s9_title: "9. Limitation of liability",
            terms_s9_p1: "To the maximum extent permitted by law, Valuon is not liable for indirect, incidental, or consequential damages arising from use or inability to use the service, including loss of warranty data or disputes between a buyer and a merchant.",
            terms_s9_p2: "Nothing in these Terms limits liability where such limitation is not permitted under applicable law (e.g. consumer protection rights).",

            terms_s10_title: "10. Termination of access",
            terms_s10_p1: "You may delete your account at any time via settings or, temporarily, by contacting us using the details below. We may suspend or terminate account access for violations of these Terms or on reasonable suspicion of fraud.",

            terms_s11_title: "11. Changes to these Terms",
            terms_s11_p1: "We may update these Terms as the service evolves. The last-updated date is shown at the top of the page. For material changes, we will notify you additionally (e.g. by email or an on-site banner). Continued use of the service after changes constitutes acceptance of the revised Terms.",

            terms_s12_title: "12. Governing law",
            terms_s12_p1: "These Terms are interpreted in accordance with the law of Valuon's jurisdiction of incorporation.",

            terms_s13_title: "13. Contact",
            terms_s13_p1: "For any questions about these Terms, contact us at:",

            footer_copyright: "© 2026 Valuon. All rights reserved."
        }
    };

    let currentLang = localStorage.getItem('valuon-lang') || 'ru';

    function applyTermsTranslations(lang) {
        const t = termsTranslations[lang] || termsTranslations.ru;
        currentLang = lang;

        document.title = t.terms_title + ' — Valuon';
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

    applyTermsTranslations(currentLang);

    const langToggle = document.getElementById('lang-toggle');
    if (langToggle) {
        langToggle.addEventListener('click', () => {
            const newLang = currentLang === 'ru' ? 'en' : 'ru';
            applyTermsTranslations(newLang);
        });
    }

    window.addEventListener('storage', (e) => {
        if (e.key === 'valuon-lang') {
            applyTermsTranslations(e.newValue || 'ru');
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
