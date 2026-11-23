import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-client.js';
import { logError } from './security.js';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

let sharedClient = null;
let authPromise = null;

export async function getAuthSession() {
    if (sharedClient) {
        const { data: { session } } = await sharedClient.auth.getSession();
        return { session, client: sharedClient };
    }

    if (!authPromise) {
        authPromise = (async () => {
            try {
                let client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                    auth: {
                        storage: localStorage,
                        autoRefreshToken: true,
                        persistSession: true
                    }
                });
                let { data: { session } } = await client.auth.getSession();

                if (!session) {
                    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                        auth: {
                            storage: sessionStorage,
                            autoRefreshToken: true,
                            persistSession: true
                        }
                    });
                    ({ data: { session } } = await client.auth.getSession());
                }

                sharedClient = client;
                return { session, client: sharedClient };
            } catch (err) {
                authPromise = null;
                throw err;
            }
        })();
    }

    return authPromise;
}

export function setupLogout(currentClient) {
    document.querySelectorAll('#logout-btn, #logout-btn-mobile').forEach(btn => {
        btn.addEventListener('click', async () => {
            const clientToSignOut = currentClient || sharedClient;
            try {
                if (clientToSignOut) await clientToSignOut.auth.signOut();
                sharedClient = null;
                authPromise = null;
                localStorage.removeItem('valuon-remember-email');
                localStorage.removeItem('valuon-remember-login');
                sessionStorage.clear();
                window.location.href = 'index.html';
            } catch (err) {
                logError('auth:logout', err);
                sharedClient = null;
                authPromise = null;
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