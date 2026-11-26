import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-client.js';
import { logError } from './security.js';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export async function getAuthSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return { session, client: supabase };
}

export function setupLogout(currentClient) {
    document.querySelectorAll('#logout-btn, #logout-btn-mobile').forEach(btn => {
        btn.addEventListener('click', async () => {
            const clientToSignOut = currentClient || supabase;
            try {
                await clientToSignOut.auth.signOut();
            } catch (err) {
                logError('auth:logout', err);
                await clientToSignOut.auth.signOut({ scope: 'local' }).catch(() => {});
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
    const { session, client } = await getAuthSession();
    if (!session) {
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
                window.location.href = 'login.html';
            }
        });
    }
    return { user: session.user, client };
}