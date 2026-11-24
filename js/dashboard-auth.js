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
            } finally {
                localStorage.removeItem('valuon-remember-email');
                localStorage.removeItem('valuon-remember-login');
                sessionStorage.clear();
                window.location.href = 'index.html';
            }
        });
    });
}

export async function requireAuth() {
    const { session, client } = await getAuthSession();
    if (!session) {
        window.location.href = 'login.html';
        return null;
    }
    return { user: session.user, client };
}