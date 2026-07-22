import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-client.js';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const translations = {
    ru: {
        page_title: "Valuon — Главная",
        nav_features: "Возможности", nav_business: "Для бизнеса", nav_how: "Как это работает", nav_mission: "Миссия", nav_login: "Вход", nav_verify: "Проверить чек",
        hero_badge: "Альфа доступ открыт",
        hero_title: 'Единая система <br>электронных чеков',
        hero_desc: "Каждый чек подписан криптографически и проверяется за секунду. Подделать — невозможно, потерять — тоже.",

        hero_btn_start: "Начать бесплатно",
        hero_btn_login: "Войти в аккаунт",
        hero_btn_verify: "Проверить чек",
        hero_subtext_social: "Мы только начинаем — ваш голос повлияет на то, каким Valuon станет",
        demo_qr_verified: "Чек подлинный",
        demo_processing: "Проверяем подпись...",
        demo_signature_verified: "Подпись Ed25519 подтверждена",
        demo_store: "TechStore Tallinn · €284.50",
        demo_item1: "MacBook Air M2",
        demo_item2: "Magic Cover",
        demo_item3: "AppleCare+",
        demo_total_label: "Итого:",

        float_receipt: "Чек сохранен", float_instant: "За секунду",
        feat_title: "Всё, что нужно <br>для ваших электронных чеков",
        feat_desc: "Мы убрали хаос из хранения и проверки чеков, оставив только то, что действительно важно.",
        feat_1_title: "Облачный архив чеков", feat_1_desc: "Загружайте фото чеков для надёжного хранения. Данные вводятся вручную, автозаполнение — в разработке.",
        feat_2_title: "Подпись, которую нельзя подделать", feat_2_desc: "Ed25519 цифровая подпись на каждом чеке. Проверить подлинность может любой — за секунду, без регистрации.",
        feat_3_title: "Гарантия — бесплатным бонусом",
        feat_3_desc: "Раз чек уже хранится у нас, Valuon заодно сам считает сроки гарантии и напоминает за 30, 7 и 1 день до окончания.",
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
        biz_subtext: "Бесплатно для первых 100 магазинов",
        ver_title: "Проверка чеков за секунду",
        ver_desc: "Не нужно устанавливать приложения. Просто откройте камеру в браузере и проверьте подлинность любого чека.",
        ver_1_title: "Сканируйте QR-код",
        ver_1_desc: "Наведите камеру на QR-код с чека. Работает прямо в браузере на телефоне и ПК.",
        ver_2_title: "Мгновенная проверка",
        ver_2_desc: "Криптографическая подпись Ed25519 подтверждает, что чек настоящий и данные не были изменены.",
        ver_3_title: "Без регистрации",
        ver_3_desc: "Не нужен аккаунт. Верификация доступна всем — и покупателям, и продавцам, и контролирующим органам.",
        ver_btn: "Проверить чек",
        proc_title: "Путь электронного чека — от покупки до проверки",
        proc_1_title: "Чек выпускается",
        proc_1_desc: "Магазин или вы сами оформляете чек: товар, сумма, дата покупки. Можно прикрепить фото — для наглядности.",
        proc_2_title: "Чек подписывается", proc_2_desc: "Ed25519 подпись закрепляется за каждым чеком. Подделать его или незаметно изменить данные становится математически невозможно.",
        proc_3_title: "Чек проверяется", proc_3_desc: "Сканируйте QR — и через секунду видно, что чек подлинный. Гарантия при этом отслеживается сама, без напоминаний вручную.",
        vision_title: "Единая система электронных чеков — что дальше?",
        vision_desc: "Единая платформа, где каждый чек подписан цифровой подписью, а гарантия отслеживается автоматически. Сейчас — работающий MVP. Дальше — международные рынки, интеграция с кассами и доверие между покупателем и магазином.",
        vision_btn: "Читать Roadmap", footer_tagline: "Цифровые чеки, которым можно доверять.",
        footer_prod: "Продукт", footer_sec: "Безопасность", footer_biz: "Для бизнеса",
        footer_comp: "Компания", footer_about: "О нас", footer_career: "Карьера", footer_contact: "Контакты", footer_privacy: "Политика конфиденциальности", footer_terms: "Условия пользования", footer_social: "Соцсети",
        footer_copyright: "© 2026 Valuon. Все права защищены.",
        msg_success: "Спасибо! Вы в списке ожидания.",
        msg_duplicate: "Этот email уже зарегистрирован.",
        msg_error: "Ошибка. Попробуйте позже."
    },
    en: {
        page_title: "Valuon — Home",
        nav_features: "Features", nav_business: "For Business", nav_how: "How it works", nav_mission: "Mission", nav_login: "Login", nav_verify: "Verify Receipt",
        hero_badge: "Alpha Access Open",
        hero_title: 'A unified system <br>for digital receipts',
        hero_desc: "Every receipt is cryptographically signed and verifiable in seconds. Impossible to forge, impossible to lose.",

        hero_btn_start: "Get Started Free",
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
        float_receipt: "Receipt saved", float_instant: "In one second",
        feat_title: "Everything you need <br>for your digital receipts",
        feat_desc: "We removed the chaos from receipt storage and verification, keeping only what truly matters.",
        feat_1_title: "Cloud Receipt Archive", feat_1_desc: "Upload receipt photos for secure storage. Data entry is manual; auto-fill is coming soon.",
        feat_2_title: "A signature that can't be forged", feat_2_desc: "Ed25519 digital signature on every receipt. Anyone can verify authenticity — in seconds, without registration.",
        feat_3_title: "Warranty, as a free bonus",
        feat_3_desc: "Since your receipt is already stored with us, Valuon automatically calculates warranty periods and reminds you 30, 7 and 1 day before expiry.",
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
        biz_subtext: "Free for first 100 shops",
        ver_title: "Verify Receipts in Seconds",
        ver_desc: "No app required. Just open your browser camera and check any receipt's authenticity instantly.",
        ver_1_title: "Scan the QR Code",
        ver_1_desc: "Point your camera at any receipt QR code. Works right in the browser on phone and desktop.",
        ver_2_title: "Instant Verification",
        ver_2_desc: "Ed25519 cryptographic signature confirms the receipt is authentic and data hasn't been tampered with.",
        ver_3_title: "No Registration Needed",
        ver_3_desc: "No account required. Verification is available to everyone — buyers, sellers, and auditors alike.",
        ver_btn: "Verify Receipt",
        proc_title: "The life of a digital receipt — from purchase to proof",
        proc_1_title: "Receipt issued",
        proc_1_desc: "A store or you enter the purchase: item, amount, date. Attach a photo if you like — it's optional.",
        proc_2_title: "Receipt signed", proc_2_desc: "An Ed25519 signature locks in every receipt. Forging it or quietly changing the data becomes mathematically impossible.",
        proc_3_title: "Receipt verified", proc_3_desc: "Scan the QR code and see instantly that it's genuine. Warranty tracking happens automatically in the background.",
        vision_title: "A unified system for digital receipts — what's next?",
        vision_desc: "A unified platform where every receipt is cryptographically signed and every warranty is tracked automatically. Today — a working MVP. Next — international markets, POS integrations, and trust between buyers and stores.",
        vision_btn: "Read Roadmap", footer_tagline: "Digital receipts you can trust.",
        footer_prod: "Product", footer_sec: "Security", footer_biz: "For Business",
        footer_comp: "Company", footer_about: "About Us", footer_career: "Careers", footer_contact: "Contact", footer_privacy: "Privacy Policy", footer_terms: "Terms of Use", footer_social: "Socials",
        footer_copyright: "© 2026 Valuon. All rights reserved.",
        msg_success: "Thank you! You're on the waiting list.",
        msg_duplicate: "This email is already registered.",
        msg_error: "Error. Please try again later."
    }
};

let currentLang = localStorage.getItem('valuon-lang') || 'ru';

function sanitizeHTML(str) {
    return str
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, 'href="#"');
}

function applyTranslations() {
    document.title = translations[currentLang].page_title;

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLang][key]) {
            el.innerHTML = sanitizeHTML(translations[currentLang][key]);
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[currentLang][key]) el.placeholder = translations[currentLang][key];
    });

    const langToggle = document.getElementById('lang-toggle');
    if (langToggle) langToggle.textContent = currentLang.toUpperCase();
}

document.addEventListener('DOMContentLoaded', () => {
    applyTranslations();

    const mobileMenu = document.getElementById('mobile-menu');
    const navList = document.querySelector('.nav-list');

    const navbar = document.querySelector('.navbar');

    if (mobileMenu) {
        mobileMenu.addEventListener('click', () => {
            navList.classList.toggle('active');
            mobileMenu.classList.toggle('is-active');
            navbar?.classList.toggle('nav-open');
        });
    }

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            if (navList) {
                navList.classList.remove('active');
                navbar?.classList.remove('nav-open');
            }

            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const target = document.querySelector(targetId);
            if (target) {
                window.scrollTo({
                    top: target.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });

    const revealElements = document.querySelectorAll('.reveal');
    if (revealElements.length) {
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                }
            });
        }, { threshold: 0.1 });

        revealElements.forEach(el => revealObserver.observe(el));
    }


    if (navbar) {
        const updateNavbarScrollState = () => {
            navbar.classList.toggle('scrolled', window.scrollY > 12);
        };
        updateNavbarScrollState();
        window.addEventListener('scroll', updateNavbarScrollState, { passive: true });
    }



    const langToggle = document.getElementById('lang-toggle');
    if (langToggle) {
        langToggle.addEventListener('click', () => {
            currentLang = currentLang === 'ru' ? 'en' : 'ru';
            localStorage.setItem('valuon-lang', currentLang);
            applyTranslations();
        });
    }
});

async function checkAuthOnHome() {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        const startBtn = document.querySelector('a[href="register.html"]');
        const loginBtn = document.querySelector('a[href="login.html"]');
        const t = translations[currentLang] || translations.ru;

        if (startBtn) {
            startBtn.href = 'dashboard.html';
            startBtn.innerHTML = '<span>' + t.hero_btn_start + '</span> <i class="fa-solid fa-arrow-right"></i>';
        }
        if (loginBtn) {
            loginBtn.href = 'dashboard.html';
            loginBtn.innerHTML = t.hero_btn_login;
        }
    }
}

if (document.querySelector('.hero-actions')) {
    checkAuthOnHome().catch(e => console.warn('checkAuthOnHome failed:', e));
}