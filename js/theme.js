(function () {
    const savedTheme = localStorage.getItem('valuon-theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');

    if (themeToggle) {
        updateThemeIcon();

        themeToggle.addEventListener('click', (e) => {
            e.preventDefault(); 

            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('valuon-theme', newTheme);
            updateThemeIcon(newTheme);
        });
    }

    function updateThemeIcon(themeOverride) {
        const icon = themeToggle?.querySelector('i');
        if (!icon) return;

        const theme = themeOverride || document.documentElement.getAttribute('data-theme') || 'light';
        icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';

        window.dispatchEvent(new CustomEvent('themeChange'));
    }

    window.addEventListener('storage', (e) => {
        if (e.key === 'valuon-theme') {
            const newTheme = e.newValue || 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            updateThemeIcon(newTheme);
        }
    });
});