import { captureError } from './sentry.js';

// En production (Vercel) et en developpement (vercel dev), les appels /api/* sont routes vers les Serverless Functions.
let API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// If VITE_API_URL was set to the domain without /api (e.g. https://newket.vercel.app), append /api
// to ensure Vercel routes the request to the serverless functions instead of looking for static files.
if (API_BASE_URL.startsWith('http') && !API_BASE_URL.endsWith('/api') && !API_BASE_URL.endsWith('/api/')) {
    API_BASE_URL = API_BASE_URL.replace(/\/$/, '') + '/api';
}

function isNetworkFailure(error) {
    const message = error?.message || '';
    return error instanceof TypeError
        || /Failed to fetch|NetworkError|ERR_CONNECTION_REFUSED|Load failed/i.test(message);
}

/**
 * Fetch wrapper for connecting to the Express Backend.
 * Automatically injects the Supabase user session token into the 'Authorization' header.
 */
export const ApiClient = {
    _sessionCache: {
        token: null,
        expiresAt: 0
    },
    _inflight: new Map(),
    _responseCache: new Map(),

    _getCachedResponse(cacheKey) {
        if (!cacheKey) return null;
        const entry = this._responseCache.get(cacheKey);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this._responseCache.delete(cacheKey);
            return null;
        }
        return entry.data;
    },

    _setCachedResponse(cacheKey, data, ttlMs) {
        if (!cacheKey) return;
        const ttl = Math.max(0, Number(ttlMs) || 0);
        if (!ttl) return;
        this._responseCache.set(cacheKey, { data, expiresAt: Date.now() + ttl });
    },

    async _getAuthHeaderCached() {
        const now = Date.now();
        if (this._sessionCache.token && now < this._sessionCache.expiresAt) {
            return { Authorization: `Bearer ${this._sessionCache.token}` };
        }

        let token = null;

        if (window.SupabaseAdapter) {
            const session = await window.SupabaseAdapter.getSession(3000); // 3s timeout
            token = session?.access_token || null;
        } else if (window.supabaseClient) {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            token = session?.access_token || null;
        }

        if (token) {
            this._sessionCache.token = token;
            this._sessionCache.expiresAt = now + 60_000; // 60s
            return { Authorization: `Bearer ${token}` };
        }

        this._sessionCache.token = null;
        this._sessionCache.expiresAt = 0;
        return {};
    },

    async fetch(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;

        let headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        // Auth header (cached) to reduce repeated async session lookups
        try {
            headers = { ...headers, ...(await this._getAuthHeaderCached()) };
        } catch {
        }

        const config = {
            ...options,
            headers
        };

        try {
            const isGet = (config.method || 'GET').toUpperCase() === 'GET';
            const cacheKey = options.cacheKey && isGet ? String(options.cacheKey) : null;
            const cached = this._getCachedResponse(cacheKey);
            if (cached != null) return cached;

            const dedupe = options.dedupe !== false;
            const inflightKey = (dedupe && isGet) ? url : null;
            if (inflightKey && this._inflight.has(inflightKey)) {
                return await this._inflight.get(inflightKey);
            }

            const run = async () => {
                const response = await fetch(url, config);

                // Safe JSON parse - SW may return plain text (e.g. "Offline") on network failure
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
                        data = { error: text || `Erreur reseau (${response.status})` };
                    }
                }

                if (!response.ok) {
                    const baseMsg = data?.error || `Erreur API ${response.status}`;
                    const details = data?.details ? `: ${data.details}` : '';
                    const err = new Error(`${baseMsg}${details}`);
                    err.status = response.status;
                    err.data = data;
                    throw err;
                }

                if (cacheKey && options.cacheTtlMs) {
                    this._setCachedResponse(cacheKey, data, options.cacheTtlMs);
                }

                return data;
            };

            if (inflightKey) {
                const promise = run().finally(() => this._inflight.delete(inflightKey));
                this._inflight.set(inflightKey, promise);
                return await promise;
            }

            return await run();
        } catch (error) {
            if (options.suppressNetworkError && isNetworkFailure(error)) {
                return null;
            }

            if (!options.suppressErrorLogging) {
                console.error(`[ApiClient] Error on ${endpoint}:`, error);
                captureError(error, { endpoint, method: options.method || 'GET' });
            }
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
