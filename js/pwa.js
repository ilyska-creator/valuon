// Valuon PWA registration & Install UI controller
(function () {
    let deferredInstallPrompt = null;

    function isStandalone() {
        return window.matchMedia('(display-mode: standalone)').matches
            || window.navigator.standalone === true;
    }

    function isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent)
            || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    function syncInstallUI() {
        const card = document.getElementById('pwa-install-card');
        if (!card) return;

        const installBtn = document.getElementById('pwa-install-btn');
        const iosHint = document.getElementById('pwa-ios-hint');
        const installedBadge = document.getElementById('pwa-installed-badge');

        if (isStandalone()) {
            card.classList.remove('hidden');
            installBtn?.classList.add('hidden');
            iosHint?.classList.add('hidden');
            installedBadge?.classList.remove('hidden');
            return;
        }

        installedBadge?.classList.add('hidden');

        if (deferredInstallPrompt) {
            card.classList.remove('hidden');
            installBtn?.classList.remove('hidden');
            iosHint?.classList.add('hidden');
        } else if (isIOS()) {
            card.classList.remove('hidden');
            installBtn?.classList.add('hidden');
            iosHint?.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        syncInstallUI();
    });

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        syncInstallUI();
        if (typeof window.showToast === 'function') {
            const isRu = ((window.getValuonLang ? window.getValuonLang() : 'en')) === 'ru';
            window.showToast(
                isRu ? 'Valuon установлен на устройство!' : 'Valuon installed on your device!',
                'success'
            );
        }
    });

    async function promptInstall() {
        if (!deferredInstallPrompt) return false;
        const promptEvent = deferredInstallPrompt;
        deferredInstallPrompt = null;
        promptEvent.prompt();
        const choice = await promptEvent.userChoice.catch(() => null);
        syncInstallUI();
        return choice?.outcome === 'accepted';
    }

    window.ValuonPWA = {
        isStandalone,
        isIOS,
        canInstall: () => Boolean(deferredInstallPrompt),
        promptInstall,
        syncInstallUI,
    };

    document.addEventListener('DOMContentLoaded', () => {
        const installBtn = document.getElementById('pwa-install-btn');
        if (installBtn) {
            installBtn.addEventListener('click', () => {
                promptInstall();
            });
        }
        syncInstallUI();
    });

    // Keep internal navigation strictly inside iOS/Android standalone PWA window
    // (avoids Vercel cleanUrls 308 redirects breaking out into Safari browser sheet)
    if (isStandalone()) {
        document.addEventListener('click', (e) => {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const link = e.target.closest?.('a[href]');
            if (!link) return;
            if (link.hasAttribute('download') || link.target === '_blank') return;

            const rawHref = link.getAttribute('href') || '';
            if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:') || rawHref.startsWith('javascript:')) {
                return;
            }

            let targetUrl;
            try {
                targetUrl = new URL(link.href, window.location.href);
            } catch (_) {
                return;
            }
            if (targetUrl.origin !== window.location.origin) return;

            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            if (!isLocal) {
                if (targetUrl.pathname === '/index.html') {
                    targetUrl.pathname = '/';
                } else if (targetUrl.pathname.endsWith('.html')) {
                    targetUrl.pathname = targetUrl.pathname.slice(0, -5);
                }
            }

            // Same-page hash navigation — let native scroll/router handle it
            if (targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search && targetUrl.hash) {
                return;
            }

            e.preventDefault();
            window.location.href = targetUrl.href;
        });
    }

    // Prefetch internal HTML pages on hover / touchstart for instant navigation
    (function initLinkPrefetch() {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (conn && (conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g')) {
            return;
        }
        const prefetched = new Set();

        function prefetchLink(link) {
            if (!link || prefetched.size >= 12) return;
            if (link.hasAttribute('download') || link.target === '_blank') return;
            const rawHref = link.getAttribute('href') || '';
            if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:') || rawHref.startsWith('javascript:')) {
                return;
            }
            let url;
            try {
                url = new URL(link.href, window.location.href);
            } catch (_) {
                return;
            }
            if (url.origin !== window.location.origin) return;
            if (url.pathname === window.location.pathname && url.search === window.location.search) return;

            const key = url.pathname + url.search;
            if (prefetched.has(key)) return;
            prefetched.add(key);

            const el = document.createElement('link');
            el.rel = 'prefetch';
            el.as = 'document';
            el.href = url.href;
            document.head.appendChild(el);
        }

        document.addEventListener('pointerover', (e) => {
            if (e.pointerType !== 'mouse') return;
            const link = e.target.closest?.('a[href]');
            if (link) prefetchLink(link);
        }, { passive: true });

        document.addEventListener('touchstart', (e) => {
            const link = e.target.closest?.('a[href]');
            if (link) prefetchLink(link);
        }, { passive: true });
    })();

    // Register Service Worker on HTTPS or localhost
    const isSecure = window.location.protocol === 'https:'
        || window.location.hostname === 'localhost'
        || window.location.hostname === '127.0.0.1';

    if ('serviceWorker' in navigator && isSecure) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
                // Ignore SW registration errors (e.g. private browsing restrictions)
            });
        });
    }
})();
