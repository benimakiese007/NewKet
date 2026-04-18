import { captureError } from './sentry.js';

// En production (Vercel), les appels /api/* sont servis par la Serverless Function sur le même domaine.
// En développement local, on pointe vers le serveur Express sur :3001.
const API_BASE_URL = import.meta.env.VITE_API_URL
    || (location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? 'http://localhost:3001/api' : '/api');

/**
 * Fetch wrapper for connecting to the Express Backend.
 * Automatically injects the Supabase user session token into the 'Authorization' header.
 */
export const ApiClient = {
    async fetch(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        
        let headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        // Try to obtain the Supabase JWT token safely
        if (window.SupabaseAdapter) {
            const session = await window.SupabaseAdapter.getSession(3000); // 3s timeout
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }
        } else if (window.supabaseClient) {
            // Fallback if adapter not ready
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }
        }

        const config = {
            ...options,
            headers
        };

        try {
            const response = await fetch(url, config);

            // Safe JSON parse — SW may return plain text (e.g. "Offline") on network failure
            let data;
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                try {
                    data = JSON.parse(text);
                } catch {
                    // Plain text fallback (e.g. Service Worker offline response)
                    data = { error: text || `Erreur réseau (${response.status})` };
                }
            }

            if (!response.ok) {
                throw new Error(data.error || `Erreur API ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error(`[ApiClient] Error on ${endpoint}:`, error);
            // Capturer toutes les erreurs d'API (délai, 500, etc) avec le contexte
            captureError(error, { endpoint, method: options.method || 'GET' });
            throw error;
        }
    },

    // Short-hands
    get(endpoint, options = {}) {
        return this.fetch(endpoint, { ...options, method: 'GET' });
    },
    post(endpoint, body, options = {}) {
        return this.fetch(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) });
    },
    put(endpoint, body, options = {}) {
        return this.fetch(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) });
    },
    delete(endpoint, body, options = {}) {
        return this.fetch(endpoint, { ...options, method: 'DELETE', body: body ? JSON.stringify(body) : undefined });
    }
};

window.ApiClient = ApiClient;
