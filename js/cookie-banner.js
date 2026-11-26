(function() {
    var toggleSelector = '#lang-toggle, #lang-toggle-business, #settings-lang-toggle';

    function updateBannerText() {
        var l = window.getValuonLang ? window.getValuonLang() : (localStorage.getItem('valuon-lang') || 'en');
        var text = document.getElementById('cookie-text');
        var btn = document.getElementById('cookie-btn');
        if (!text || !btn) return;
        if (l === 'ru') {
            text.innerHTML = 'Мы используем cookies для работы сайта. Продолжая использовать сайт, вы соглашаетесь с <a href="privacy.html">Политикой конфиденциальности</a>.';
            btn.textContent = 'Принять';
        } else {
            text.innerHTML = 'We use cookies to operate the site. By continuing, you agree to our <a href="privacy.html">Privacy Policy</a>.';
            btn.textContent = 'Accept';
        }
    }

    updateBannerText();

    document.addEventListener('click', function(e) {
        if (e.target.closest(toggleSelector) && !localStorage.getItem('cookie-consent'))
            setTimeout(updateBannerText, 50);
    });

    ['lang-changed', 'verify-lang-changed', 'business-lang-changed'].forEach(function(evt) {
        window.addEventListener(evt, updateBannerText);
    });

    if (!localStorage.getItem('cookie-consent')) {
        setTimeout(function() {
            var banner = document.getElementById('cookie-banner');
            if (banner) banner.classList.add('show');
        }, 800);
    }
})();
