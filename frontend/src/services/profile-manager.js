/**
 * NewKet Profile Manager
 * Handles local user profile data and synchronization with Supabase.
 */
const ProfileManager = {
    _profile: null,

    _normalizeHomeLocation(location) {
        if (!location || typeof location !== 'object') return null;

        const lat = Number(location.lat);
        const lng = Number(location.lng);
        const city = String(location.city || '').trim();

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        return {
            lat,
            lng,
            city,
            updated_at: location.updated_at || new Date().toISOString()
        };
    },

    async _getCurrentUser() {
        if (window.AuthManager?.user?.id) return window.AuthManager.user;

        if (window.SupabaseAdapter) {
            const session = await window.SupabaseAdapter.getSession(1000);
            if (session?.user) return session.user;
        }

        return window.getSupabaseUser ? await window.getSupabaseUser(1000) : null;
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

            const savedHomeLocation = this._normalizeHomeLocation(
                this._profile?.home_location ||
                JSON.parse(localStorage.getItem('newketHomeLocation') || 'null')
            );
            if (savedHomeLocation) {
                this._profile.home_location = savedHomeLocation;
                if (savedHomeLocation.city) localStorage.setItem('newketUserCity', savedHomeLocation.city);
            }

            if (!this._profile.seller_type) {
                const storedSellerType = localStorage.getItem('newketSellerType');
                if (storedSellerType) {
                    this._profile.seller_type = storedSellerType;
                }
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
        const nextProfile = { ...this._profile, ...data };
        const normalizedHomeLocation = this._normalizeHomeLocation(data?.home_location);
        if ('home_location' in (data || {})) {
            if (normalizedHomeLocation) nextProfile.home_location = normalizedHomeLocation;
            else delete nextProfile.home_location;
        }

        this._profile = nextProfile;
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
        else if ('phone' in data || 'store_phone' in data || 'store_phone_whatsapp' in data) localStorage.removeItem('newketUserPhone');
        if (data.city) localStorage.setItem('newketUserCity', data.city);
        if (data.company_name) localStorage.setItem('newketCompany', data.company_name);
        if (data.boutique_name) localStorage.setItem('newketBoutiqueName', data.boutique_name);
        if (data.seller_type) localStorage.setItem('newketSellerType', data.seller_type);
        else if ('seller_type' in data) localStorage.removeItem('newketSellerType');
        const avatar = data.avatar || data.avatar_url || data.picture || data.photo_url || data.picture_url;
        if (avatar) localStorage.setItem('newketUserAvatar', avatar);
        if ('home_location' in (data || {})) {
            if (normalizedHomeLocation) {
                localStorage.setItem('newketHomeLocation', JSON.stringify(normalizedHomeLocation));
                if (normalizedHomeLocation.city) localStorage.setItem('newketUserCity', normalizedHomeLocation.city);
            } else {
                localStorage.removeItem('newketHomeLocation');
            }
        }
        
        // Trigger event for UI updates
        window.dispatchEvent(new CustomEvent('profileUpdated', { detail: this._profile }));
        
        return true;
    },

    getHomeLocation() {
        if (!this._profile) this.loadLocalProfile();
        try {
            return this._normalizeHomeLocation(
                this._profile?.home_location ||
                JSON.parse(localStorage.getItem('newketHomeLocation') || 'null')
            );
        } catch {
            return this._normalizeHomeLocation(this._profile?.home_location);
        }
    },

    saveHomeLocation(location) {
        const normalizedHomeLocation = this._normalizeHomeLocation(location);
        if (!normalizedHomeLocation) return false;

        this.saveProfile({
            home_location: normalizedHomeLocation,
            city: normalizedHomeLocation.city || this._profile?.city || ''
        });
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
                    seller_type: profile.seller_type || this._profile.seller_type,
                    shipping_time: profile.shipping_time || this._profile.shipping_time,
                    home_location: this._profile.home_location
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
