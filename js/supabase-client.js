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

const adaptiveStorage = {
    getItem(key) {
        try {
            const localVal = localStorage.getItem(key);
            if (localVal !== null) return localVal;

            const sessionVal = sessionStorage.getItem(key);
            if (sessionVal !== null && key !== SESSION_ONLY_KEY) {
                sessionStorage.setItem(SESSION_ONLY_KEY, '1');
            }
            return sessionVal;
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
