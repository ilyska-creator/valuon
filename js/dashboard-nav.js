document.addEventListener('DOMContentLoaded', () => {
    const sidebarLinks = document.querySelectorAll('.sidebar-nav .nav-item[data-view]');
    const bottomLinks = document.querySelectorAll('.bottom-nav-item[data-view]');
    const views = document.querySelectorAll('.dashboard-view');

    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    let scrollPosition = 0;

    function lockScroll() {
        scrollPosition = window.scrollY;
        document.body.classList.add('scroll-locked');
        document.body.style.top = `-${scrollPosition}px`;
    }

    function unlockScroll() {
        document.body.classList.remove('scroll-locked');
        document.body.style.top = '';
        window.scrollTo(0, scrollPosition);
    }

    function activateView(targetId) {
        sidebarLinks.forEach(l => l.classList.remove('active'));
        bottomLinks.forEach(l => l.classList.remove('active'));

        views.forEach(view => view.classList.remove('active'));

        const sidebarLink = document.querySelector(`.sidebar-nav .nav-item[href="#${targetId}"]`);
        if (sidebarLink) sidebarLink.classList.add('active');

        const bottomLink = document.querySelector(`.bottom-nav-item[href="#${targetId}"]`);
        if (bottomLink) bottomLink.classList.add('active');

        const view = document.getElementById(targetId);
        if (view) view.classList.add('active');
    }

    function handleNavClick(e, link) {
        e.preventDefault();

        const targetId = link.getAttribute('href').replace('#', '');
        activateView(targetId);

        if (window.innerWidth <= 900 && sidebar?.classList.contains('active')) {
            sidebar.classList.remove('active');
            overlay?.classList.remove('active');
            setTimeout(unlockScroll, 450);
        } else {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }
    }

    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => handleNavClick(e, link));
    });

    bottomLinks.forEach(link => {
        link.addEventListener('click', (e) => handleNavClick(e, link));
    });

    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(hash)) {
        activateView(hash);
    }

    if (document.body.classList.contains('scroll-locked')) {
        unlockScroll();
    }
});
