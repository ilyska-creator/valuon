document.addEventListener('DOMContentLoaded', () => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const sidebarLinks = document.querySelectorAll('.sidebar-nav .nav-item[data-view]');
    const bottomLinks = document.querySelectorAll('.bottom-nav-item[data-view]');
    const views = document.querySelectorAll('.dashboard-view');

    function activateView(targetId) {
        sidebarLinks.forEach(l => l.classList.remove('active'));
        bottomLinks.forEach(l => l.classList.remove('active'));

        views.forEach(view => view.classList.remove('active'));

        const sidebarLink = document.querySelector(`.sidebar-nav .nav-item[href="#${targetId}"]`);
        if (sidebarLink) sidebarLink.classList.add('active');

        const bottomLink = document.querySelector(`.bottom-nav-item[href="#${targetId}"]`);
        if (bottomLink) bottomLink.classList.add('active');

        const view = document.getElementById(targetId);
        if (view) {
            view.classList.add('active');
            if (targetId === 'view-settings') {
                requestAnimationFrame(() => {
                    view.querySelectorAll('[data-animate]').forEach(el => el.classList.add('is-visible'));
                });
            }
        }
    }

    function handleNavClick(e, link) {
        e.preventDefault();

        const targetId = link.getAttribute('href').replace('#', '');
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
        link.addEventListener('click', (e) => handleNavClick(e, link));
    });

    window.addEventListener('popstate', () => {
        const hash = window.location.hash.replace('#', '') || 'view-items';
        if (document.getElementById(hash)) {
            activateView(hash);
            sessionStorage.setItem('dashboard-view', hash);
        }
    });

    const targetView = sessionStorage.getItem('dashboard-view');
    const hash = window.__targetView || window.location.hash.replace('#', '') || targetView;
    if (hash && document.getElementById(hash)) {
        activateView(hash);
        sessionStorage.setItem('dashboard-view', hash);
        if (window.location.hash !== '#' + hash) {
            history.replaceState(null, '', '#' + hash);
        }
        window.scrollTo(0, 0);
    }
});
