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
        feat_eyebrow: "Для покупателей",
        feat_title: "Всё, что нужно <br>для ваших покупок и чеков",
        feat_desc: "Работает уже сегодня с чеками из любых магазинов — и автоматически проверяет подлинность у магазинов-партнёров Valuon.",
        feat_1_title: "Личный сейф покупок и чеков",
        feat_1_desc: "Храните фото и PDF чеков из любых магазинов вместе с серийными номерами и ценами с быстрым поиском. Никаких выцветших бумажек.",
        feat_2_title: "Подтверждённые чеки от партнёров",
        feat_2_desc: "Если магазин работает с Valuon, чек сам прилетает в ваш кабинет по email или телефону с криптоподписью Ed25519, которую невозможно изменить.",
        feat_3_title: "Умный контроль гарантии",
        feat_3_desc: "Автоматический расчёт остатка дней, предупреждение в кабинете за 30 дней до окончания и экспорт напоминания в календарь в один клик.",
        biz_eyebrow: "Для бизнеса",
        biz_title: "Valuon для магазинов и продавцов",
        biz_desc: "Выписывайте защищённые цифровые чеки за секунды — для магазинов техники, шоурумов, мастерских и независимого ритейла.",
        biz_1_title: "Выписка чека за 15 секунд",
        biz_1_desc: "Позиции, НДС, скидки и гарантия по каждому товару. Отправка клиенту на email, телефон, в WhatsApp, Telegram или PDF с QR — без сложной интеграции кассы.",
        biz_2_title: "Подлинный чек, которому доверяют",
        biz_2_desc: "Криптоподпись Ed25519 и проверка по QR за секунду. Покупатель уверен в подлинности покупки, а ваш магазин выделяется прозрачностью и сервисом.",
        biz_3_title: "Умные возвраты и аннулирование",
        biz_3_desc: "Полный или частичный возврат по позициям и аннулирование в один клик. Статус чека мгновенно обновляется в реестре и по QR-ссылке — старый чек после возврата не выдать за действующий.",
        biz_4_title: "Аналитика, кассы и экспорт",
        biz_4_desc: "Выручка, средний чек, графики по периодам, несколько касс и полная выгрузка отчётов в Excel и CSV.",
        biz_btn: "Открыть магазин",
        biz_subtext: "Бесплатно для первых 20 магазинов",
        ver_eyebrow: "Верификация",
        ver_title: "Проверка чеков Valuon за секунду",
        ver_desc: "Не нужно устанавливать приложения. Откройте камеру в браузере, чтобы проверить подлинность чека, выпущенного в Valuon, и его актуальный статус.",
        ver_1_title: "Сканируйте QR-код Valuon",
        ver_1_desc: "Наведите камеру на QR-код с цифрового чека Valuon. Работает прямо в браузере на телефоне и ПК.",
        ver_2_title: "Подпись и живой статус",
        ver_2_desc: "Криптографическая подпись Ed25519 подтверждает подлинность чека и сразу показывает, активен он, возвращён или аннулирован.",
        ver_3_title: "Без регистрации",
        ver_3_desc: "Аккаунт не нужен. Проверка открыта для покупателей, магазинов и всех, кому нужно убедиться в подлинности чека.",
        ver_btn: "Проверить чек",
        ver_scope_note: "Проверка работает для цифровых чеков с QR-кодом Valuon — не для обычных бумажных чеков из неподключённых магазинов.",
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
        feat_eyebrow: "For Buyers",
        feat_title: "Everything you need <br>for your purchases and receipts",
        feat_desc: "Works right away for receipts from any store — and unlocks automatic verification at Valuon partner stores.",
        feat_1_title: "Personal Receipt Vault",
        feat_1_desc: "Store receipt photos and PDFs from any store alongside serial numbers and prices with instant search. No more faded paper.",
        feat_2_title: "Verified Partner Receipts",
        feat_2_desc: "When a store uses Valuon, your receipt arrives automatically by email or phone with an Ed25519 signature that cannot be altered.",
        feat_3_title: "Smart Warranty Tracking",
        feat_3_desc: "Automatic countdown of remaining warranty days, alerts in your dashboard 30 days before expiry, and one-click export to your calendar.",
        biz_eyebrow: "For Business",
        biz_title: "Valuon for Shops & Sellers",
        biz_desc: "Issue verified digital receipts in seconds — built for electronics stores, showrooms, repair shops, and independent retail.",
        biz_1_title: "Issue in 15 Seconds",
        biz_1_desc: "Line items, VAT, discounts, and per-item warranty. Send via email, phone, WhatsApp, Telegram, or PDF with QR — no complex POS integration needed.",
        biz_2_title: "Verified Receipts That Build Trust",
        biz_2_desc: "Ed25519 cryptographic signature and instant QR verification. Customers know their purchase is genuine, and your store stands out with transparent service.",
        biz_3_title: "Smart Refunds & Voiding",
        biz_3_desc: "Full or partial per-item refunds and one-click voiding. Receipt status updates live in the registry and on the QR page, so a refunded receipt cannot be reused.",
        biz_4_title: "Analytics, Registers & Export",
        biz_4_desc: "Revenue, average ticket, period charts, multiple POS registers, and full Excel/CSV export.",
        biz_btn: "Open Shop",
        biz_subtext: "Free for first 20 shops",
        ver_eyebrow: "Verification",
        ver_title: "Verify Valuon Receipts in Seconds",
        ver_desc: "No app required. Open your browser camera to verify any receipt issued through Valuon and check its live status.",
        ver_1_title: "Scan the Valuon QR",
        ver_1_desc: "Point your camera at the QR code on a Valuon receipt. Works right in the browser on phone and desktop.",
        ver_2_title: "Signature & Live Status",
        ver_2_desc: "Ed25519 signature confirms the receipt is authentic and shows in real time whether it is active, refunded, or voided.",
        ver_3_title: "No Registration Needed",
        ver_3_desc: "No account required. Verification is open to buyers, stores, and anyone checking a receipt.",
        ver_btn: "Verify Receipt",
        ver_scope_note: "Works for digital receipts issued with a Valuon QR code — not legacy paper receipts from unconnected stores.",
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

let currentLang = (window.getValuonLang ? window.getValuonLang() : 'en');
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

function hasLocalAuthSession() {
    try {
        const key = 'sb-qjnzawjivqvgupbgxdao-auth-token';
        const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        return Boolean(parsed && parsed.access_token);
    } catch (_) {
        return false;
    }
}

function setHomeAuthUI(isLoggedIn) {
    const navCta = document.querySelector('.nav-list .controls a.btn');
    if (navCta) {
        navCta.href = isLoggedIn ? 'dashboard.html' : 'login.html';
        navCta.setAttribute('data-i18n', isLoggedIn ? 'nav_dashboard' : 'nav_login');
    }

    const heroPrimary = document.querySelector('.hero-actions a.btn-primary');
    if (heroPrimary) {
        heroPrimary.href = isLoggedIn ? 'dashboard.html' : 'register.html';
        const labelEl = heroPrimary.querySelector('[data-i18n]') || heroPrimary;
        labelEl.setAttribute('data-i18n', isLoggedIn ? 'hero_btn_dashboard' : 'hero_btn_start');
    }

    document.querySelectorAll('.hero-actions a[href="login.html"]').forEach(link => {
        link.hidden = isLoggedIn;
        link.style.display = isLoggedIn ? 'none' : '';
    });

    applyTranslations();
}

window.applyIndexTranslations = applyTranslations;
window.setHomeAuthUI = setHomeAuthUI;
if (hasLocalAuthSession()) {
    setHomeAuthUI(true);
} else {
    applyTranslations();
}

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
