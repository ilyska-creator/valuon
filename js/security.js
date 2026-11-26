const LOGIN_RL_STORAGE_KEY = 'valuon-rl-login';
const SIGNUP_RL_STORAGE_KEY = 'valuon-rl-signup';
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 10;
const LOGIN_TIMEOUT_MS = 15 * 60 * 1000;

function readRateLimitBucket(storageKey, fallbackMap, key, windowMs) {
    const now = Date.now();
    try {
        const raw = localStorage.getItem(storageKey);
        const parsed = raw ? JSON.parse(raw) : {};
        const list = Array.isArray(parsed?.[key]) ? parsed[key] : [];
        return list.filter(t => typeof t === 'number' && now - t < windowMs);
    } catch (_) {
        const list = fallbackMap.get(key) || [];
        return list.filter(t => now - t < windowMs);
    }
}

function writeRateLimitBucket(storageKey, fallbackMap, key, list, windowMs) {
    fallbackMap.set(key, list);
    try {
        const now = Date.now();
        const raw = localStorage.getItem(storageKey);
        const parsed = raw ? JSON.parse(raw) : {};
        const next = {};
        Object.keys(parsed || {}).forEach((k) => {
            const cleaned = Array.isArray(parsed[k]) ? parsed[k].filter(t => typeof t === 'number' && now - t < windowMs) : [];
            if (cleaned.length > 0) next[k] = cleaned;
        });
        if (list.length > 0) next[key] = list;
        else delete next[key];
        localStorage.setItem(storageKey, JSON.stringify(next));
    } catch (_) { /* storage unavailable */ }
}

export function resetLoginRateLimit(identifier) {
    if (!identifier) return;
    const key = String(identifier).toLowerCase().trim();
    writeRateLimitBucket(LOGIN_RL_STORAGE_KEY, loginAttempts, key, [], LOGIN_TIMEOUT_MS);
}

export function checkLoginRateLimit(identifier, lang = 'ru') {
    const key = identifier.toLowerCase().trim();
    const now = Date.now();

    const recentAttempts = readRateLimitBucket(LOGIN_RL_STORAGE_KEY, loginAttempts, key, LOGIN_TIMEOUT_MS);

    if (recentAttempts.length >= MAX_LOGIN_ATTEMPTS) {
        writeRateLimitBucket(LOGIN_RL_STORAGE_KEY, loginAttempts, key, recentAttempts, LOGIN_TIMEOUT_MS);
        const oldestAttempt = Math.min(...recentAttempts);
        const resetTime = new Date(oldestAttempt + LOGIN_TIMEOUT_MS);
        const minutes = Math.ceil((resetTime - now) / 60000);

        return {
            allowed: false,
            remainingAttempts: 0,
            resetIn: `${minutes} ${lang === 'ru' ? 'мин' : 'min'}`
        };
    }

    recentAttempts.push(now);
    writeRateLimitBucket(LOGIN_RL_STORAGE_KEY, loginAttempts, key, recentAttempts, LOGIN_TIMEOUT_MS);

    return {
        allowed: true,
        remainingAttempts: MAX_LOGIN_ATTEMPTS - recentAttempts.length,
        resetIn: null
    };
}


const signupAttempts = new Map();
const MAX_SIGNUP_ATTEMPTS = 3;
const SIGNUP_TIMEOUT_MS = 60 * 60 * 1000;

export function checkSignupRateLimit(email) {
    const key = email.toLowerCase().trim();
    const now = Date.now();

    const recentAttempts = readRateLimitBucket(SIGNUP_RL_STORAGE_KEY, signupAttempts, key, SIGNUP_TIMEOUT_MS);

    if (recentAttempts.length >= MAX_SIGNUP_ATTEMPTS) {
        writeRateLimitBucket(SIGNUP_RL_STORAGE_KEY, signupAttempts, key, recentAttempts, SIGNUP_TIMEOUT_MS);
        return { allowed: false };
    }

    recentAttempts.push(now);
    writeRateLimitBucket(SIGNUP_RL_STORAGE_KEY, signupAttempts, key, recentAttempts, SIGNUP_TIMEOUT_MS);

    return { allowed: true };
}






export function setLoadingButton(button) {
    if (!button) return;
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
}


export function resetLoadingButton(button, originalHTML) {
    if (!button) return;
    button.disabled = false;
    button.innerHTML = originalHTML;
}





export function logError(context, error) {
    const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (isDev) {
        console.error(`[${context}]`, error);
    } else {
        const msg = error?.message || error;
        console.error(`[${context}] ${msg}`);
    }
}

export function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Selects the Russian plural form (one/few/many) for integer n.
 */
export function pluralRu(n, one, few, many) {
    const abs = Math.abs(Math.trunc(Number(n) || 0));
    const m10 = abs % 10;
    const m100 = abs % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
}

let cleanupInterval = null;

export function cleanupOldAttempts() {
    if (cleanupInterval) clearInterval(cleanupInterval);
    cleanupInterval = setInterval(() => {
        const now = Date.now();

        for (const [key, attempts] of loginAttempts.entries()) {
            const recent = attempts.filter(t => now - t < LOGIN_TIMEOUT_MS);
            if (recent.length === 0) {
                loginAttempts.delete(key);
            } else {
                loginAttempts.set(key, recent);
            }
        }

        for (const [key, attempts] of signupAttempts.entries()) {
            const recent = attempts.filter(t => now - t < SIGNUP_TIMEOUT_MS);
            if (recent.length === 0) {
                signupAttempts.delete(key);
            } else {
                signupAttempts.set(key, recent);
            }
        }
    }, 60 * 60 * 1000);
}

if (typeof window !== 'undefined') {
    window.addEventListener('load', cleanupOldAttempts);
    window.addEventListener('beforeunload', () => { if (cleanupInterval) clearInterval(cleanupInterval); });
}

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

function getTurnstileCopy() {
    const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
    const dict = (typeof window !== 'undefined' && window.authTranslations?.[lang]) || {};
    return {
        checking: dict.turnstile_checking || (lang === 'en' ? 'Verifying...' : 'Проверка...'),
        error: dict.turnstile_error || (lang === 'en'
            ? 'Verification failed to load. Disable ad blocker or retry'
            : 'Не удалось загрузить проверку. Отключите блокировщик или повторите'),
        retry: dict.turnstile_retry || (lang === 'en' ? 'Retry' : 'Повторить'),
    };
}

function reloadTurnstileScript() {
    if (typeof turnstile !== 'undefined') return Promise.resolve(true);

    document.querySelectorAll('script[src*="challenges.cloudflare.com/turnstile"]').forEach(s => s.remove());

    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = `${TURNSTILE_SCRIPT_URL}?retry=${Date.now()}`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
    });
}

function waitForTurnstileReady(timeoutMs = 6000) {
    return new Promise((resolve) => {
        if (typeof turnstile !== 'undefined') return resolve(true);

        let settled = false;
        const finish = (ok) => {
            if (settled) return;
            settled = true;
            clearInterval(checkTimer);
            clearTimeout(timeoutTimer);
            if (existingScript) existingScript.removeEventListener('error', onScriptError);
            resolve(ok);
        };

        const onScriptError = () => finish(false);
        const existingScript = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
        if (existingScript) {
            existingScript.addEventListener('error', onScriptError, { once: true });
        }

        const checkTimer = setInterval(() => {
            if (typeof turnstile !== 'undefined') finish(true);
        }, 50);

        const timeoutTimer = setTimeout(() => finish(false), timeoutMs);
    });
}

function setTurnstileSkeletonLoading(skeletonEl) {
    if (!skeletonEl) return;
    const copy = getTurnstileCopy();
    skeletonEl.classList.remove('loaded', 'is-error');
    skeletonEl.innerHTML = '';

    const pulse = document.createElement('span');
    pulse.className = 'skel-pulse';

    const label = document.createElement('span');
    label.setAttribute('data-i18n', 'turnstile_checking');
    label.textContent = copy.checking;

    skeletonEl.append(pulse, label);
}

function setTurnstileSkeletonError(skeletonEl, onRetry) {
    if (!skeletonEl) return;
    const copy = getTurnstileCopy();
    skeletonEl.classList.remove('loaded');
    skeletonEl.classList.add('is-error');
    skeletonEl.innerHTML = '';

    const msgWrap = document.createElement('div');
    msgWrap.className = 'turnstile-error-msg';

    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-circle-exclamation';
    icon.setAttribute('aria-hidden', 'true');

    const text = document.createElement('span');
    text.setAttribute('data-i18n', 'turnstile_error');
    text.textContent = copy.error;
    msgWrap.append(icon, text);

    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'turnstile-retry-btn';
    retryBtn.innerHTML = `<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> `;
    const retryLabel = document.createElement('span');
    retryLabel.setAttribute('data-i18n', 'turnstile_retry');
    retryLabel.textContent = copy.retry;
    retryBtn.appendChild(retryLabel);
    retryBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onRetry();
    });

    skeletonEl.append(msgWrap, retryBtn);
}

/**
 * Mounts a Cloudflare Turnstile widget with timeout/error handling and a retry button.
 */
export function mountTurnstile({ containerId, skeletonId, sitekey, theme = 'auto', timeoutMs = 6000, onRender, shouldRender, onAbort }) {
    const container = document.getElementById(containerId);
    const skeleton = skeletonId ? document.getElementById(skeletonId) : null;
    if (!container) return;

    let widgetId = null;

    const renderWidget = () => {
        if (typeof shouldRender === 'function' && !shouldRender()) {
            if (typeof onAbort === 'function') onAbort();
            return;
        }
        if (widgetId !== null && typeof turnstile !== 'undefined') {
            try { turnstile.remove(widgetId); } catch (_) { /* ignore */ }
            widgetId = null;
        }
        container.innerHTML = '';
        const resolvedTheme = theme === 'auto'
            ? (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light')
            : theme;
        const resolvedLang = ((window.getValuonLang ? window.getValuonLang() : 'en')) === 'en' ? 'en' : 'ru';
        widgetId = turnstile.render(`#${containerId}`, {
            sitekey,
            theme: resolvedTheme,
            language: resolvedLang,
            'error-callback': () => {
                setTurnstileSkeletonError(skeleton, retry);
            },
        });
        skeleton?.classList.remove('is-error');
        skeleton?.classList.add('loaded');
        if (typeof onRender === 'function') onRender(widgetId);
    };

    const attempt = async () => {
        const ready = await waitForTurnstileReady(timeoutMs);
        if (!ready) {
            setTurnstileSkeletonError(skeleton, retry);
            return;
        }
        renderWidget();
    };

    const retry = async () => {
        setTurnstileSkeletonLoading(skeleton);
        if (typeof turnstile === 'undefined') {
            const loaded = await reloadTurnstileScript();
            if (!loaded) {
                setTurnstileSkeletonError(skeleton, retry);
                return;
            }
        }
        await attempt();
    };

    attempt();
}
