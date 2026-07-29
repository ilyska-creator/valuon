(function() {
    var toggleSelector = document.getElementById('lang-toggle-business')
        ? '#lang-toggle, #lang-toggle-business'
        : '#lang-toggle';

    function updateBannerText() {
        var l = localStorage.getItem('valuon-lang');
        var text = document.getElementById('cookie-text');
        var btn = document.getElementById('cookie-btn');
        if (!text || !btn) return;
        if (l === 'en') {
            text.innerHTML = 'We use cookies to operate the site. By continuing, you agree to our <a href="privacy.html">Privacy Policy</a>.';
            btn.textContent = 'Accept';
        } else {
            text.innerHTML = 'Мы используем cookies для работы сайта. Продолжая использовать сайт, вы соглашаетесь с <a href="privacy.html">Политикой конфиденциальности</a>.';
            btn.textContent = 'Принять';
        }
    }

    updateBannerText();

    document.addEventListener('click', function(e) {
        if (e.target.closest(toggleSelector) && !localStorage.getItem('cookie-consent'))
            setTimeout(updateBannerText, 50);
    });

    if (!localStorage.getItem('cookie-consent')) {
        setTimeout(function() {
            var banner = document.getElementById('cookie-banner');
            if (banner) banner.classList.add('show');
        }, 800);
    }
})();
