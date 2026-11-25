// Переводы для index.html вынесены в отдельный обычный (не module) скрипт.
//
// Раньше это всё жило внутри js/script.js — а он объявлен как
// type="module" и в первой же строке импортирует Supabase SDK с CDN
// (cdn.jsdelivr.net). Модуль не выполняет НИ ОДНОЙ строки кода, пока не
// разрешится этот импорт — то есть применение переводов ждало сетевого
// запроса к стороннему CDN, и пользователь на мгновение видел русский
// текст, зашитый в HTML, прежде чем он подменялся на английский (если
// выбран английский язык).
//
// Здесь скрипт обычный, подключён без defer/module, расположен в конце
// body — то есть выполняется сразу, как только браузер до него доходит,
// и не ждёт ни Supabase, ни DOMContentLoaded.

const translations = {
    ru: {
        page_title: "Valuon — Главная",
        nav_features: "Возможности", nav_business: "Для бизнеса", nav_how: "Как это работает", nav_mission: "Миссия", nav_login: "Вход", nav_dashboard: "В кабинет", nav_verify: "Проверить чек",
        hero_title: 'Единая система <br>электронных чеков',
        hero_desc: "Каждый чек подписан криптографически и проверяется за секунду. Подделать — невозможно, потерять — тоже.",

        hero_btn_start: "Начать бесплатно",
        hero_btn_dashboard: "Перейти в кабинет",
        hero_btn_login: "Войти в аккаунт",
        hero_btn_verify: "Проверить чек",
        hero_subtext_social: "Мы только начинаем — ваш голос повлияет на то, каким Valuon станет",
        demo_qr_verified: "Чек подлинный",
        demo_processing: "Проверяем подпись...",
        demo_signature_verified: "Подпись Ed25519 подтверждена",
        demo_store: "TechStore Tallinn · €1,597",
        demo_item1: "MacBook Air M2",
        demo_item2: "Magic Cover",
        demo_item3: "AppleCare+",
        demo_total_label: "Итого:",
        demo_loader_scan: "Сканируем QR…",
        demo_loader_check: "Проверяем подпись…",
        demo_loader_result: "Формируем результат…",

        float_receipt: "Чек сохранен", float_instant: "За секунду",
        feat_title: "Всё, что нужно <br>для ваших электронных чеков",
        feat_desc: "Мы убрали хаос из хранения и проверки чеков, оставив только то, что действительно важно.",
        feat_1_title: "Облачный архив чеков", feat_1_desc: "Загружайте фото чеков для надёжного хранения. Данные вводятся вручную, автозаполнение — в разработке.",
        feat_2_title: "Подпись, которую нельзя подделать", feat_2_desc: "Ed25519 цифровая подпись на каждом чеке. Проверить подлинность может любой — за секунду, без регистрации.",
        feat_3_title: "Гарантия — бесплатным бонусом",
        feat_3_desc: "Раз чек уже хранится у нас, Valuon заодно сам считает сроки гарантии, предупреждает в кабинете за 30 дней до окончания и позволяет сохранить напоминание в календарь.",
        biz_title: "Valuon для бизнеса",
        biz_desc: "Цифровые чеки с криптографической защитой. Превратите обычные продажи в доверие покупателей.",
        biz_1_title: "Криптографические чеки",
        biz_1_desc: "Ed25519 цифровая подпись для каждого чека. Математически невозможно подделать без приватного ключа.",
        biz_2_title: "Защита от подделок",
        biz_2_desc: "QR код с подписью позволяет мгновенно проверить подлинность чека. Никаких сомнений у покупателей.",
        biz_3_title: "Верификация покупателей",
        biz_3_desc: "Автоматическая проверка зарегистрированных пользователей. Чеки сразу привязываются к их аккаунтам.",
        biz_4_title: "Аналитика продаж",
        biz_4_desc: "Статистика по выписанным чекам, отслеживание статусов и история всех транзакций.",
        biz_btn: "Открыть магазин",
        biz_subtext: "Бесплатно для первых 20 магазинов",
        ver_title: "Проверка чеков за секунду",
        ver_desc: "Не нужно устанавливать приложения. Просто откройте камеру в браузере и проверьте подлинность любого чека.",
        ver_1_title: "Сканируйте QR-код",
        ver_1_desc: "Наведите камеру на QR-код с чека. Работает прямо в браузере на телефоне и ПК.",
        ver_2_title: "Мгновенная проверка",
        ver_2_desc: "Криптографическая подпись Ed25519 подтверждает, что чек настоящий и данные не были изменены.",
        ver_3_title: "Без регистрации",
        ver_3_desc: "Не нужен аккаунт. Верификация доступна всем — и покупателям, и продавцам, и контролирующим органам.",
        ver_btn: "Проверить чек",
        proc_title: "Путь чека — от кассы до вашего кабинета",
        proc_1_title: "Чек выпускается",
        proc_1_desc: "Магазин оформляет цифровой чек на ваш email или номер телефона — с подписью Ed25519, подделать его или незаметно изменить данные невозможно.",
        proc_2_title: "Чек появляется в кабинете", proc_2_desc: "Если вы зарегистрированы в Valuon с этим email или телефоном, чек сам попадает в личный кабинет — без сканирования QR и лишних действий.",
        proc_3_title: "Гарантия отслеживается сама", proc_3_desc: "Срок гарантии считается автоматически, а чек хранится в профиле — ничего не нужно запоминать или считать вручную.",
        vision_title: "Единая система электронных чеков — что дальше?",
        vision_desc: "Единая платформа, где каждый чек подписан цифровой подписью, а гарантия отслеживается автоматически. Сейчас — работающий MVP. Дальше — международные рынки, интеграция с кассами и доверие между покупателем и магазином.",
        vision_btn: "Читать Roadmap", footer_tagline: "Цифровые чеки, которым можно доверять.",
        footer_prod: "Продукт", footer_biz: "Для бизнеса",
        footer_comp: "Компания", footer_about: "О нас", footer_privacy: "Политика конфиденциальности", footer_terms: "Условия пользования", footer_social: "Соцсети",
        footer_copyright: "© 2026 Valuon. Все права защищены."
    },
    en: {
        page_title: "Valuon — Home",
        nav_features: "Features", nav_business: "For Business", nav_how: "How it works", nav_mission: "Mission", nav_login: "Login", nav_dashboard: "Dashboard", nav_verify: "Verify Receipt",
        hero_title: 'A unified system <br>for digital receipts',
        hero_desc: "Every receipt is cryptographically signed and verifiable in seconds. Impossible to forge, impossible to lose.",

        hero_btn_start: "Get Started Free",
        hero_btn_dashboard: "Go to Dashboard",
        hero_btn_login: "Sign In",
        hero_btn_verify: "Verify Receipt",
        hero_subtext_social: "We're just getting started — your feedback will shape what Valuon becomes",
        demo_qr_verified: "Receipt is authentic",
        demo_processing: "Verifying signature...",
        demo_signature_verified: "Ed25519 signature confirmed",
        demo_store: "TechStore Tallinn",
        demo_item1: "MacBook Air M2",
        demo_item2: "Magic Cover",
        demo_item3: "AppleCare+",
        demo_total_label: "Total:",
        demo_loader_scan: "Scanning QR…",
        demo_loader_check: "Checking signature…",
        demo_loader_result: "Generating result…",
        float_receipt: "Receipt saved", float_instant: "In one second",
        feat_title: "Everything you need <br>for your digital receipts",
        feat_desc: "We removed the chaos from receipt storage and verification, keeping only what truly matters.",
        feat_1_title: "Cloud Receipt Archive", feat_1_desc: "Upload receipt photos for secure storage. Data entry is manual; auto-fill is coming soon.",
        feat_2_title: "A signature that can't be forged", feat_2_desc: "Ed25519 digital signature on every receipt. Anyone can verify authenticity — in seconds, without registration.",
        feat_3_title: "Warranty, as a free bonus",
        feat_3_desc: "Since your receipt is already stored with us, Valuon automatically calculates warranty periods, alerts you in your dashboard starting 30 days before expiry, and lets you export a calendar reminder.",
        biz_title: "Valuon for Business",
        biz_desc: "Digital receipts with cryptographic protection. Turn ordinary sales into customer trust.",
        biz_1_title: "Cryptographic Receipts",
        biz_1_desc: "Ed25519 digital signature for every receipt. Mathematically impossible to forge without the private key.",
        biz_2_title: "Forgery Protection",
        biz_2_desc: "QR code with signature allows instant receipt verification. No doubts for customers.",
        biz_3_title: "Customer Verification",
        biz_3_desc: "Automatic verification of registered users. Receipts are immediately linked to their accounts.",
        biz_4_title: "Sales Analytics",
        biz_4_desc: "Statistics on issued receipts, status tracking and full transaction history.",
        biz_btn: "Open Shop",
        biz_subtext: "Free for first 20 shops",
        ver_title: "Verify Receipts in Seconds",
        ver_desc: "No app required. Just open your browser camera and check any receipt's authenticity instantly.",
        ver_1_title: "Scan the QR Code",
        ver_1_desc: "Point your camera at any receipt QR code. Works right in the browser on phone and desktop.",
        ver_2_title: "Instant Verification",
        ver_2_desc: "Ed25519 cryptographic signature confirms the receipt is authentic and data hasn't been tampered with.",
        ver_3_title: "No Registration Needed",
        ver_3_desc: "No account required. Verification is available to everyone — buyers, sellers, and auditors alike.",
        ver_btn: "Verify Receipt",
        proc_title: "The life of a receipt — from checkout to your account",
        proc_1_title: "Receipt is issued",
        proc_1_desc: "The store issues a digital receipt to your email or phone number — signed with Ed25519, so it can't be forged or quietly altered.",
        proc_2_title: "It lands in your account", proc_2_desc: "If you're registered with Valuon under that email or phone, the receipt appears in your account automatically — no QR scanning, no extra steps.",
        proc_3_title: "Warranty tracks itself", proc_3_desc: "The warranty period is calculated automatically and the receipt stays in your profile — nothing to remember or track by hand.",
        vision_title: "A unified system for digital receipts — what's next?",
        vision_desc: "A unified platform where every receipt is cryptographically signed and every warranty is tracked automatically. Today — a working MVP. Next — international markets, POS integrations, and trust between buyers and stores.",
        vision_btn: "Read Roadmap", footer_tagline: "Digital receipts you can trust.",
        footer_prod: "Product", footer_biz: "For Business",
        footer_comp: "Company", footer_about: "About Us", footer_privacy: "Privacy Policy", footer_terms: "Terms of Use", footer_social: "Socials",
        footer_copyright: "© 2026 Valuon. All rights reserved."
    }
};

let currentLang = localStorage.getItem('valuon-lang') === 'en' ? 'en' : 'ru';
let qrDemoLoader = null;

function getDict(lang) {
    return translations[lang] || translations.ru;
}

function getDemoLoaderPhrases() {
    const t = getDict(currentLang);
    return [t.demo_loader_scan, t.demo_loader_check, t.demo_loader_result];
}

function applyTranslations() {
    const t = getDict(currentLang);
    document.documentElement.lang = currentLang === 'en' ? 'en' : 'ru';
    document.title = t.page_title;
    const htmlKeys = ['hero_title', 'feat_title'];

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) {
            if (htmlKeys.includes(key)) {
                el.innerHTML = t[key];
            } else {
                el.textContent = t[key];
            }
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (t[key]) el.placeholder = t[key];
    });

    const langToggle = document.getElementById('lang-toggle');
    if (langToggle) {
        langToggle.textContent = currentLang.toUpperCase();
        langToggle.title = currentLang === 'ru'
            ? 'Текущий язык: Русский (нажмите для EN)'
            : 'Current language: English (click for RU)';
    }

    if (qrDemoLoader) qrDemoLoader.setPhrases(getDemoLoaderPhrases());
}

const qrDemoEl = document.getElementById('qr-demo-loader');
if (qrDemoEl && typeof RotatingTextLoader !== 'undefined') {
    qrDemoLoader = new RotatingTextLoader(qrDemoEl, getDemoLoaderPhrases(), { autoRotate: false });
}

window.applyIndexTranslations = applyTranslations;
applyTranslations();

const langToggle = document.getElementById('lang-toggle');
if (langToggle) {
    langToggle.addEventListener('click', () => {
        currentLang = currentLang === 'ru' ? 'en' : 'ru';
        localStorage.setItem('valuon-lang', currentLang);
        applyTranslations();
    });
}

window.addEventListener('storage', (e) => {
    if (e.key === 'valuon-lang') {
        currentLang = e.newValue === 'en' ? 'en' : 'ru';
        applyTranslations();
    }
});

// Mobile navigation, smooth anchor scroll & navbar scroll state (independent of Supabase CDN)
(function initLandingNav() {
    let scrollPos = 0;
    const mobileMenu = document.getElementById('mobile-menu');
    const navList = document.querySelector('.nav-list');
    const navbar = document.querySelector('.navbar');

    function unlockScroll(restorePosition = true) {
        const root = document.documentElement;
        if (!root.classList.contains('scroll-locked')) return;
        root.classList.remove('scroll-locked');
        if (restorePosition) window.scrollTo(0, scrollPos);
    }

    function closeMobileNav(restorePosition = true) {
        if (!navList?.classList.contains('active')) return;
        navList.classList.remove('active');
        navbar?.classList.remove('nav-open');
        mobileMenu?.classList.remove('is-active');
        unlockScroll(restorePosition);
    }

    if (mobileMenu && navList) {
        mobileMenu.addEventListener('click', () => {
            const willOpen = !navList.classList.contains('active');
            navList.classList.toggle('active', willOpen);
            mobileMenu.classList.toggle('is-active', willOpen);
            navbar?.classList.toggle('nav-open', willOpen);
            if (willOpen) {
                scrollPos = window.scrollY;
                document.documentElement.classList.add('scroll-locked');
            } else {
                unlockScroll(true);
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (!navList?.classList.contains('active')) return;
        if (navList.contains(e.target) || mobileMenu?.contains(e.target)) return;
        closeMobileNav(true);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navList?.classList.contains('active')) {
            closeMobileNav(true);
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768 && navList?.classList.contains('active')) {
            closeMobileNav(false);
        }
    }, { passive: true });

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            closeMobileNav(false);

            const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const targetId = this.getAttribute('href');
            if (targetId === '#') {
                window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
                return;
            }

            const target = document.querySelector(targetId);
            if (target) {
                window.scrollTo({ top: target.offsetTop - 80, behavior: reduced ? 'auto' : 'smooth' });
            }
        });
    });

    if (navbar) {
        const updateNavbarScrollState = () => {
            navbar.classList.toggle('scrolled', window.scrollY > 12);
        };
        updateNavbarScrollState();
        window.addEventListener('scroll', updateNavbarScrollState, { passive: true });
    }
})();
