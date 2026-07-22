import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-client.js';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export async function getAuthSession() {
    let client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storage: localStorage } });
    let { data: { session } } = await client.auth.getSession();

    if (!session) {
        client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storage: sessionStorage } });
        ({ data: { session } } = await client.auth.getSession());
    }

    return { session, client };
}

export function setupLogout(currentClient) {
    document.querySelectorAll('#logout-btn, #logout-btn-mobile').forEach(btn => {
        btn.addEventListener('click', async () => {
            try {
                await currentClient.auth.signOut();
                localStorage.removeItem('valuon-remember-email');
                sessionStorage.clear();
                window.location.href = 'index.html';
            } catch (err) {
                console.error(err);
                localStorage.removeItem('valuon-remember-email');
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