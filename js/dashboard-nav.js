document.addEventListener('DOMContentLoaded', () => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const sidebarNav = document.querySelector('.sidebar-nav');
    const sidebarIndicator = document.querySelector('.sidebar-nav-indicator');
    const bottomNav = document.querySelector('.bottom-nav');
    const bottomIndicator = document.querySelector('.bottom-nav-indicator');
    const sidebarLinks = document.querySelectorAll('.sidebar-nav .nav-item[data-view]');
    const bottomLinks = document.querySelectorAll('.bottom-nav-item[data-view]');
    const views = document.querySelectorAll('.dashboard-view');

    function updateSidebarIndicator(instant = false) {
        if (!sidebarIndicator || !sidebarNav) return;
        const activeLink = sidebarNav.querySelector('.nav-item.active');
        if (!activeLink || sidebarNav.offsetHeight === 0) {
            sidebarIndicator.classList.remove('is-ready');
            return;
        }
        const indHeight = sidebarIndicator.offsetHeight || 20;
        const y = Math.round(activeLink.offsetTop + (activeLink.offsetHeight - indHeight) / 2);
        const shouldInstant = instant || !sidebarIndicator.classList.contains('is-ready');
        if (shouldInstant) sidebarIndicator.classList.add('no-transition');
        sidebarIndicator.style.transform = `translate3d(0, ${y}px, 0)`;
        sidebarIndicator.classList.add('is-ready');
        if (shouldInstant) {
            void sidebarIndicator.offsetHeight;
            sidebarIndicator.classList.remove('no-transition');
        }
    }

    function updateBottomIndicator(instant = false) {
        if (!bottomIndicator || !bottomNav) return;
        const activeLink = bottomNav.querySelector('.bottom-nav-item.active');
        if (!activeLink || bottomNav.offsetWidth === 0) {
            bottomIndicator.classList.remove('is-ready');
            return;
        }
        const inset = 4;
        const x = Math.round(activeLink.offsetLeft + inset);
        const w = Math.max(0, Math.round(activeLink.offsetWidth - inset * 2));
        const shouldInstant = instant || !bottomIndicator.classList.contains('is-ready');
        if (shouldInstant) bottomIndicator.classList.add('no-transition');
        bottomIndicator.style.width = `${w}px`;
        bottomIndicator.style.transform = `translate3d(${x}px, 0, 0)`;
        bottomIndicator.classList.add('is-ready');
        if (shouldInstant) {
            void bottomIndicator.offsetWidth;
            bottomIndicator.classList.remove('no-transition');
        }
    }

    function syncIndicators(instant = false) {
        updateSidebarIndicator(instant);
        updateBottomIndicator(instant);
    }

    function isDashboardView(id) {
        if (!id) return false;
        const el = document.getElementById(id);
        return Boolean(el && el.classList.contains('dashboard-view'));
    }

    function activateView(targetId, { instant = false } = {}) {
        if (!isDashboardView(targetId)) return;

        sidebarLinks.forEach(l => l.classList.remove('active'));
        bottomLinks.forEach(l => l.classList.remove('active'));

        views.forEach(view => view.classList.remove('active'));

        const sidebarLink = document.querySelector(`.sidebar-nav .nav-item[href="#${targetId}"]`);
        if (sidebarLink) sidebarLink.classList.add('active');

        const bottomLink = document.querySelector(`.bottom-nav-item[href="#${targetId}"]`);
        if (bottomLink) bottomLink.classList.add('active');

        syncIndicators(instant);

        const view = document.getElementById(targetId);
        if (view) {
            view.classList.add('active');
            if (targetId === 'view-settings' || targetId === 'view-receipts') {
                requestAnimationFrame(() => {
                    view.querySelectorAll('[data-animate]').forEach(el => el.classList.add('is-visible'));
                });
            }
            window.dispatchEvent(new CustomEvent('dashboard-view-changed', { detail: { viewId: targetId } }));
        }
    }

    function handleNavClick(e, link, { isBottom = false } = {}) {
        e.preventDefault();

        const targetId = link.getAttribute('href').replace('#', '');
        if (!isDashboardView(targetId)) return;
        if (isBottom && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            try { navigator.vibrate(8); } catch (_) {}
        }
        activateView(targetId);
        sessionStorage.setItem('dashboard-view', targetId);
        if (window.location.hash !== '#' + targetId) {
            history.pushState(null, '', '#' + targetId);
        }

        window.scrollTo({ top: 0, behavior: 'instant' });
    }

    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => handleNavClick(e, link));
    });

    bottomLinks.forEach(link => {
        link.addEventListener('click', (e) => handleNavClick(e, link, { isBottom: true }));
    });

    window.addEventListener('popstate', () => {
        const hash = window.location.hash.replace('#', '') || 'view-items';
        if (isDashboardView(hash)) {
            activateView(hash);
            sessionStorage.setItem('dashboard-view', hash);
        }
    });

    const targetView = sessionStorage.getItem('dashboard-view');
    const hash = window.__targetView || window.location.hash.replace('#', '') || targetView;
    if (isDashboardView(hash)) {
        activateView(hash, { instant: true });
        sessionStorage.setItem('dashboard-view', hash);
        if (window.location.hash !== '#' + hash) {
            history.replaceState(null, '', '#' + hash);
        }
        window.scrollTo({ top: 0, behavior: 'instant' });
        requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        window.addEventListener('load', () => {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }, { once: true });
    }

    requestAnimationFrame(() => syncIndicators(true));
    window.addEventListener('resize', () => syncIndicators(true));
    window.addEventListener('orientationchange', () => setTimeout(() => syncIndicators(true), 80));
    if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => syncIndicators(true));
        if (sidebarNav) ro.observe(sidebarNav);
        if (bottomNav) ro.observe(bottomNav);
    }

    // Sidebar profile mini-menu popover
    const profileTrigger = document.getElementById('sidebar-profile-trigger');
    const profileMenu = document.getElementById('sidebar-profile-menu');
    const profileSettingsBtn = document.getElementById('sidebar-menu-settings');

    function setProfileMenuOpen(open) {
        if (!profileTrigger || !profileMenu) return;
        profileMenu.classList.toggle('is-open', open);
        profileTrigger.classList.toggle('is-open', open);
        profileTrigger.setAttribute('aria-expanded', String(open));
        profileMenu.setAttribute('aria-hidden', String(!open));
    }

    if (profileTrigger && profileMenu) {
        profileTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            setProfileMenuOpen(!profileMenu.classList.contains('is-open'));
        });

        profileSettingsBtn?.addEventListener('click', () => {
            setProfileMenuOpen(false);
            activateView('view-settings');
            sessionStorage.setItem('dashboard-view', 'view-settings');
            if (window.location.hash !== '#view-settings') {
                history.pushState(null, '', '#view-settings');
            }
            window.scrollTo({ top: 0, behavior: 'instant' });
        });

        document.addEventListener('click', (e) => {
            if (!profileMenu.classList.contains('is-open')) return;
            if (!profileMenu.contains(e.target) && !profileTrigger.contains(e.target)) {
                setProfileMenuOpen(false);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && profileMenu.classList.contains('is-open')) {
                setProfileMenuOpen(false);
                profileTrigger.focus();
            }
        });
    }

    const syncSidebarThemePill = () => {
        const pill = document.getElementById('sidebar-theme-pill');
        if (!pill) return;
        const lang = window.getValuonLang ? window.getValuonLang() : 'en';
        const dict = window.dashboardTranslations?.[lang] || {};
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        pill.textContent = isDark
            ? (dict.ui_theme_dark || (lang === 'en' ? 'Dark' : 'Тёмная'))
            : (dict.ui_theme_light || (lang === 'en' ? 'Light' : 'Светлая'));
    };
    syncSidebarThemePill();
    window.addEventListener('themeChange', syncSidebarThemePill);
});
