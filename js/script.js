import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL)
    || 'https://qjnzawjivqvgupbgxdao.supabase.co';
const supabaseKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY)
    || 'sb_publishable_AwSiUBE-lYKiQAvA_T5ryw_2r_JOOH8';
const supabase = createClient(supabaseUrl, supabaseKey);

const translations = {
    ru: {
        page_title: "Valuon — Главная",
        nav_features: "Возможности", nav_business: "Для бизнеса", nav_how: "Как это работает", nav_mission: "Миссия", nav_login: "Вход", nav_verify: "Проверить чек",
        hero_badge: "Альфа доступ открыт",
        hero_title: 'Гарантия больше не <br><span class="highlight">бумажка в ящике</span>',
        hero_desc: "Цифровой профиль для каждой покупки. Храните чеки, отслеживайте гарантии и никогда не теряйте право на бесплатный ремонт.",

        hero_btn_start: "Начать бесплатно",
        hero_btn_login: "Войти в аккаунт",
        hero_btn_verify: "Проверить чек",
        hero_subtext_social: "Мы только начинаем — ваш голос повлияет на то, каким Valuon станет",
        card_status: "Активна", demo_days_left: "Осталось 285 дней",

        float_receipt: "Чек сохранен", float_reminder: "Напоминание",
        feat_title: "Все инструменты защиты <br>ваших покупок",
        feat_desc: "Мы убрали хаос из гарантийного обслуживания, оставив только то, что действительно важно.",
        feat_1_title: "Облачный архив чеков", feat_1_desc: "Загружайте фото чеков для надёжного хранения. Данные вводятся вручную, автозаполнение — в разработке.",
        feat_2_title: "Живой таймер гарантии", feat_2_desc: "Точный расчёт сроков с учётом даты покупки и условий производителя. Больше никаких «вроде год назад».",
        feat_3_title: "Умные напоминания",
        feat_3_desc: "Получайте уведомления за 30, 7 и 1 день до окончания гарантии. Не упускайте возможность бесплатного ремонта.",
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
        proc_title: "Путь от покупки до спокойствия",
        proc_1_title: "Добавление товаров",
        proc_1_desc: "Добавьте покупку вручную: название, дата, срок гарантии. Прикрепите фото чека для подтверждения.",
        proc_2_title: "Расчёт", proc_2_desc: "Система рассчитывает точную дату окончания гарантии и добавляет товар в ваш личный кабинет.",
        proc_3_title: "Мониторинг", proc_3_desc: "Получайте уведомления об окончании срока и контролируйте статус всех ваших покупок в одном месте.",
        vision_title: "Единая система электронных чеков — что дальше?",
        vision_desc: "Единая платформа, где каждый чек подписан цифровой подписью, а гарантия отслеживается автоматически. Сейчас — работающий MVP. Дальше — международные рынки, интеграция с кассами и доверие между покупателем и магазином.",
        vision_btn: "Читать Roadmap", footer_tagline: "Управляйте гарантиями умнее.",
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
        hero_title: 'Warranty is no longer <br><span class="highlight">paper in a drawer</span>',
        hero_desc: "A digital profile for every purchase. Store receipts, track warranties and never lose your right to free repair.",

        hero_btn_start: "Get Started Free",
        hero_btn_login: "Sign In",
        hero_btn_verify: "Verify Receipt",
        hero_subtext_social: "We're just getting started — your feedback will shape what Valuon becomes",
        card_status: "Active", demo_days_left: "285 days left",
        float_receipt: "Receipt saved", float_reminder: "Reminder",
        feat_title: "All protection tools <br>for your purchases",
        feat_desc: "We removed the chaos from warranty service, keeping only what truly matters.",
        feat_1_title: "Cloud Receipt Archive", feat_1_desc: "Upload receipt photos for secure storage. Data entry is manual; auto-fill is coming soon.",
        feat_2_title: "Live Warranty Timer", feat_2_desc: "Precise expiry calculation based on purchase date and manufacturer terms. No more guessing.",
        feat_3_title: "Smart Reminders",
        feat_3_desc: "Get notified 30, 7 and 1 day before warranty expiry. Never miss a free repair opportunity.",
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
        proc_title: "From purchase to peace of mind",
        proc_1_title: "Add Items",
        proc_1_desc: "Enter purchase details manually: name, date, warranty period. Attach a receipt photo for proof.",
        proc_2_title: "Calculation", proc_2_desc: "The system calculates the exact warranty expiry date and adds the item to your dashboard.",
        proc_3_title: "Monitoring", proc_3_desc: "Receive expiry notifications and track the status of all your purchases in one place.",
        vision_title: "A unified system for digital receipts — what's next?",
        vision_desc: "A unified platform where every receipt is cryptographically signed and every warranty is tracked automatically. Today — a working MVP. Next — international markets, POS integrations, and trust between buyers and stores.",
        vision_btn: "Read Roadmap", footer_tagline: "Manage warranties smarter.",
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