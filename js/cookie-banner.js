(function() {
    function hasConsent() {
        try { return Boolean(localStorage.getItem('cookie-consent')); } catch (_) { return false; }
    }

    if (hasConsent()) return;

    var toggleSelector = '#lang-toggle, #lang-toggle-business, #settings-lang-toggle';

    function ensureBanner() {
        var banner = document.getElementById('cookie-banner');
        if (banner) return banner;

        banner = document.createElement('div');
        banner.id = 'cookie-banner';
        banner.className = 'cookie-banner';

        var text = document.createElement('p');
        text.id = 'cookie-text';

        var btn = document.createElement('button');
        btn.id = 'cookie-btn';
        btn.type = 'button';
        btn.className = 'btn btn-primary small';
        btn.addEventListener('click', function() {
            banner.classList.remove('show');
            try { localStorage.setItem('cookie-consent', '1'); } catch (_) {}
            setTimeout(function() {
                if (banner.parentNode) banner.parentNode.removeChild(banner);
            }, 400);
        });

        banner.appendChild(text);
        banner.appendChild(btn);
        document.body.appendChild(banner);
        return banner;
    }

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

    function init() {
        var banner = ensureBanner();
        updateBannerText();

        document.addEventListener('click', function(e) {
            if (e.target.closest(toggleSelector) && !hasConsent()) {
                setTimeout(updateBannerText, 50);
            }
        });

        ['lang-changed', 'verify-lang-changed', 'business-lang-changed'].forEach(function(evt) {
            window.addEventListener(evt, updateBannerText);
        });

        setTimeout(function() {
            if (!hasConsent() && banner) {
                banner.classList.add('show');
            }
        }, 800);
    }

    if (document.body) {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    }
})();
