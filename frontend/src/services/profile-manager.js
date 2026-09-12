/**
 * NewKet Profile Manager
 * Handles local user profile data and synchronization with Supabase.
 */
const ProfileManager = {
    _profile: null,

    _normalizeUsername(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '');
    },

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
                    username: this._normalizeUsername(localStorage.getItem('newketUserUsername') || localStorage.getItem('newketUserName') || ''),
                    first_name: localStorage.getItem('newketUserFirstName') || '',
                    last_name: localStorage.getItem('newketUserLastName') || '',
                    name: localStorage.getItem('newketUserName') || localStorage.getItem('newketUserUsername') || '',
                    email: localStorage.getItem('newketUserEmail') || '',
                    phone: localStorage.getItem('newketUserPhone') || '',
                    avatar: localStorage.getItem('newketUserAvatar') || ''
                };
            }

            if (!this._profile.username) {
                this._profile.username = this._normalizeUsername(this._profile.name || '');
            } else {
                this._profile.username = this._normalizeUsername(this._profile.username);
            }

            if (!this._profile.name) {
                this._profile.name = this._profile.username || '';
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
                } else if (this._profile.role === 'supplier') {
                    this._profile.seller_type = null;
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
        const normalizedUsername = this._normalizeUsername(data?.username || data?.name || '');
        const nextProfile = { ...this._profile, ...data };
        const normalizedHomeLocation = this._normalizeHomeLocation(data?.home_location);
        if ('home_location' in (data || {})) {
            if (normalizedHomeLocation) nextProfile.home_location = normalizedHomeLocation;
            else delete nextProfile.home_location;
        }

        if (normalizedUsername) {
            nextProfile.username = normalizedUsername;
        }

        if (data?.username && !nextProfile.name) {
            nextProfile.name = normalizedUsername || data.username;
        }
        if (data?.name && !nextProfile.username) {
            nextProfile.username = normalizedUsername || data.name;
        }

        this._profile = nextProfile;
        localStorage.setItem('newketProfile', JSON.stringify(this._profile));
        
        // Also update individual keys for compatibility
        if (normalizedUsername) localStorage.setItem('newketUserUsername', normalizedUsername);
        if (data.first_name !== undefined) {
            if (data.first_name) localStorage.setItem('newketUserFirstName', data.first_name);
            else localStorage.removeItem('newketUserFirstName');
        }
        if (data.last_name !== undefined) {
            if (data.last_name) localStorage.setItem('newketUserLastName', data.last_name);
            else localStorage.removeItem('newketUserLastName');
        }
        if (data.name) localStorage.setItem('newketUserName', data.name);
        else if (normalizedUsername) localStorage.setItem('newketUserName', normalizedUsername);
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

        // Push to Supabase — if user not ready yet, mark as pending for syncWithSupabase to pick up
        this._getCurrentUser().then(user => {
            if (user?.id) {
                this._pushHomeLocationToSupabase(user.id, normalizedHomeLocation);
            } else {
                localStorage.setItem('newketPendingHomeLocationSync', '1');
            }
        }).catch(() => {
            localStorage.setItem('newketPendingHomeLocationSync', '1');
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
                skipCache: true,
                suppressErrorLogging: true
            });

            if (profile) {
                const normalizedUsername = this._normalizeUsername(
                    profile.username || profile.company_name || profile.name || this._profile.username || this._profile.name
                );

                // Merge home_location: Supabase wins if more recent, else keep local
                const remoteHomeLocation = this._normalizeHomeLocation(profile.home_location);
                const localHomeLocation = this._normalizeHomeLocation(this._profile.home_location);
                let mergedHomeLocation = localHomeLocation;
                if (remoteHomeLocation) {
                    const remoteTs = remoteHomeLocation.updated_at ? new Date(remoteHomeLocation.updated_at).getTime() : 0;
                    const localTs = localHomeLocation?.updated_at ? new Date(localHomeLocation.updated_at).getTime() : 0;
                    mergedHomeLocation = remoteTs >= localTs ? remoteHomeLocation : localHomeLocation;
                }

                this.saveProfile({
                    username: normalizedUsername,
                    name: profile.name || profile.username || this._profile.name || this._profile.username,
                    first_name: profile.first_name || this._profile.first_name,
                    last_name: profile.last_name || this._profile.last_name,
                    company_name: profile.company_name || this._profile.company_name || null,
                    email: user.email || this._profile.email,
                    phone: profile.phone || profile.store_phone || this._profile.phone,
                    avatar: profile.avatar || profile.avatar_url || profile.photo_url || profile.picture || this._profile.avatar,
                    role: profile.role || user.role,
                    seller_type: profile.seller_type || this._profile.seller_type || null,
                    home_location: mergedHomeLocation || undefined
                });

                // Push local home_location to Supabase if:
                // - remote has none (first save), OR local is newer, OR there's a pending sync flag
                const hasPendingSync = localStorage.getItem('newketPendingHomeLocationSync') === '1';
                const remoteTs = remoteHomeLocation?.updated_at ? new Date(remoteHomeLocation.updated_at).getTime() : 0;
                const localTs = localHomeLocation?.updated_at ? new Date(localHomeLocation.updated_at).getTime() : 0;
                const shouldPush = mergedHomeLocation && (hasPendingSync || !remoteHomeLocation || localTs > remoteTs);
                if (shouldPush) {
                    await this._pushHomeLocationToSupabase(user.id, mergedHomeLocation);
                    localStorage.removeItem('newketPendingHomeLocationSync');
                }
            }
        } catch (error) {
            console.error('[ProfileManager] Sync error:', error);
        }
    },

    async _pushHomeLocationToSupabase(userId, homeLocation) {
        if (!userId || !homeLocation) return;

        // Use direct .update() (not upsert) — the row always exists for authenticated users,
        // and upsert can fail silently on INSERT when NOT NULL columns are missing.
        const client = window.SupabaseAdapter?.getClient?.();
        if (!client) return;

        try {
            const { error } = await client
                .from('users')
                .update({ home_location: homeLocation })
                .eq('id', userId);

            if (error) throw error;
            console.info('[ProfileManager] home_location synced to Supabase.');
        } catch (error) {
            console.warn('[ProfileManager] Failed to push home_location to Supabase:', error);
            // Mark as pending so the next syncWithSupabase call retries it
            localStorage.setItem('newketPendingHomeLocationSync', '1');
        }
    }
};

// Initialize and export
ProfileManager.init();
window.ProfileManager = ProfileManager;
