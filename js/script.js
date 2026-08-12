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

    function unlockScroll() {
        document.documentElement.classList.remove('scroll-locked');
        window.scrollTo(0, scrollPos);
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
                unlockScroll();
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
        // Обновляем ВСЕ ссылки на логин/регистрацию (и в навбаре, и в hero),
        // а не только первое совпадение — иначе большая кнопка в hero
        // остаётся href="login.html" и гоняет залогиненного через страницу
        // логина (которая сама редиректит на дашборд).
        const heroAction = document.querySelector('.hero-actions');
        const links = heroAction
            ? document.querySelectorAll('.hero-actions a[href="login.html"], .hero-actions a[href="register.html"], .nav-list a[href="login.html"], .nav-list a[href="register.html"]')
            : document.querySelectorAll('a[href="login.html"], a[href="register.html"]');
        links.forEach(link => { link.href = 'dashboard.html'; });
    }
}

if (document.querySelector('.hero-actions')) {
    checkAuthOnHome().catch(e => console.warn('checkAuthOnHome failed:', e));
}
