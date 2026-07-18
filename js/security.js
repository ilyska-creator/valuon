const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 10;
const LOGIN_TIMEOUT_MS = 15 * 60 * 1000; 


export function checkLoginRateLimit(identifier) {
    const key = identifier.toLowerCase().trim();
    const now = Date.now();

    const attempts = loginAttempts.get(key) || [];
    const recentAttempts = attempts.filter(t => now - t < LOGIN_TIMEOUT_MS);

    loginAttempts.set(key, recentAttempts);

    if (recentAttempts.length >= MAX_LOGIN_ATTEMPTS) {
        const oldestAttempt = Math.min(...recentAttempts);
        const resetTime = new Date(oldestAttempt + LOGIN_TIMEOUT_MS);
        const minutes = Math.ceil((resetTime - now) / 60000);

        return {
            allowed: false,
            remainingAttempts: 0,
            resetIn: `${minutes} мин`
        };
    }

    recentAttempts.push(now);
    loginAttempts.set(key, recentAttempts);

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

    const attempts = signupAttempts.get(key) || [];
    const recentAttempts = attempts.filter(t => now - t < SIGNUP_TIMEOUT_MS);

    signupAttempts.set(key, recentAttempts);

    if (recentAttempts.length >= MAX_SIGNUP_ATTEMPTS) {
        return { allowed: false };
    }

    recentAttempts.push(now);
    signupAttempts.set(key, recentAttempts);

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
