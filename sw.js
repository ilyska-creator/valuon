// Valuon Service Worker — Stage 1 (App Shell + Static Cache + Offline Fallback + Web Push)
const CACHE_VERSION = 'valuon-static-202611281833';
const OFFLINE_URL = '/offline.html';

// Public HTML routes safe to cache (normalized by pathname, never with query strings).
// Sensitive/auth/app routes (/dashboard, /receipts, /business, /reset-password, /verify, /login, /register) are never cached.
const CACHEABLE_NAV_PATHS = new Set([
    '/',
    '/index.html',
    '/about',
    '/about.html',
    '/privacy',
    '/privacy.html',
    '/terms',
    '/terms.html',
    '/roadmap',
    '/roadmap.html',
    '/offline.html',
]);

const PRECACHE_URLS = [
    OFFLINE_URL,
    '/index.html',
    '/manifest.webmanifest',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-512.png',
    '/assets/icons/apple-touch-icon.png',
    '/css/style.css',
    '/css/auth.css',
    '/css/verify.css',
    '/css/business.css',
    '/css/dashboard.css',
    '/css/toast.css',
    '/css/custom-select.css',
    '/css/custom-datepicker.css',
    '/js/lang-detect.js',
    '/js/theme.js',
    '/js/toast.js',
    '/js/pwa.js',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => Promise.allSettled(PRECACHE_URLS.map((u) => cache.add(u))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key.startsWith('valuon-') && key !== CACHE_VERSION)
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    } else if (event.data?.type === 'CLEAR_CACHES') {
        event.waitUntil(
            caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        );
    }
});

self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (_) {
        data = { title: 'Valuon', body: event.data ? event.data.text() : '' };
    }
    const title = data.title || 'Valuon';
    const options = {
        body: data.body || '',
        icon: '/assets/icons/icon-192.png',
        badge: '/assets/icons/icon-192.png',
        tag: data.tag || 'valuon-notification',
        data: { url: data.url || '/dashboard#view-notifications' },
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetPath = event.notification?.data?.url || '/dashboard#view-notifications';
    const targetUrl = new URL(targetPath, self.location.origin).href;

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                    client.navigate(targetUrl).catch(() => {});
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }
        })
    );
});

function isCacheableStaticAsset(url) {
    if (url.origin !== self.location.origin) return false;
    const p = url.pathname;
    if (p === '/sw.js') return false;
    return p.startsWith('/css/')
        || p.startsWith('/js/')
        || p.startsWith('/assets/')
        || p === '/manifest.webmanifest';
}

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Never intercept localhost/127.0.0.1 dev servers, Supabase, Vercel analytics, or sw.js
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return;
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith('/_vercel/')) return;
    if (url.pathname === '/sw.js') return;

    // HTML navigations: Network-First; cache only allowlisted public pages by pathname (no query strings)
    if (req.mode === 'navigate') {
        const canCacheNav = CACHEABLE_NAV_PATHS.has(url.pathname);
        const navCacheKey = url.pathname;
        event.respondWith(
            fetch(req)
                .then((res) => {
                    if (canCacheNav && res && res.ok && res.type === 'basic') {
                        const copy = res.clone();
                        caches.open(CACHE_VERSION).then((cache) => cache.put(navCacheKey, copy)).catch(() => {});
                    }
                    return res;
                })
                .catch(async () => {
                    if (canCacheNav) {
                        const cached = await caches.match(navCacheKey);
                        if (cached) return cached;
                    }
                    return (await caches.match(OFFLINE_URL)) || Response.error();
                })
        );
        return;
    }

    // Same-origin static assets: Network-First for JS/CSS (always fresh on deploy), Stale-While-Revalidate for images/icons
    if (isCacheableStaticAsset(url)) {
        const isCodeAsset = url.pathname.startsWith('/js/') || url.pathname.startsWith('/css/');
        if (isCodeAsset) {
            const cacheKey = url.pathname;
            event.respondWith(
                fetch(req, { cache: 'no-cache' })
                    .then((res) => {
                        if (res && res.ok && res.type === 'basic') {
                            const copy = res.clone();
                            caches.open(CACHE_VERSION).then((cache) => cache.put(cacheKey, copy)).catch(() => {});
                        }
                        return res;
                    })
                    .catch(async () => {
                        const cached = (await caches.match(cacheKey))
                            || (await caches.match(req, { ignoreSearch: true }));
                        return cached || Response.error();
                    })
            );
            return;
        }
        event.respondWith(
            caches.open(CACHE_VERSION).then(async (cache) => {
                const cached = await cache.match(req);
                const networkPromise = fetch(req)
                    .then((res) => {
                        if (res && res.ok && res.type === 'basic') {
                            cache.put(req, res.clone()).catch(() => {});
                        }
                        return res;
                    })
                    .catch(() => cached);
                return cached || networkPromise;
            })
        );
    }
});
