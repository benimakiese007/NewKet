/**
 * NewKet User Manager
 * Handles user/vendor data for the Admin CMS and Platform.
 */
const UserManager = {
    data: [],
    _initialized: false,
    _initPromise: null,

    async init() {
        if (!window.ApiClient) {
            console.error('[UserManager] ApiClient not found.');
            return;
        }

        if (this._initialized && Array.isArray(this.data) && this.data.length) {
            return this.data;
        }

        if (this._initPromise) {
            return await this._initPromise;
        }

        this._initPromise = (async () => {
            try {
                // Fetch all users from the Express Backend
                const users = await ApiClient.get('/users');
                this.data = users || [];
                this._initialized = true;
                return this.data;
            } catch (error) {
                console.error('[UserManager] Error initializing users:', error);
                this.data = [];
                this._initialized = true;
                return [];
            } finally {
                this._initPromise = null;
                // Dispatch INSIDE the IIFE so it fires after data is ready
                window.dispatchEvent(new CustomEvent('usersUpdated'));
            }
        })();

        return await this._initPromise;
    },

    getUsers() {
        return this.data;
    },

    getUser(id) {
        return this.data.find(u => u.id === id || u.email === id);
    },

    getDisplayName(user) {
        if (!user) return 'Utilisateur inconnu';
        const fallback = user.email ? user.email.split('@')[0] : 'Inconnu';
        return user.company_name || user.store_name || user.name || fallback;
    },

    async updateStatus(userId, status) {
        if (!window.ApiClient) return { error: 'ApiClient not initialized' };

        try {
            const data = await ApiClient.put(`/users/${userId}/status`, { status });
            if (data.success) {
                // Update local cache
                const index = this.data.findIndex(u => u.id === userId);
                if (index !== -1) this.data[index].status = status;
                return { success: true };
            }
            return { error: 'Update failed' };
        } catch (err) {
            return { error: err.message };
        }
    },

    async deleteUser(userId) {
        if (!window.ApiClient) return false;
        
        try {
            const data = await ApiClient.delete(`/users/${userId}`);
            if (data.success) {
                this.data = this.data.filter(u => u.id !== userId);
                return true;
            }
            return false;
        } catch (err) {
            return false;
        }
    }
};

window.UserManager = UserManager;
