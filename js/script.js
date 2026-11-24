import { getAuthSession } from './dashboard-auth.js';

// Переводы, applyTranslations(), лоадер QR-демо и переключатель языка
// переехали в js/index-lang.js (обычный, не module, скрипт). Причина:
// этот файл — type="module" и импортирует Supabase SDK с CDN строкой
// выше, а модуль не выполняет ни строчки кода, пока этот импорт не
// разрешится. Из-за этого перевод текста ждал сетевого запроса к CDN, и
// пользователь видел мигание — сначала русский текст из HTML, потом
// подмену на английский. index-lang.js ничего не импортирует и
// выполняется сразу, поэтому мигания больше нет.

document.addEventListener('DOMContentLoaded', () => {
    let scrollPos = 0;

    function toggleScrollLock() {
        const root = document.documentElement;
        if (root.classList.contains('scroll-locked')) {
            unlockScroll();
        } else {
            scrollPos = window.scrollY;
            root.classList.add('scroll-locked');
        }
    }

    function unlockScroll(restorePosition = true) {
        const root = document.documentElement;
        if (!root.classList.contains('scroll-locked')) return;
        root.classList.remove('scroll-locked');
        if (restorePosition) window.scrollTo(0, scrollPos);
    }

    const mobileMenu = document.getElementById('mobile-menu');
    const navList = document.querySelector('.nav-list');

    const navbar = document.querySelector('.navbar');

    if (mobileMenu) {
        mobileMenu.addEventListener('click', () => {
            navList.classList.toggle('active');
            mobileMenu.classList.toggle('is-active');
            navbar?.classList.toggle('nav-open');
            toggleScrollLock();
        });
    }

    document.addEventListener('click', (e) => {
        if (!navList?.classList.contains('active')) return;
        if (navList.contains(e.target) || mobileMenu?.contains(e.target)) return;
        navList.classList.remove('active');
        navbar?.classList.remove('nav-open');
        mobileMenu?.classList.remove('is-active');
        unlockScroll();
    });

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            if (navList) {
                navList.classList.remove('active');
                navbar?.classList.remove('nav-open');
                mobileMenu?.classList.remove('is-active');
                unlockScroll(false);
            }

            const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const targetId = this.getAttribute('href');
            if (targetId === '#') {
                window.scrollTo({
                    top: 0,
                    behavior: reduced ? 'auto' : 'smooth'
                });
                return;
            }

            const target = document.querySelector(targetId);
            if (target) {
                window.scrollTo({
                    top: target.offsetTop - 80,
                    behavior: reduced ? 'auto' : 'smooth'
                });
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
});

async function checkAuthOnHome() {
    const { session } = await getAuthSession();

    if (session) {
        const lang = localStorage.getItem('valuon-lang') || 'ru';
        const isEn = lang === 'en';

        document.querySelectorAll('.nav-list a[href="login.html"], .nav-list a[href="register.html"]').forEach(link => {
            link.href = 'dashboard.html';
            link.setAttribute('data-i18n', 'nav_dashboard');
            link.textContent = isEn ? 'Dashboard' : 'В кабинет';
        });

        document.querySelectorAll('.hero-actions a[href="register.html"]').forEach(link => {
            link.href = 'dashboard.html';
            const labelEl = link.querySelector('[data-i18n]') || link;
            labelEl.setAttribute('data-i18n', 'hero_btn_dashboard');
            labelEl.textContent = isEn ? 'Go to Dashboard' : 'Перейти в кабинет';
        });

        document.querySelectorAll('.hero-actions a[href="login.html"]').forEach(link => {
            link.hidden = true;
            link.style.display = 'none';
        });

        if (typeof window.applyIndexTranslations === 'function') {
            window.applyIndexTranslations();
        }
    }
}

if (document.querySelector('.hero-actions')) {
    checkAuthOnHome().catch(e => console.warn('checkAuthOnHome failed:', e));
}
