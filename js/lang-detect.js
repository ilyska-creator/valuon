// Valuon language detection: RU for Russian-locale devices, EN for everything else.
// Manual selection in localStorage ('valuon-lang') always overrides device locale.
(function () {
    function detectDefaultLang() {
        try {
            var raw = (navigator.languages && navigator.languages[0]) || navigator.language || '';
            return String(raw).toLowerCase().startsWith('ru') ? 'ru' : 'en';
        } catch (_) {
            return 'en';
        }
    }

    function getValuonLang() {
        try {
            var saved = localStorage.getItem('valuon-lang');
            if (saved === 'ru' || saved === 'en') return saved;
        } catch (_) {
            // ignore storage access errors
        }
        return detectDefaultLang();
    }

    window.getValuonLang = getValuonLang;

    try {
        document.documentElement.lang = getValuonLang();
    } catch (_) {
        // ignore
    }
})();
