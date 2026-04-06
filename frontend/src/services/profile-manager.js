/**
 * NewKet Profile Manager
 * Handles local user profile data and synchronization with Supabase.
 */
const ProfileManager = {
    _profile: null,

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
        
        // Trigger event for UI updates
        window.dispatchEvent(new CustomEvent('profileUpdated', { detail: this._profile }));
        
        return true;
    },

    /**
     * Syncs the local profile with the Supabase 'profiles' table.
     */
    async syncWithSupabase() {
        if (!window.SupabaseAdapter) return;
        
        const user = AuthManager.getUser();
        if (!user || !user.id) return;

        try {
            const profile = await window.ApiClient.get('/profiles/me');

            if (profile) {
                this.saveProfile({
                    name: profile.full_name || profile.username || this._profile.name,
                    email: user.email || this._profile.email,
                    phone: profile.phone || profile.store_phone_whatsapp || this._profile.phone,
                    avatar: profile.avatar_url || this._profile.avatar,
                    role: profile.role || user.role
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
