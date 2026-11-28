(function () {
    const savedTheme = localStorage.getItem('valuon-theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }

    function applyThemeDom(newTheme) {
        if (newTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
        try { localStorage.setItem('valuon-theme', newTheme); } catch (_) {}
        window.dispatchEvent(new CustomEvent('themeChange', { detail: { theme: newTheme } }));
    }

    window.toggleValuonTheme = function toggleValuonTheme(triggerEl) {
        const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (!document.startViewTransition || reduced) {
            applyThemeDom(newTheme);
            return newTheme;
        }

        let x = window.innerWidth / 2;
        let y = window.innerHeight / 2;
        if (triggerEl && typeof triggerEl.getBoundingClientRect === 'function') {
            const rect = triggerEl.getBoundingClientRect();
            x = rect.left + rect.width / 2;
            y = rect.top + rect.height / 2;
        }
        const endRadius = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y)
        );

        const transition = document.startViewTransition(() => {
            applyThemeDom(newTheme);
        });

        transition.ready.then(() => {
            document.documentElement.animate(
                {
                    clipPath: [
                        `circle(0px at ${x}px ${y}px)`,
                        `circle(${endRadius}px at ${x}px ${y}px)`
                    ]
                },
                {
                    duration: 420,
                    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                    pseudoElement: '::view-transition-new(root)'
                }
            );
        }).catch(() => {});

        return newTheme;
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');

    function syncThemeIcon(themeOverride) {
        const icon = themeToggle?.querySelector('i');
        if (!icon) return;

        const theme = themeOverride || document.documentElement.getAttribute('data-theme') || 'light';
        icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }

    if (themeToggle) {
        syncThemeIcon();

        themeToggle.addEventListener('click', (e) => {
            e.preventDefault();
            window.toggleValuonTheme(themeToggle);
        });
    }

    window.addEventListener('themeChange', () => {
        syncThemeIcon();
    });

    window.addEventListener('storage', (e) => {
        if (e.key === 'valuon-theme') {
            const newTheme = e.newValue || 'light';
            if (newTheme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
            } else {
                document.documentElement.removeAttribute('data-theme');
            }
            syncThemeIcon(newTheme);
            window.dispatchEvent(new CustomEvent('themeChange', { detail: { theme: newTheme } }));
        }
    });
});
