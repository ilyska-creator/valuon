import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://qjnzawjivqvgupbgxdao.supabase.co';
const supabaseKey = 'sb_publishable__b1k1cuhxQEBn50III2tkQ_0DOOqe3V';
const supabase = createClient(supabaseUrl, supabaseKey);

const translations = {
    ru: {
        page_title: "Valuon — Главная",
        nav_features: "Возможности", nav_how: "Как это работает", nav_mission: "Миссия", nav_login: "Вход",
        hero_badge: "🚀 Этап 1: Бета-версия уже доступна",
        hero_title: 'Гарантия больше не <br><span class="highlight">бумажка в ящике</span>',
        hero_desc: "Первая в мире платформа, которая объединяет чеки, серийные номера и инструкции в единый цифровой профиль для каждой вашей вещи.",
        form_placeholder: "Ваш email",
        hero_btn_start: "Начать бесплатно",
        hero_btn_login: "Войти в аккаунт",
        hero_subtext_social: "🔥 Присоединись к 150+ ранним пользователям",
        card_status: "Активна", card_days_left: "Осталось дней", card_manual: "Инструкция", card_service: "Сервис",
        float_receipt: "Чек сохранен", float_reminder: "Напоминание",
        feat_title: "Все инструменты защиты <br>ваших покупок",
        feat_desc: "Мы убрали хаос из гарантийного обслуживания, оставив только то, что действительно важно.",
        feat_1_title: "Облачный архив чеков", feat_1_desc: "Загружайте фото или PDF чеков. Наша система распознает данные и привяжет их к товару автоматически.",
        feat_2_title: "Живой таймер гарантии", feat_2_desc: 'Больше никаких "куплено вроде год назад". Точный расчет сроков с учетом законодательства страны.',
        feat_3_title: "Библиотека инструкций", feat_3_desc: "Доступ к официальным мануалам в один клик. Поиск по ключевым словам внутри документов.",
        proc_title: "Путь от покупки до спокойствия",
        proc_1_title: "Сканирование", proc_1_desc: "Наведите камеру на чек или введите серийный номер устройства вручную.",
        proc_2_title: "Верификация", proc_2_desc: "Система определяет модель, срок гарантии и добавляет товар в ваш личный кабинет.",
        proc_3_title: "Мониторинг", proc_3_desc: "Получайте уведомления об окончании срока и находите сервисы рядом в случае поломки.",
        vision_title: "Строим мировую инфраструктуру доверия",
        vision_desc: "Наша цель — создать единый стандарт цифрового владения. В будущем Valuon станет обязательным элементом для любой крупной покупки, обеспечивая прозрачность между покупателем, магазином и производителем.",
        vision_btn: "Читать Roadmap", footer_tagline: "Управляйте гарантиями умнее.",
        footer_prod: "Продукт", footer_sec: "Безопасность", footer_biz: "Для бизнеса",
        footer_comp: "Компания", footer_about: "О нас", footer_career: "Карьера", footer_contact: "Контакты", footer_social: "Соцсети",
        footer_copyright: "© 2026 Valuon Inc. Все права защищены.",
        msg_success: "Спасибо! Вы в списке ожидания.",
        msg_duplicate: "Этот email уже зарегистрирован.",
        msg_error: "Ошибка. Попробуйте позже."
    },
    en: {
        page_title: "Valuon — Home",
        nav_features: "Features", nav_how: "How it works", nav_mission: "Mission", nav_login: "Login",
        hero_badge: " Phase 1: Beta is live",
        hero_title: 'Warranty is no longer <br><span class="highlight">paper in a drawer</span>',
        hero_desc: "The world's first platform unifying receipts, serial numbers, and manuals into a single digital profile for every item you own.",
        form_placeholder: "Your email",
        hero_btn_start: "Get Started Free",
        hero_btn_login: "Sign In",
        hero_subtext_social: "🔥 Join 150+ early adopters",
        card_status: "Active", card_days_left: "Days left", card_manual: "Manual", card_service: "Service",
        float_receipt: "Receipt saved", float_reminder: "Reminder",
        feat_title: "All protection tools <br>for your purchases",
        feat_desc: "We removed the chaos from warranty service, keeping only what truly matters.",
        feat_1_title: "Cloud Receipt Archive", feat_1_desc: "Upload photos or PDFs of receipts. Our system recognizes data and links it to products automatically.",
        feat_2_title: "Live Warranty Timer", feat_2_desc: 'No more "bought like a year ago". Precise deadline calculation based on local laws.',
        feat_3_title: "Manual Library", feat_3_desc: "Access official manuals in one click. Keyword search inside documents.",
        proc_title: "From purchase to peace of mind",
        proc_1_title: "Scanning", proc_1_desc: "Point camera at receipt or enter device serial number manually.",
        proc_2_title: "Verification", proc_2_desc: "System identifies model, warranty period and adds item to your dashboard.",
        proc_3_title: "Monitoring", proc_3_desc: "Get notifications before expiry and find nearby service centers if broken.",
        vision_title: "Building global trust infrastructure",
        vision_desc: "Our goal is to create a unified standard of digital ownership. In the future, Valuon will be essential for any major purchase, ensuring transparency between buyer, store, and manufacturer.",
        vision_btn: "Read Roadmap", footer_tagline: "Manage warranties smarter.",
        footer_prod: "Product", footer_sec: "Security", footer_biz: "For Business",
        footer_comp: "Company", footer_about: "About Us", footer_career: "Careers", footer_contact: "Contact", footer_social: "Socials",
        footer_copyright: "© 2026 Valuon Inc. All rights reserved.",
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
        if (translations[currentLang][key]) el.innerHTML = translations[currentLang][key];
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
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, { threshold: 0.1 });

    revealElements.forEach(el => revealObserver.observe(el));

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

        if (startBtn) {
            startBtn.href = 'dashboard.html';
            startBtn.textContent = 'Мой кабинет';
        }
        if (loginBtn) {
            loginBtn.href = 'dashboard.html';
            loginBtn.textContent = 'Кабинет';
        }
    }
}

if (document.querySelector('.hero-actions')) {
    checkAuthOnHome();
}