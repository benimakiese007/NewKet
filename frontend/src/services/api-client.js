const API_BASE_URL = 'http://localhost:3001/api';

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

        // Try to obtain the Supabase JWT token
        if (window.supabaseClient) {
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
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Erreur API inconnue');
            }
            
            return data;
        } catch (error) {
            console.error(`[ApiClient] Error on ${endpoint}:`, error);
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
