/**
 * NewKet Profile Manager
 * Handles local user profile data and synchronization with Supabase.
 */
const ProfileManager = {
    _profile: null,

    async _getCurrentUser() {
        if (window.AuthManager?.user?.id) return window.AuthManager.user;

        if (window.SupabaseAdapter) {
            const session = await window.SupabaseAdapter.getSession(1000);
            if (session?.user) return session.user;
        }

        if (!window.supabaseClient) return null;

        try {
            const { data: { user } } = await window.supabaseClient.auth.getUser();
            return user || null;
        } catch {
            return null;
        }
    },

    init() {
        this.loadLocalProfile();
    },

    loadLocalProfile() {
        try {
            const stored = localStorage.getItem('newketProfile');
            if (stored) {
                this._profile = JSON.parse(stored);
            } else {
                // Fallback to basic info from auth
                this._profile = {
                    name: localStorage.getItem('newketUserName') || '',
                    email: localStorage.getItem('newketUserEmail') || '',
                    phone: localStorage.getItem('newketUserPhone') || '',
                    avatar: localStorage.getItem('newketUserAvatar') || ''
                };
            }
        } catch (e) {
            console.error('[ProfileManager] Error loading profile:', e);
            this._profile = {};
        }
    },

    getProfile() {
        if (!this._profile) this.loadLocalProfile();
        return this._profile;
    },

    saveProfile(data) {
        this._profile = { ...this._profile, ...data };
        localStorage.setItem('newketProfile', JSON.stringify(this._profile));
        
        // Also update individual keys for compatibility
        if (data.name) localStorage.setItem('newketUserName', data.name);
        if (data.email) localStorage.setItem('newketUserEmail', data.email);
        const resolvedPhone =
            data.phone ||
            data.store_phone ||
            data.store_phone_whatsapp ||
            '';
        if (resolvedPhone) localStorage.setItem('newketUserPhone', resolvedPhone);
        if (data.city) localStorage.setItem('newketUserCity', data.city);
        if (data.company_name) localStorage.setItem('newketCompany', data.company_name);
        if (data.boutique_name) localStorage.setItem('newketBoutiqueName', data.boutique_name);
        const avatar = data.avatar || data.avatar_url || data.picture || data.photo_url || data.picture_url;
        if (avatar) localStorage.setItem('newketUserAvatar', avatar);
        
        // Trigger event for UI updates
        window.dispatchEvent(new CustomEvent('profileUpdated', { detail: this._profile }));
        
        return true;
    },

    async syncWithSupabase() {
        if (!window.SupabaseAdapter) return;
        
        const user = await this._getCurrentUser();
        if (!user || !user.id) return;

        try {
            const profile = await window.SupabaseAdapter.fetchWithFilters('users', {
                eq: [['id', user.id]],
                single: true,
                skipCache: true
            });

            if (profile) {
                this.saveProfile({
                    name: profile.name || this._profile.name,
                    company_name: profile.company_name || this._profile.company_name,
                    email: user.email || this._profile.email,
                    phone: profile.phone || profile.store_phone || this._profile.phone,
                    avatar: profile.avatar || profile.avatar_url || profile.photo_url || profile.picture || this._profile.avatar,
                    role: profile.role || user.role,
                    shipping_time: profile.shipping_time || this._profile.shipping_time
                });
            }
        } catch (error) {
            console.error('[ProfileManager] Sync error:', error);
        }
    }
};

// Initialize and export
ProfileManager.init();
window.ProfileManager = ProfileManager;
