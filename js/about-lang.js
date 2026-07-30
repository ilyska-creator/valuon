const aboutTranslations = {
    ru: {
        about_title: "Valuon — О нас",
        about_desc: "Valuon — Цифровой профиль покупки. Криптографически заверенные чеки, автоматический расчёт гарантий, история всех покупок в одном месте.",
        about_back: "← На главную",
        about_heading: "О Valuon",
        about_subtitle: "Цифровые чеки, которым можно доверять.",
        about_mission_title: "Миссия",
        about_mission_text: "Сделать каждый чек цифровым, криптографически защищённым и всегда доступным. Никаких выцветших термобумажных лент, потерянных гарантий и споров с магазином.",
        about_how_title: "Как это работает",
        about_how_text: "Продавец выписывает чек с Ed25519-цифровой подписью. Покупатель получает PDF с QR-кодом — отсканировав его, любой может проверить подлинность чека. Гарантии отслеживаются автоматически, напоминания приходят до истечения срока.",
        about_why_title: "Почему Valuon",
        about_why_1: "Криптографическая подпись Ed25519 — чек невозможно подделать",
        about_why_2: "Автоматический расчёт и отслеживание гарантий",
        about_why_3: "Чеки не выцветают и не теряются — они всегда в облаке",
        about_why_4: "Мгновенная верификация по QR-коду без регистрации",
        about_why_5: "Бесплатно для покупателей",
        about_contact_title: "Контакты",
        about_contact_text: "По всем вопросам пишите на почту или в Telegram-канал.",
        footer_copyright: "© 2026 Valuon. Все права защищены.",
        cookie_text: "Мы используем cookies для работы сайта. Продолжая использовать сайт, вы соглашаетесь с ",
        cookie_link: "Политикой конфиденциальности",
        cookie_btn: "Принять"
    },
    en: {
        about_title: "Valuon — About Us",
        about_desc: "Valuon — Digital purchase profile. Cryptographically signed receipts, automatic warranty calculation, all purchase history in one place.",
        about_back: "← Back to Home",
        about_heading: "About Valuon",
        about_subtitle: "Digital receipts you can trust.",
        about_mission_title: "Mission",
        about_mission_text: "Make every receipt digital, cryptographically secure, and always accessible. No more faded thermal paper, lost warranties, or disputes with the store.",
        about_how_title: "How It Works",
        about_how_text: "The seller issues a receipt with an Ed25519 digital signature. The buyer gets a PDF with a QR code — anyone can scan it to verify the receipt's authenticity. Warranties are tracked automatically, reminders arrive before expiry.",
        about_why_title: "Why Valuon",
        about_why_1: "Ed25519 cryptographic signature — receipts cannot be forged",
        about_why_2: "Automatic warranty calculation and tracking",
        about_why_3: "Receipts never fade or get lost — always in the cloud",
        about_why_4: "Instant QR verification without registration",
        about_why_5: "Free for buyers",
        about_contact_title: "Contact",
        about_contact_text: "For any questions, write to our email or Telegram channel.",
        footer_copyright: "© 2026 Valuon. All rights reserved.",
        cookie_text: "We use cookies for the site to function. By continuing to use the site, you agree to the ",
        cookie_link: "Privacy Policy",
        cookie_btn: "Accept"
    }
};

let currentLang = localStorage.getItem('valuon-lang') || 'ru';

function applyAboutTranslations(lang) {
    const t = aboutTranslations[lang] || aboutTranslations.ru;
    currentLang = lang;

    document.title = t.about_title;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.content = t.about_desc;

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

    const cookieText = document.getElementById('cookie-text');
    if (cookieText) {
        const link = `<a href="privacy.html">${t.cookie_link}</a>`;
        cookieText.innerHTML = `${t.cookie_text}${link}.`;
    }
    const cookieBtn = document.getElementById('cookie-btn');
    if (cookieBtn) cookieBtn.textContent = t.cookie_btn;

    const langBtn = document.getElementById('lang-toggle');
    if (langBtn) {
        const span = langBtn.querySelector('span');
        if (span) span.textContent = lang.toUpperCase();
    }

    localStorage.setItem('valuon-lang', lang);
    document.documentElement.lang = lang === 'en' ? 'en' : 'ru';
}

applyAboutTranslations(currentLang);

document.addEventListener('DOMContentLoaded', () => {
    const langToggle = document.getElementById('lang-toggle');
    if (langToggle) {
        langToggle.addEventListener('click', () => {
            const newLang = currentLang === 'ru' ? 'en' : 'ru';
            applyAboutTranslations(newLang);
        });
    }

    window.addEventListener('storage', (e) => {
        if (e.key === 'valuon-lang') {
            applyAboutTranslations(e.newValue || 'ru');
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
