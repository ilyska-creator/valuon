import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL)
    || 'https://qjnzawjivqvgupbgxdao.supabase.co';
const supabaseKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY)
    || 'sb_publishable__b1k1cuhxQEBn50III2tkQ_0DOOqe3V';
const supabase = createClient(supabaseUrl, supabaseKey);

const translations = {
    ru: {
        page_title: "Valuon — Главная",
        nav_features: "Возможности", nav_how: "Как это работает", nav_mission: "Миссия", nav_login: "Вход",
        hero_badge: "Альфа доступ открыт",
        hero_title: 'Гарантия больше не <br><span class="highlight">бумажка в ящике</span>',
        hero_desc: "Цифровой профиль для каждой покупки. Храните чеки, отслеживайте гарантии и никогда не теряйте право на бесплатный ремонт.",
        form_placeholder: "Ваш email",
        hero_btn_start: "Начать бесплатно",
        hero_btn_login: "Войти в аккаунт",
        hero_subtext_social: "🔥 Присоединись к ранним пользователям",
        card_status: "Активна", demo_days_left: "Осталось 285 дней",
        card_manual: "Инструкция", card_service: "Сервис",
        float_receipt: "Чек сохранен", float_reminder: "Напоминание",
        feat_title: "Все инструменты защиты <br>ваших покупок",
        feat_desc: "Мы убрали хаос из гарантийного обслуживания, оставив только то, что действительно важно.",
        feat_1_title: "Облачный архив чеков", feat_1_desc: "Загружайте фото чеков для надёжного хранения. Данные вводятся вручную, автозаполнение — в разработке.",
        feat_2_title: "Живой таймер гарантии", feat_2_desc: "Точный расчёт сроков с учётом даты покупки и условий производителя. Больше никаких «вроде год назад».",
        feat_3_title: "Умные напоминания",
        feat_3_desc: "Получайте уведомления за 30, 7 и 1 день до окончания гарантии. Не упускайте возможность бесплатного ремонта.",
        proc_title: "Путь от покупки до спокойствия",
        proc_1_title: "Добавление товаров",
        proc_1_desc: "Добавьте покупку вручную: название, дата, срок гарантии. Прикрепите фото чека для подтверждения.",
        proc_2_title: "Расчёт", proc_2_desc: "Система рассчитывает точную дату окончания гарантии и добавляет товар в ваш личный кабинет.",
        proc_3_title: "Мониторинг", proc_3_desc: "Получайте уведомления об окончании срока и контролируйте статус всех ваших покупок в одном месте.",
        vision_title: "Строим мировую инфраструктуру доверия",
        vision_desc: "Наша цель — создать единый стандарт цифрового владения. В будущем Valuon станет обязательным элементом для любой крупной покупки, обеспечивая прозрачность между покупателем, магазином и производителем.",
        vision_btn: "Читать Roadmap", footer_tagline: "Управляйте гарантиями умнее.",
        footer_prod: "Продукт", footer_sec: "Безопасность", footer_biz: "Для бизнеса",
        footer_comp: "Компания", footer_about: "О нас", footer_career: "Карьера", footer_contact: "Контакты", footer_social: "Соцсети",
        footer_copyright: "© 2026 Valuon. Все права защищены.",
        msg_success: "Спасибо! Вы в списке ожидания.",
        msg_duplicate: "Этот email уже зарегистрирован.",
        msg_error: "Ошибка. Попробуйте позже."
    },
    en: {
        page_title: "Valuon — Home",
        nav_features: "Features", nav_how: "How it works", nav_mission: "Mission", nav_login: "Login",
        hero_badge: "Alpha Access Open",
        hero_title: 'Warranty is no longer <br><span class="highlight">paper in a drawer</span>',
        hero_desc: "A digital profile for every purchase. Store receipts, track warranties and never lose your right to free repair.",
        form_placeholder: "Your email",
        hero_btn_start: "Get Started Free",
        hero_btn_login: "Sign In",
        hero_subtext_social: "🔥 Join early adopters",
        card_status: "Active", demo_days_left: "285 days left", card_manual: "Manual", card_service: "Service",
        float_receipt: "Receipt saved", float_reminder: "Reminder",
        feat_title: "All protection tools <br>for your purchases",
        feat_desc: "We removed the chaos from warranty service, keeping only what truly matters.",
        feat_1_title: "Cloud Receipt Archive", feat_1_desc: "Upload receipt photos for secure storage. Data entry is manual; auto-fill is coming soon.",
        feat_2_title: "Live Warranty Timer", feat_2_desc: "Precise expiry calculation based on purchase date and manufacturer terms. No more guessing.",
        feat_3_title: "Smart Reminders",
        feat_3_desc: "Get notified 30, 7 and 1 day before warranty expiry. Never miss a free repair opportunity.",
        proc_title: "From purchase to peace of mind",
        proc_1_title: "Add Items",
        proc_1_desc: "Enter purchase details manually: name, date, warranty period. Attach a receipt photo for proof.",
        proc_2_title: "Calculation", proc_2_desc: "The system calculates the exact warranty expiry date and adds the item to your dashboard.",
        proc_3_title: "Monitoring", proc_3_desc: "Receive expiry notifications and track the status of all your purchases in one place.",
        vision_title: "Building global trust infrastructure",
        vision_desc: "Our goal is to create a unified standard of digital ownership. In the future, Valuon will be essential for any major purchase, ensuring transparency between buyer, store, and manufacturer.",
        vision_btn: "Read Roadmap", footer_tagline: "Manage warranties smarter.",
        footer_prod: "Product", footer_sec: "Security", footer_biz: "For Business",
        footer_comp: "Company", footer_about: "About Us", footer_career: "Careers", footer_contact: "Contact", footer_social: "Socials",
        footer_copyright: "© 2026 Valuon. All rights reserved.",
        msg_success: "Thanks! You are on the waitlist.",
        msg_duplicate: "This email is already registered.",
        msg_error: "Error. Please try again later."
    }
};

let currentLang = localStorage.getItem('valuon-lang') || 'ru';

function applyTranslations() {
    document.title = translations[currentLang].page_title;

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLang][key]) {
            // Для элементов с HTML структурой (hero_title содержит <br> и <span>)
            // используем innerHTML, но контент из переводов - это контролируемый HTML
            el.innerHTML = translations[currentLang][key];
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

    if (mobileMenu) {
        mobileMenu.addEventListener('click', () => {
            navList.classList.toggle('active');
            mobileMenu.classList.toggle('is-active');
        });
    }

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            if (navList) navList.classList.remove('active');

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

    // Subtle shadow/background bump on the fixed navbar once the page scrolls.
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        const updateNavbarScrollState = () => {
            navbar.classList.toggle('scrolled', window.scrollY > 12);
        };
        updateNavbarScrollState();
        window.addEventListener('scroll', updateNavbarScrollState, { passive: true });
    }

    const form = document.getElementById('waitlist-form');
    const messageEl = document.getElementById('form-message');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button');
            const input = form.querySelector('input');
            const originalText = btn.innerHTML;

            try {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

                const { error } = await supabase
                    .from('waitlist')
                    .insert([{ email: input.value.trim() }]);

                if (error) throw error;

                btn.innerHTML = '<i class="fa-solid fa-check"></i>';
                btn.style.background = '#10b981';
                input.value = '';

                if (messageEl) {
                    messageEl.textContent = translations[currentLang].msg_success;
                    messageEl.className = 'form-message success';
                    messageEl.style.display = 'block';
                    setTimeout(() => { messageEl.style.display = 'none'; }, 4000);
                }

            } catch (err) {
                console.error(err);
                if (err.code === '23505') {
                    if (messageEl) {
                        messageEl.textContent = translations[currentLang].msg_duplicate;
                        messageEl.className = 'form-message warning';
                        messageEl.style.display = 'block';
                    }
                } else {
                    if (messageEl) {
                        messageEl.textContent = translations[currentLang].msg_error;
                        messageEl.className = 'form-message error';
                        messageEl.style.display = 'block';
                    }
                }
            } finally {
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.style.background = '';
                    btn.disabled = false;
                }, 3000);
            }
        });
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
            startBtn.innerHTML = currentLang === 'ru' ? 'Мой кабинет' : 'My Dashboard';
        }
        if (loginBtn) {
            loginBtn.href = 'dashboard.html';
            loginBtn.innerHTML = currentLang === 'ru' ? 'Кабинет' : 'Dashboard';
        }
    }
}

if (document.querySelector('.hero-actions')) {
    checkAuthOnHome();
}