import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-client.js';
import { logError } from './security.js';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export async function getAuthSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return { session, client: supabase };
}

let logoutBound = false;
let isExplicitLogout = false;

function hasStoredRefreshToken() {
    try {
        const re = /^sb-[a-z0-9-]+-auth-token$/i;
        for (const st of [localStorage, sessionStorage]) {
            for (let i = 0; i < st.length; i++) {
                const k = st.key(i);
                if (!k || !re.test(k)) continue;
                const parsed = JSON.parse(st.getItem(k) || 'null');
                if (parsed && parsed.refresh_token) return true;
            }
        }
    } catch (_) {}
    return false;
}

export function setupLogout(currentClient) {
    if (logoutBound) return;
    logoutBound = true;
    document.querySelectorAll('#logout-btn, #logout-btn-mobile').forEach(btn => {
        btn.addEventListener('click', async () => {
            isExplicitLogout = true;
            const clientToSignOut = currentClient || supabase;
            try {
                await clientToSignOut.auth.signOut({ scope: 'local' });
            } catch (err) {
                logError('auth:logout', err);
            } finally {
                localStorage.removeItem('valuon-remember-email');
                localStorage.removeItem('valuon-remember-login');
                sessionStorage.clear();
                window.location.href = 'index.html';
            }
        });
    });
}

let authListenerBound = false;

export async function requireAuth() {
    let { session, client } = await getAuthSession();

    // If session is temporarily null on wake-up / flaky network but a refresh token exists, retry once before redirecting
    if (!session && hasStoredRefreshToken()) {
        await new Promise((r) => setTimeout(r, 450));
        try {
            const { data } = await client.auth.refreshSession();
            session = data?.session || (await client.auth.getSession()).data?.session || null;
        } catch (_) {
            session = (await client.auth.getSession()).data?.session || null;
        }
    }

    if (!session) {
        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
        const oauthErr = searchParams.get('error') || hashParams.get('error');
        if (oauthErr) {
            window.location.href = `login.html?oauth_error=${encodeURIComponent(oauthErr)}`;
            return null;
        }
        const hash = window.location.hash || (window.__targetView ? `#${window.__targetView}` : '');
        const target = `${window.location.pathname}${window.location.search}${hash}`;
        const loginUrl = (target && target !== '/' && !target.startsWith('/login'))
            ? `login.html?redirect=${encodeURIComponent(target)}`
            : 'login.html';
        window.location.href = loginUrl;
        return null;
    }
    if (!authListenerBound) {
        authListenerBound = true;
        client.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT') {
                if (isExplicitLogout) return;
                // Re-check after a short grace window in case another tab just rotated the refresh token
                setTimeout(async () => {
                    if (isExplicitLogout) return;
                    try {
                        const { data } = await client.auth.getSession();
                        if (data?.session) return;
                    } catch (_) {}
                    window.location.href = 'login.html';
                }, 350);
            }
        });
    }
    return { user: session.user, client };
}