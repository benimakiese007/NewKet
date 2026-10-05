import { createClient } from '@supabase/supabase-js';

// Supabase configuration loaded from .env.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function isPlaceholder(value) {
    if (!value) return true;

    const normalized = String(value).trim().toLowerCase();
    return (
        normalized.startsWith('your-') ||
        normalized.includes('your-project-ref.supabase.co') ||
        normalized.includes('your-supabase-anon-key') ||
        normalized.includes('your-anon-key-here') ||
        normalized.includes('replace-me')
    );
}

const hasValidSupabaseConfig = !isPlaceholder(SUPABASE_URL) && !isPlaceholder(SUPABASE_ANON_KEY);

if (!hasValidSupabaseConfig) {
    console.error(
        '[NewKet] CRITICAL ERROR: invalid or incomplete Supabase configuration. ' +
        'Check frontend/.env and replace the template values with the real project keys.'
    );
}

export const supabaseClient = hasValidSupabaseConfig
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            experimental: {
                passkey: true
            }
        },
        global: {
            fetch: (...args) => {
                const [url, options] = args;
                // Force explicit use of window.fetch which is patched by CapacitorHttp
                // Do not use the local `fetch` reference which might bypass the patch.
                return window.fetch(url, { ...options, cache: 'no-store' });
            }
        }
    })
    : null;

window.supabaseClient = supabaseClient;

window.getStoredSupabaseSession = () => {
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !/^sb-[a-z0-9]+-auth-token$/i.test(key)) continue;

            const raw = localStorage.getItem(key);
            if (!raw) continue;

            const parsed = JSON.parse(raw);
            const session = parsed?.currentSession || parsed?.session || parsed;
            if (session?.access_token) return session;
        }
    } catch {
        // ignore malformed storage entries
    }

    return null;
};

window.getSupabaseAccessToken = () => {
    const session = window.getStoredSupabaseSession ? window.getStoredSupabaseSession() : null;
    return session?.access_token || null;
};

window.getSupabaseSession = async (timeoutMs = 3000) => {
    const storedSession = window.getStoredSupabaseSession ? window.getStoredSupabaseSession() : null;
    if (storedSession?.access_token) return storedSession;

    if (window.SupabaseAdapter && typeof window.SupabaseAdapter.getSession === 'function') {
        return await window.SupabaseAdapter.getSession(timeoutMs);
    }

    if (!window.supabaseClient) return null;

    const { data: { session } } = await window.supabaseClient.auth.getSession();
    return session || null;
};

window.getSupabaseUser = async (timeoutMs = 3000) => {
    if (window.AuthManager?.user?.id) return window.AuthManager.user;

    const storedSession = window.getStoredSupabaseSession ? window.getStoredSupabaseSession() : null;
    if (storedSession?.user) return storedSession.user;

    const session = window.getSupabaseSession
        ? await window.getSupabaseSession(timeoutMs)
        : null;
    if (session?.user) return session.user;

    if (!window.supabaseClient) return null;

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        return user || null;
    } catch {
        return null;
    }
};
