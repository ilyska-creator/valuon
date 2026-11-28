import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/+esm';

export const SUPABASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL)
    || 'https://qjnzawjivqvgupbgxdao.supabase.co';
export const SUPABASE_ANON_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY)
    || 'sb_publishable_AwSiUBE-lYKiQAvA_T5ryw_2r_JOOH8';

const SESSION_ONLY_KEY = 'valuon-session-only';

export function setSessionOnly(enabled) {
    try {
        if (enabled) {
            sessionStorage.setItem(SESSION_ONLY_KEY, '1');
        } else {
            sessionStorage.removeItem(SESSION_ONLY_KEY);
        }
    } catch (_) { /* storage unavailable */ }
}

function pickFresherAuthValue(a, b) {
    if (a === null) return b;
    if (b === null) return a;
    try {
        const pa = JSON.parse(a);
        const pb = JSON.parse(b);
        const ea = Number(pa?.expires_at || 0);
        const eb = Number(pb?.expires_at || 0);
        if (ea && eb && ea !== eb) return ea > eb ? a : b;
    } catch (_) { /* non-JSON storage key */ }
    return a;
}

const adaptiveStorage = {
    getItem(key) {
        try {
            const sessionVal = sessionStorage.getItem(key);
            const localVal = localStorage.getItem(key);
            if (sessionStorage.getItem(SESSION_ONLY_KEY) === '1') {
                return pickFresherAuthValue(sessionVal, localVal);
            }
            return pickFresherAuthValue(localVal, sessionVal);
        } catch (_) {
            return null;
        }
    },
    setItem(key, value) {
        try {
            if (sessionStorage.getItem(SESSION_ONLY_KEY) === '1') {
                sessionStorage.setItem(key, value);
                localStorage.removeItem(key);
            } else {
                localStorage.setItem(key, value);
                sessionStorage.removeItem(key);
            }
        } catch (_) { /* quota or security error */ }
    },
    removeItem(key) {
        try { localStorage.removeItem(key); } catch (_) { /* ignore */ }
        try { sessionStorage.removeItem(key); } catch (_) { /* ignore */ }
    },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: adaptiveStorage,
        autoRefreshToken: true,
        persistSession: true,
    },
});
