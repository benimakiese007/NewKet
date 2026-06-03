/* newket EMarket Auth Manager */
/**
 * Rôle interne: 'supplier'. Label UI: 'Vendeur'.
 * Rôle interne: 'customer'. Label UI: 'Client'.
 * Rôle interne: 'admin'. Label UI: 'Administrateur'.
 */
// Admin email list is now centralized in admin-config.js (synchronous script)
const ADMIN_EMAILS = window.ADMIN_EMAILS || [];
const ALLOWED_ROLES = new Set(['customer', 'supplier', 'admin']);
const REFERRAL_CODE_STORAGE_KEY = 'newketReferralCode';

function normalizeReferralCode(value) {
    return String(value || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9-]/g, '');
}

function captureReferralCodeFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        const code = normalizeReferralCode(
            params.get('ref') ||
            params.get('invite') ||
            params.get('parrain') ||
            ''
        );

        if (code) {
            localStorage.setItem(REFERRAL_CODE_STORAGE_KEY, code);
        }

        return code;
    } catch {
        return '';
    }
}

captureReferralCodeFromUrl();

const AuthManager = {
    role: null,
    status: null, // Status KYC : pending (jamais soumis), submitted (en attente validation), approved, rejected
    sellerType: null,
    user: null, // Supabase user object for pages like settings.html
    _authChecking: true, // Start as true to block UI
    _initialized: false,
    _realtimeChannel: null,
    _syncInterval: null,
    _sessionUpdatePromise: null,
    _logoutInProgress: false,
    _pendingRoleSelection: false,

    async init() {
        this._authChecking = true;

        // --- GLOBAL FAIL-SAFE ---
        // Force-remove loading screen after 10s regardless of what happens
        const failSafeTimer = setTimeout(() => {
            // Only act if we are still stuck behind the loading gate.
            if (this._authChecking && document.documentElement.classList.contains('auth-loading')) {
                const isLocal = /^(localhost|127\\.0\\.0\\.1)$/i.test(window.location.hostname);
                const log = isLocal ? console.info : console.warn;
                log('[NewKet Auth] Fail-safe: Forcefully removing loading screen.');
                document.documentElement.classList.remove('auth-loading');
                this._authChecking = false;
            }
        }, 10000);
        
        try {
            if (window.supabaseClient) {
                window.supabaseClient.auth.onAuthStateChange((event, session) => {
                    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                        if (session) {
                            const user = session.user;
                            this.user = user;
                            
                            // ⚠️ CRITICAL FIRE-AND-FORGET ⚠️
                            // Do not use 'await' or make this callback async. 
                            // Supabase internal auth lock will deadlock if you await DB queries here!
                            setTimeout(() => {
                                this.handleSessionUpdate(user).catch(err => console.error('[NewKet Auth] Error updating session:', err));
                            }, 0);
                        }
                    } else if (event === 'SIGNED_OUT') {
                        this.handleLogoutCleanup();
                    }
                });

                const session = await window.SupabaseAdapter.getSession(3000);
                
                if (session) {
                    const user = session.user;
                        this.user = user; 
                        await this.handleSessionUpdate(user);
                    } else {
                        this.handleLogoutCleanup();
                        
                        // Redirect if on protected page
                        const path = window.location.pathname;
                        if (path.includes('/admin/') || path.includes('dashboard') || path.includes('publish')) {
                            if (!path.includes('login')) {
                                console.warn('[NewKet Auth] Protected page access attempt without session.');
                                window.location.href = window.resolvePath('login');
                                return;
                            }
                        }
                    }
            }
        } catch (err) {
            console.error('[NewKet Auth] Unexpected error during init:', err);
            this.handleLogoutCleanup();
        } finally {
            clearTimeout(failSafeTimer);
            this._authChecking = false;
            this._initialized = true; // Mark as fully initialized
            this.enforcePermissions();
            this.updateAccountLink();
            this.checkWelcomeBonus();
            document.documentElement.classList.remove('auth-loading');

            // Start periodic role validation
            this.startRoleValidation();

            // Listen for components-loader events (Re-enforce once DOM is populated)
            if (window.componentsLoaded) {
                this.enforcePermissions();
                this.updateAccountLink();
            } else {
                window.addEventListener('componentsLoaded', () => {
                    this.enforcePermissions();
                    this.updateAccountLink();
                });
            }
        }
    },

    async handleSessionUpdate(user) {
        if (!user) return;
        if (this._sessionUpdatePromise) return this._sessionUpdatePromise;

        this._sessionUpdatePromise = (async () => {
            try {
                this._logoutInProgress = false;
                const email = user.email;
                const explicitRole = this.resolveRoleFromUser(user);

                this.user = user;
                localStorage.setItem('newketUserEmail', email);
                localStorage.setItem('newketUserId', user.id);

                let profile = await this.getUserProfile(user.id);

                const oauthAvatar =
                    user.user_metadata.avatar_url ||
                    user.user_metadata.avatarUrl ||
                    user.user_metadata.picture ||
                    user.user_metadata.picture_url ||
                    user.user_metadata.photo_url ||
                    user.user_metadata.photoURL ||
                    user.user_metadata.avatar ||
                    user.identities?.[0]?.identity_data?.picture ||
                    user.identities?.[0]?.identity_data?.avatar_url ||
                    null;

                try {
                    const dbAvatar = profile?.avatar || null;
                    const resolvedAvatar = dbAvatar || oauthAvatar;
                    if (resolvedAvatar) {
                        localStorage.setItem('newketUserAvatar', resolvedAvatar);
                    } else {
                        localStorage.removeItem('newketUserAvatar');
                    }

                    if (window.supabaseClient && !dbAvatar && oauthAvatar && profile) {
                        window.supabaseClient
                            .from('users')
                            .update({ avatar: oauthAvatar })
                            .eq('id', user.id)
                            .then(() => {})
                            .catch(() => {});
                    }
                } catch (_) {
                    if (oauthAvatar) localStorage.setItem('newketUserAvatar', oauthAvatar);
                }

                if (!profile && this.shouldRequireRoleSelection(user, profile)) {
                    this.markPendingRoleSelection(true);
                    this.role = null;
                    this.status = null;
                    localStorage.removeItem('newketRole');
                    localStorage.removeItem('newketUserStatus');
                    localStorage.removeItem('newketSellerType');
                    this.sellerType = null;
                    this.enforcePermissions();
                    this.updateAccountLink();
                    return;
                }

                if (!profile) {
                    console.log('[NewKet Auth] New user detected, creating database profile...');
                    profile = await this.createUserProfile(user, explicitRole);
                }

                const role = explicitRole || profile?.role || null;
                if (!role || this.shouldRequireRoleSelection(user, profile)) {
                    this.markPendingRoleSelection(true);
                    this.role = null;
                    this.status = null;
                    localStorage.removeItem('newketRole');
                    localStorage.removeItem('newketUserStatus');
                    localStorage.removeItem('newketSellerType');
                    this.sellerType = null;
                    this.enforcePermissions();
                    this.updateAccountLink();
                    return;
                }

                this.markPendingRoleSelection(false);
                this.role = role;
                localStorage.setItem('newketRole', role);

                this.sellerType = profile?.seller_type || (role === 'supplier' ? 'normal' : null);
                if (this.sellerType) localStorage.setItem('newketSellerType', this.sellerType);
                else localStorage.removeItem('newketSellerType');

                this.status = profile?.status || await this.fetchUserStatus(email);
                localStorage.setItem('newketUserStatus', this.status);

                if (window.ProfileManager && profile) {
                    window.ProfileManager.saveProfile({
                        ...profile,
                        email: user.email || profile.email || '',
                        phone: profile.store_phone || ''
                    });
                }

                this.setupRealtimeSync(user.id);
                this.enforcePermissions();
                this.updateAccountLink();

                if (window.FavoritesManager) window.FavoritesManager.syncFromSupabase();
                if (window.ProfileManager) window.ProfileManager.syncWithSupabase();
            } catch (err) {
                console.error('[NewKet Auth] handleSessionUpdate error:', err);
            } finally {
                this._authChecking = false;
                this._initialized = true;
                document.documentElement.classList.remove('auth-loading');
            }
        })();

        try {
            await this._sessionUpdatePromise;
        } finally {
            this._sessionUpdatePromise = null;
        }
    },


    handleLogoutCleanup() {
        console.warn('[NewKet Auth] Running handleLogoutCleanup...');

        // Stop background sync
        if (this._syncInterval) {
            clearInterval(this._syncInterval);
            this._syncInterval = null;
        }

        // Remove realtime channels
        if (this._realtimeChannel) {
            try {
                if (window.supabaseClient) {
                    window.supabaseClient.removeChannel(this._realtimeChannel);
                }
            } catch (err) {
                console.error('[NewKet Auth] Error removing realtime channel during cleanup:', err);
            }
            this._realtimeChannel = null;
        }

        // Reset local state
        this.role = null;
        this.status = null;
        this.user = null;

        // Wipe storage
        this.clearSession();

        // Re-enforce guest UI
        this.enforcePermissions();
        
        this._authChecking = false;
        this._initialized = true;
        document.documentElement.classList.remove('auth-loading');
    },

    resolveRoleFromUser(user) {
        if (!user) return null;
        const email = String(user.email || '').trim().toLowerCase();
        const admins = (window.ADMIN_EMAILS || []).map(e => e.toLowerCase());
        if (email && admins.includes(email)) {
            return 'admin';
        }
        const metadataRole =
            (user.app_metadata && user.app_metadata.role) ||
            user.user_metadata.role ||
            null;

        if (!metadataRole) return null;

        const normalizedRole = String(metadataRole).trim().toLowerCase();
        return ALLOWED_ROLES.has(normalizedRole) ? normalizedRole : null;
    },

    getAuthProviders(user = this.user) {
        if (!user) return [];
        const providers = new Set();
        const appProviders = Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers : [];
        const identities = Array.isArray(user.identities) ? user.identities : [];
        const singleProviders = [
            user.app_metadata?.provider,
            user.user_metadata?.provider,
            user.user_metadata?.iss
        ];

        appProviders.forEach((provider) => {
            if (provider) providers.add(String(provider).toLowerCase());
        });

        singleProviders.forEach((provider) => {
            if (provider) providers.add(String(provider).toLowerCase());
        });

        identities.forEach((identity) => {
            const provider =
                identity?.provider ||
                identity?.identity_data?.provider ||
                identity?.identity_data?.iss;
            if (provider) providers.add(String(provider).toLowerCase());
        });

        return Array.from(providers);
    },

    userHasLocalPassword(user = this.user) {
        const providers = this.getAuthProviders(user);
        return providers.includes('email') || providers.includes('password');
    },

    isOAuthOnlyUser(user = this.user) {
        const providers = this.getAuthProviders(user);
        return providers.length > 0 && !this.userHasLocalPassword(user);
    },

    requiresCurrentPassword(user = this.user) {
        return !this.isOAuthOnlyUser(user);
    },

    shouldRequireRoleSelection(user = this.user, profile = null) {
        if (!user) return false;

        const explicitRole = this.resolveRoleFromUser(user);
        if (explicitRole === 'admin') return false;
        if (this.isOAuthOnlyUser(user) && !this.hasConfirmedRoleSelection(user)) return true;
        if (profile?.role) return false;
        if (this.hasPendingRoleSelection()) return true;

        return this.isOAuthOnlyUser(user) || !explicitRole;
    },

    hasConfirmedRoleSelection(user = this.user) {
        if (user?.user_metadata?.role_selected === true) return true;
        return localStorage.getItem('newketRoleSelectionConfirmed') === 'true';
    },

    markPendingRoleSelection(isPending) {
        this._pendingRoleSelection = !!isPending;
        if (isPending) {
            localStorage.setItem('newketPendingRoleChoice', 'true');
            localStorage.removeItem('newketRoleSelectionConfirmed');
        } else {
            localStorage.removeItem('newketPendingRoleChoice');
        }
    },

    hasPendingRoleSelection() {
        return this._pendingRoleSelection || localStorage.getItem('newketPendingRoleChoice') === 'true';
    },

    isRoleSelectionPage() {
        return window.location.pathname.includes('choose-role');
    },

    getRoleSelectionPath() {
        return window.resolvePath('choose-role');
    },

    getRedirectPathForRole(role, status) {
        if (role === 'admin') return window.resolvePath('admin/');
        if (role === 'supplier') {
            return status === 'pending'
                ? window.resolvePath('seller-onboarding')
                : window.resolvePath('vendor-dashboard');
        }
        return window.resolvePath('customer-dashboard');
    },

    async getUserProfile(userId) {
        if (!window.supabaseClient || !userId) return null;
        try {
            const { data, error } = await window.supabaseClient
                .from('users')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            if (error) {
                console.error('[NewKet Auth] Database error during profile fetch:', error);
                return null;
            }

            return data || null;
        } catch (err) {
            console.error('[NewKet Auth] Unexpected error fetching profile:', err);
            return null;
        }
    },

    async checkProfile(userId) {
        const profile = await this.getUserProfile(userId);
        return !!profile;
    },

    async createUserProfile(user, role) {
        if (!window.SupabaseAdapter || !user?.id || !user?.email || !role) {
            throw new Error('[NewKet Auth] Missing data to create user profile.');
        }

        const email = user.email;
        const avatarUrl = localStorage.getItem('newketUserAvatar');
        const referralCode = normalizeReferralCode(
            user.user_metadata?.referral_code_from ||
            user.user_metadata?.referralCode ||
            localStorage.getItem(REFERRAL_CODE_STORAGE_KEY)
        );
        const profile = {
            id: user.id,
            email,
            name: user.user_metadata.full_name || user.user_metadata.name || email.split('@')[0],
            avatar: avatarUrl,
            role,
            status: (role === 'customer' || role === 'admin') ? 'approved' : 'pending',
            seller_type: role === 'supplier' ? 'normal' : null,
            referred_by_code: referralCode || null
        };

        const success = await window.SupabaseAdapter.upsert('users', profile);
        if (!success) {
            throw new Error('[NewKet Auth] Failed to create database profile.');
        }

        if (referralCode && window.ApiClient) {
            try {
                await window.ApiClient.post('/referrals/claim', { code: referralCode }, {
                    suppressToast: true,
                    suppressErrorLogging: true
                });
                localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY);
            } catch (error) {
                console.warn('[NewKet Auth] Referral claim skipped:', error?.message || error);
            }
        }

        if (window.supabaseClient) {
            window.supabaseClient.auth.updateUser({
                data: {
                    ...user.user_metadata,
                    role: profile.role,
                    status: profile.status,
                    seller_type: profile.seller_type,
                    full_name: profile.name,
                    referral_code_from: referralCode || user.user_metadata?.referral_code_from || null
                }
            }).catch((error) => {
                console.warn('[NewKet Auth] Unable to sync role metadata after profile creation:', error?.message || error);
            });
        }

        return profile;
    },

    setupRealtimeSync(userId) {
        if (!window.supabaseClient || !userId) return;

        // Remove existing channel if any
        if (this._realtimeChannel) {
            window.supabaseClient.removeChannel(this._realtimeChannel);
        }

        this._realtimeChannel = window.supabaseClient
            .channel(`sync-user-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'users',
                    filter: `id=eq.${userId}`
                },
                (payload) => {
                    const newData = payload.new;
                    if (!newData) return;

                    const oldStatus = this.status;
                    const oldRole = this.role;

                    // Update local state
                if (newData.status) {
                    this.status = newData.status;
                    localStorage.setItem('newketUserStatus', this.status);
                    window.dispatchEvent(new CustomEvent('userStatusUpdated', { detail: { status: this.status } }));
                }

                if ('seller_type' in newData) {
                    this.sellerType = newData.seller_type || null;
                    if (this.sellerType) localStorage.setItem('newketSellerType', this.sellerType);
                    else localStorage.removeItem('newketSellerType');
                    window.dispatchEvent(new CustomEvent('sellerTypeUpdated', { detail: { sellerType: this.sellerType } }));
                }
                
                if (newData.role) {
                    this.role = newData.role;
                    localStorage.setItem('newketRole', this.role);
                }

                    // Re-enforce UI
                    this.enforcePermissions();
                    this.updateAccountLink();

                    // Notify user if status changed to approved
                    if (oldStatus !== 'approved' && newData.status === 'approved') {
                        if (typeof showToast === 'function') {
                            showToast('Félicitations ! Votre profil a été approuvé. Vous pouvez maintenant publier.', 'success');
                        }
                    }

                    // Notify if role changed
                    if (oldRole !== newData.role) {
                        window.dispatchEvent(new CustomEvent('roleChanged', { detail: { role: newData.role } }));
                    }
                }
            )
            .subscribe();
    },

    clearSession() {
        // Broad clear of all newket-related storage keys
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('newket')) {
                keysToRemove.push(key);
            }
            // Supabase JS v2 persists sessions under keys like: sb-<project-ref>-auth-token
            // When switching env/projects during dev, stale tokens here cause "Token invalide ou expiré" on the API.
            if (key && /^sb-[a-z0-9]+-auth-token$/i.test(key)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // Clear specific non-prefixed session keys
        sessionStorage.removeItem('adminAuth');
        localStorage.removeItem('supabase.auth.token'); // Fallback for old tokens if any
        localStorage.removeItem('supabase.auth.refreshToken'); // Extra fallback (older builds)
    },

    checkWelcomeBonus() {
        if (localStorage.getItem('newketWelcomeBonus') === 'true') {
            if (typeof showToast === 'function') {
                showToast('Bienvenue ! Profitez de -5% avec le code BIENVENUE', 'success');
            }
            localStorage.removeItem('newketWelcomeBonus');
        }
        if (localStorage.getItem('newketSupplierBonus') === 'true') {
            if (typeof showToast === 'function') {
                showToast('Bienvenue ! Profitez de la marketplace NewKet.', 'success');
            }
            localStorage.removeItem('newketSupplierBonus');
        }
    },

    getRole() {
        return this.role;
    },

    async fetchUserStatus(email) {
        if (!window.supabaseClient) {
            // Fall back to role-based default
            const role = this.role || localStorage.getItem('newketRole');
            return (role === 'customer' || role === 'admin') ? 'approved' : 'pending';
        }
        try {
            const { data, error } = await window.supabaseClient
                .from('users')
                .select('status, role')
                .eq('email', email)
                .maybeSingle();
            if (error) throw error;
            
            // If user is a known admin (from admin-config.js), force status 'approved'
            const admins = (window.ADMIN_EMAILS || []).map(e => e.toLowerCase());
            if (email && admins.includes(email.toLowerCase())) {
                return 'approved';
            }
            
            // If user not yet in DB (e.g. just signed up), determine default by role
            if (!data) {
                const role = this.role || localStorage.getItem('newketRole');
                return (role === 'customer' || role === 'admin') ? 'approved' : 'pending';
            }
            
            // If found in DB but status is null/empty, determine by role
            if (!data.status) {
                const role = data.role || this.role || localStorage.getItem('newketRole');
                return (role === 'customer' || role === 'admin') ? 'approved' : 'pending';
            }
            
            return data.status;
        } catch (err) {
            console.error('Error fetching user status:', err);
            const role = this.role || localStorage.getItem('newketRole');
            return (role === 'customer' || role === 'admin') ? 'approved' : 'pending';
        }
    },

    setRole(role) {
        this.role = role;
        localStorage.setItem('newketRole', role);
        this.enforcePermissions();
        this.updateAccountLink();

        // Dispatch event
        window.dispatchEvent(new CustomEvent('roleChanged', { detail: { role } }));
    },

    /**
     * Helper to handle logout button clicks with loading state.
     */
    async handleLogoutClick(btnEl, confirmFirst = true) {
        if (!btnEl) return this.logout(confirmFirst);
        if (btnEl.disabled) return;
        if (this._logoutInProgress) return;
        
        const originalHTML = btnEl.innerHTML;
        const originalDisabled = btnEl.disabled;

        try {
            // Confirmation before disabling button to avoid "stuck" disabled state if user cancels
            if (confirmFirst) {
                const confirmed = typeof window.showLogoutConfirm === 'function'
                    ? await window.showLogoutConfirm()
                    : window.confirm('Êtes-vous sûr de vouloir fermer votre session ?');
                if (!confirmed) return;
            }

            btnEl.disabled = true;
            btnEl.innerHTML = `
                <iconify-icon icon="line-md:loading-twotone-loop" width="18"></iconify-icon>
                <span>Déconnexion...</span>
            `;

            await this.logout(false); // We already confirmed
        } catch (err) {
            console.error('[NewKet Auth] Logout click handler error:', err);
            // Revert button if something catastrophic happened before redirect
            btnEl.disabled = originalDisabled;
            btnEl.innerHTML = originalHTML;
        }
    },

    async logout(confirmFirst = false, reason = 'Utilisateur/Système') {
        // Robustness: if first arg is a string, it's actually the reason
        if (typeof confirmFirst === 'string') {
            reason = confirmFirst;
            confirmFirst = false;
        }

        if (confirmFirst) {
            const confirmed = await window.showLogoutConfirm();
            if (!confirmed) return;
        }

        if (this._logoutInProgress) {
            console.warn('[NewKet Auth] Logout already in progress.');
            return;
        }

        this._logoutInProgress = true;

        console.warn(`[NewKet Auth] Logout triggered. Reason: ${reason}`);
        
        // --- 1. Immediate UI Feedback ---
        if (typeof showToast === 'function') {
            showToast('Déconnexion réussie. À bientôt !', 'success');
        }

        // --- 2. Clean Up Internal State & Storage ---
        // Do this immediately so even if redirect fails, the user is locally logged out.
        this.handleLogoutCleanup();

        // --- 3. Supabase SignOut with Fail-safe ---
        try {
            if (window.supabaseClient) {
                // Set a short timeout for Supabase signOut to avoid hanging
                const signoutPromise = window.supabaseClient.auth.signOut();
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Signout Timeout')), 1500));
                
                await Promise.race([signoutPromise, timeoutPromise]).catch(err => {
                    console.warn('[NewKet Auth] Supabase SignOut took too long or failed, forcing UI cleanup.', err);
                });
            }
        } catch (err) {
            console.error('[NewKet Auth] Logout error (Supabase):', err);
        } finally {
            // --- 4. Final Redirection (Snappy) ---
            const loginPath = window.resolvePath('login');
            console.log('[NewKet Auth] Redirecting to:', loginPath);
            
            // Minimal delay to let the user see the "..." state change on the button
            setTimeout(() => {
                window.location.href = loginPath;
            }, 300);
        }
    },

    // --- 🔐 PERIODIC SECURITY VALIDATION ---
    startRoleValidation() {
        if (this._syncInterval) clearInterval(this._syncInterval);
        
        // Validate every 10 minutes to ensure token/role consistency
        this._syncInterval = setInterval(() => {
            this.refreshAndValidateRole();
        }, 1000 * 60 * 10);
    },

    async refreshAndValidateRole() {
        if (!window.supabaseClient) return;
        
        try {
            const session = window.SupabaseAdapter ? await window.SupabaseAdapter.getSession(5000) : null;
            
            if (!session) {
                console.warn('[NewKet Auth] Session invalid or expired during refresh.');
                this.logout(false, 'Session expiree');
                return;
            }

            const { data: { user }, error } = await window.supabaseClient.auth.getUser();
            
            if (error || !user) {
                if (error && error.status >= 500) {
                    console.warn('[NewKet Auth] Supabase server error during refresh validation. Skipping logout for now.');
                    return;
                }
                console.warn('[NewKet Auth] User invalid or missing during refresh.');
                this.logout(false, 'Session expiree ou invalide');
                return;
            }

            const profile = await this.getUserProfile(user.id);
            const newRole = this.resolveRoleFromUser(user) || profile?.role || null;

            if (this.shouldRequireRoleSelection(user, profile) || (!profile && !newRole)) {
                this.markPendingRoleSelection(true);
                this.role = null;
                this.status = null;
                localStorage.removeItem('newketRole');
                localStorage.removeItem('newketUserStatus');
                localStorage.removeItem('newketSellerType');
                this.sellerType = null;
                this.enforcePermissions();
                return;
            }

            if (!newRole) return;

            this.markPendingRoleSelection(false);
            if (newRole !== this.role) {
                console.log(`[NewKet Auth] Role change detected: ${this.role} -> ${newRole}`);
                this.setRole(newRole);
            }
        } catch (err) {
            console.error('[NewKet Auth] Periodic validation failed:', err);
        }
    },

    async completeRoleSelection(role) {
        if (!['customer', 'supplier'].includes(role)) {
            throw new Error('Role invalide.');
        }

        const session = window.SupabaseAdapter ? await window.SupabaseAdapter.getSession(5000) : null;
        const user = session?.user || this.user;

        if (!user?.id || !user?.email) {
            throw new Error('Session introuvable. Veuillez vous reconnecter.');
        }

        const existingProfile = await this.getUserProfile(user.id);
        if (existingProfile?.role) {
            const requiresExplicitConfirmation = this.isOAuthOnlyUser(user) && !this.hasConfirmedRoleSelection(user);
            if (!requiresExplicitConfirmation) {
                this.markPendingRoleSelection(false);
                localStorage.setItem('newketRoleSelectionConfirmed', 'true');
                this.role = existingProfile.role;
                this.status = existingProfile.status || ((existingProfile.role === 'customer' || existingProfile.role === 'admin') ? 'approved' : 'pending');
                this.sellerType = existingProfile.seller_type || (existingProfile.role === 'supplier' ? 'normal' : null);
                if (this.sellerType) localStorage.setItem('newketSellerType', this.sellerType);
                else localStorage.removeItem('newketSellerType');
                window.location.href = this.getRedirectPathForRole(this.role, this.status);
                return;
            }

            const resolvedStatus = role === 'supplier' ? 'pending' : 'approved';
            const updatedProfile = await this.updateExistingProfileRole(user.id, role, resolvedStatus);
            await this.syncRoleSelectionMetadata(user, role, resolvedStatus, updatedProfile?.name || existingProfile.name);

            this.markPendingRoleSelection(false);
            localStorage.setItem('newketRoleSelectionConfirmed', 'true');
            this.role = role;
            this.status = updatedProfile?.status || resolvedStatus;
            this.sellerType = updatedProfile?.seller_type || (role === 'supplier' ? 'normal' : null);
            this.user = user;
            localStorage.setItem('newketRole', this.role);
            localStorage.setItem('newketUserEmail', user.email);
            localStorage.setItem('newketUserId', user.id);
            localStorage.setItem('newketUserStatus', this.status);
            if (this.sellerType) localStorage.setItem('newketSellerType', this.sellerType);
            else localStorage.removeItem('newketSellerType');
            this.setupRealtimeSync(user.id);
            this.enforcePermissions();
            this.updateAccountLink();
            window.location.href = this.getRedirectPathForRole(this.role, this.status);
            return;
        }

        const profile = await this.createUserProfile(user, role);
        await this.syncRoleSelectionMetadata(user, role, profile.status, profile.name);
        this.markPendingRoleSelection(false);
        localStorage.setItem('newketRoleSelectionConfirmed', 'true');
        this.role = profile.role;
        this.status = profile.status;
        this.sellerType = profile.seller_type || (profile.role === 'supplier' ? 'normal' : null);
        this.user = user;
        localStorage.setItem('newketRole', this.role);
        localStorage.setItem('newketUserEmail', user.email);
        localStorage.setItem('newketUserId', user.id);
        localStorage.setItem('newketUserStatus', this.status);
        if (this.sellerType) localStorage.setItem('newketSellerType', this.sellerType);
        else localStorage.removeItem('newketSellerType');
        this.setupRealtimeSync(user.id);
        this.enforcePermissions();
        this.updateAccountLink();
        window.location.href = this.getRedirectPathForRole(this.role, this.status);
    },

    async updateExistingProfileRole(userId, role, status) {
        if (!window.supabaseClient || !userId) {
            throw new Error('Profil introuvable pour enregistrer le rôle.');
        }

        const payload = {
            role,
            status,
            seller_type: role === 'supplier' ? 'normal' : null
        };
        const { data, error } = await window.supabaseClient
            .from('users')
            .update(payload)
            .eq('id', userId)
            .select('id, name, role, status, seller_type')
            .single();

        if (error) {
            throw new Error(error.message || "Impossible d'enregistrer votre choix de rôle.");
        }

        return data;
    },

    async syncRoleSelectionMetadata(user, role, status, fullName = null) {
        if (!window.supabaseClient || !user) return;

        const payload = {
            ...user.user_metadata,
            role,
            status,
            seller_type: role === 'supplier' ? 'normal' : null,
            role_selected: true
        };

        if (fullName) payload.full_name = fullName;

        const { error } = await window.supabaseClient.auth.updateUser({
            data: payload
        });

        if (error) {
            throw new Error(error.message || "Impossible de finaliser la confirmation du rôle.");
        }
    },

    redirectToOnboarding() {
        window.location.href = window.resolvePath('seller-onboarding');
    },

    async adminLogin(email, password) {
        if (!window.supabaseClient) return { error: 'Système non initialisé' };

        const { data, error } = await window.supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) return { error: error.message };

        const user = data.user;
        let role = this.resolveRoleFromUser(user);

        const admins = (window.ADMIN_EMAILS || []).map(e => e.toLowerCase());
        if (user.email && admins.includes(user.email.toLowerCase())) {
            role = 'admin';
        }

        if (role !== 'admin') {
            await window.supabaseClient.auth.signOut();
            return { error: 'Accès non autorisé. Identité admin requise.' };
        }

        return { success: true };
    },

    enforcePermissions() {
        if (this._authChecking) return;

        const path = window.location.pathname;
        const isLoginPage = path.includes('login');
        const isRoleSelectionPage = this.isRoleSelectionPage();
        const hasPendingRoleSelection = this.hasPendingRoleSelection();

        if (hasPendingRoleSelection) {
            if (!isRoleSelectionPage) {
                window.location.href = this.getRoleSelectionPath();
            }
            return;
        }

        if (!this.role && isRoleSelectionPage) {
            window.location.href = window.resolvePath('login');
            return;
        }

        if (this.role && (isLoginPage || isRoleSelectionPage)) {
            const targetPath = this.getRedirectPathForRole(this.role, this.status);

            document.body.style.opacity = '0';
            document.body.style.pointerEvents = 'none';

            const currentHref = window.location.href;
            window.location.href = targetPath;

            window.setTimeout(() => {
                if (window.location.href === currentHref) {
                    document.body.style.opacity = '';
                    document.body.style.pointerEvents = '';
                }
            }, 700);
            return;
        }

        const body = document.body;
        body.classList.add(`role-${this.role}`);
        if (this.status) body.classList.add(`status-${this.status}`);

        // Mobile Nav Visibility
        const isVendor = this.role === 'supplier' || this.role === 'admin';
        document.querySelectorAll('.vendor-nav').forEach(el => el.classList.toggle('hidden', !isVendor));
        document.querySelectorAll('.customer-nav').forEach(el => el.classList.toggle('hidden', isVendor));

        // Mobile Menu Toggles (Guest vs Auth)
        const isLoggedIn = this.role !== null;
        const guestCTA = document.getElementById('mobileGuestCTA');
        const loggedCTA = document.getElementById('mobileLoggedCTA');
        const logoutBtn = document.getElementById('mobileLogoutBtn');

        if (guestCTA) guestCTA.style.display = isLoggedIn ? 'none' : 'block';
        if (loggedCTA) loggedCTA.style.display = isLoggedIn ? 'block' : 'none';
        if (logoutBtn) logoutBtn.style.display = isLoggedIn ? 'flex' : 'none';

        if (this.role === 'supplier' || this.role === 'admin') {
            const isAdmin = this.role === 'admin';

            document.querySelectorAll('.sidebar-link').forEach(link => {
                const text = link.textContent.trim();
                if (isAdmin) {
                    if (text.includes('Mes Produits')) link.innerHTML = '<iconify-icon icon="solar:box-bold" width="20"></iconify-icon> Gestion Produits';
                    if (text.includes('Commandes') && text === 'Commandes') link.innerHTML = '<iconify-icon icon="solar:bag-bold" width="20"></iconify-icon> Gestion Commandes';
                    if (text.includes('Mes Clients')) link.innerHTML = '<iconify-icon icon="solar:users-group-rounded-bold" width="20"></iconify-icon> Clients Plateforme';
                    if (text.includes('Calcul des Profits')) link.innerHTML = '<iconify-icon icon="solar:wad-of-money-bold" width="20"></iconify-icon> Profits Plateforme';
                    if (text === 'Utilisateurs') link.innerHTML = '<iconify-icon icon="solar:user-bold" width="20"></iconify-icon> Fournisseurs Plateforme';
                }
            });

            document.querySelectorAll('.admin-only').forEach(el => {
                el.style.display = isAdmin ? '' : 'none';
            });
        }

        if (this.role === 'admin') {
            // Admin has access to everything
            document.querySelectorAll('.publish-btn, .supplier-only, .admin-only').forEach(el => {
                el.style.display = '';
            });

            // Safeguard: Redirect admin away from supplier-only pages (onboarding) if landed there by error
            if (window.location.pathname.includes('seller-onboarding')) {
                window.location.href = window.resolvePath('admin/');
                return;
            }
            
            return;
        }

        if (this.role === 'supplier') {
            // KYC Enforcement
            const isApproved = this.status === 'approved';
            const isSubmitted = this.status === 'submitted'; // Form filled, waiting for admin
            const isPending = this.status === 'pending' || !this.status; // Never filled the form
            
            const path = window.location.pathname;
            const isOnboardingPage = path.includes('seller-onboarding');

            if (isPending) {
                // Determine if we are on a protected vendor-only page
                const isDashboard = path.includes('vendor-dashboard');
                const isPublish = path.includes('publish');

                if (isDashboard || isPublish) {
                    window.location.href = window.resolvePath('seller-onboarding');
                    return;
                }
            } else if (isApproved && isOnboardingPage) {
                // Redirect verified vendors away from onboarding to their dashboard
                window.location.href = window.resolvePath('vendor-dashboard');
                return;
            } else if (isSubmitted) {
                if (isOnboardingPage) {
                    window.location.href = window.resolvePath('vendor-dashboard');
                    return;
                }
                // Form submitted, waiting for admin to review — show notice
                this.showPendingNotice();
            } else if (this.status === 'rejected') {
                this.showRejectedNotice();
            }

            if (path.includes('/admin/')) {
                window.location.href = window.resolvePath('vendor-dashboard');
            }
        }

        if (this.role === 'customer') {
            document.querySelectorAll('.publish-btn, .supplier-only').forEach(el => {
                el.style.display = 'none';
            });

            if (window.location.pathname.includes('/admin/')) {
                window.location.href = window.resolvePath('customer-dashboard');
            }

            if (window.location.pathname.includes('publish') || window.location.pathname.includes('vendor-dashboard')) {
                window.location.href = '/index';
            }
        }

        // If still initializing, don't enforce yet to avoid race conditions
        if (!this._initialized) {
            return;
        }

        if (this.role === null) {
            if (this._logoutInProgress) {
                return;
            }
            const path = window.location.pathname;
            const isProtectedPage = path.includes('/admin/') || 
                                   path.includes('dashboard') || 
                                   path.includes('publish') ||
                                   path.includes('settings') ||
                                   path.includes('achat');
            const isLoginPage = path.includes('login');

            if (isProtectedPage && !isLoginPage) {
                console.error('[NewKet Auth] Access denied: No active role on protected page.');
                this.logout(false, 'Session ou rôle manquant sur page protégée');
                return;
            }
        }
    },

    updateAccountLink() {
        const accountLinks = document.querySelectorAll('#accountLink, #accountLinkMobile, #accountLinkTablet, #accountLinkFooter, #mobileBottomAccountCustomer, #mobileBottomAccountVendor');
        if (accountLinks.length === 0) return;

        const avatarUrl = localStorage.getItem('newketUserAvatar');
        const profile = window.ProfileManager ? window.ProfileManager.getProfile() : {};
        const displayName = profile.name || localStorage.getItem('newketUserName') || 'Mon Compte';
        const initials = typeof window.getInitials === 'function' ? window.getInitials(displayName) : (displayName?.trim()?.charAt(0)?.toUpperCase() || '?');
        const hideAccountIcon = (icon) => {
            if (!icon) return;
            icon.style.display = 'none';
            icon.classList.add('hidden');
            icon.setAttribute('aria-hidden', 'true');
        };

        const showAccountIcon = (icon) => {
            if (!icon) return;
            icon.style.display = 'block';
            icon.classList.remove('hidden');
            icon.removeAttribute('aria-hidden');
        };

        const renderInitials = (accountLink, icon, text) => {
            hideAccountIcon(icon);

            const img = accountLink.querySelector('.nav-user-avatar');
            if (img) img.style.display = 'none';

            let initialsBadge = accountLink.querySelector('.nav-user-initials');
            if (!initialsBadge) {
                initialsBadge = document.createElement('span');
                initialsBadge.className = 'nav-user-initials';
                accountLink.appendChild(initialsBadge);
            }

            initialsBadge.textContent = text;
            initialsBadge.style.display = 'flex';
            return initialsBadge;
        };

        accountLinks.forEach(accountLink => {
            const icon = accountLink.querySelector('iconify-icon');
            const isFooterLink = accountLink.id === 'accountLinkFooter';
            let initialsBadge = accountLink.querySelector('.nav-user-initials');

            if (avatarUrl && !isFooterLink) {
                if (initialsBadge) initialsBadge.remove();
                hideAccountIcon(icon);
                let img = accountLink.querySelector('.nav-user-avatar');
                if (!img) {
                    img = document.createElement('img');
                    img.className = 'nav-user-avatar w-7 h-7 object-cover rounded-full';
                    img.crossOrigin = 'anonymous';
                    img.referrerPolicy = 'no-referrer';
                    accountLink.appendChild(img);
                }
                img.alt = 'Photo de profil';
                img.onerror = () => {
                    img.style.display = 'none';
                    renderInitials(accountLink, icon, initials);
                    localStorage.removeItem('newketUserAvatar');
                };
                // Avoid re-setting src if unchanged (prevents flicker)
                if (img.src !== avatarUrl) {
                    img.src = avatarUrl;
                }
                img.style.display = 'block';
            } else if (!isFooterLink) {
                const existingImg = accountLink.querySelector('.nav-user-avatar');
                if (existingImg) existingImg.style.display = 'none';
                initialsBadge = renderInitials(accountLink, icon, initials);
            }

            if (this.role === 'admin') {
                accountLink.href = window.resolvePath('admin/');
                accountLink.title = 'Dashboard Admin';
                if (icon) {
                    icon.setAttribute('icon', 'solar:user-bold');
                    icon.className = 'text-gray-900';
                }
                // Removed bg-gray-900 for a cleaner look with avatars
                accountLink.classList.remove('text-white');

                let badge = accountLink.querySelector('.role-badge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'role-badge absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white';
                    badge.title = 'Admin';
                    accountLink.appendChild(badge);
                }
                badge.style.display = 'block';

                if (accountLink.id.includes('mobileBottomAccount')) {
                    accountLink.classList.add('text-gray-900');
                    accountLink.classList.remove('text-gray-400');
                    if (accountLink.querySelector('iconify-icon')) {
                        accountLink.querySelector('iconify-icon').setAttribute('icon', 'solar:user-bold');
                    }
                }

            } else if (this.role === 'supplier') {
                accountLink.href = window.resolvePath('vendor-dashboard');
                accountLink.title = 'Tableau de bord Vendeur';
                if (icon) {
                    icon.setAttribute('icon', 'solar:user-bold');
                    icon.className = 'text-gray-900';
                }
                // Retrait du fond gris pour garder l'icône transparente
                let badge = accountLink.querySelector('.role-badge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'role-badge absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-500 rounded-full border-2 border-white';
                    badge.title = 'Vendeur';
                    accountLink.appendChild(badge);
                }
                badge.style.display = 'block';

            } else if (this.role === 'customer') {
                accountLink.href = window.resolvePath('customer-dashboard');
                accountLink.title = 'Mon Espace';
                if (icon) {
                    icon.setAttribute('icon', 'solar:user-bold');
                    icon.className = 'text-gray-900';
                }
                // Retrait du fond gris pour garder l'icône transparente
                let badge = accountLink.querySelector('.role-badge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'role-badge absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white';
                    badge.title = 'Connecté';
                    accountLink.appendChild(badge);
                }
                badge.style.display = 'block';

                if (accountLink.id.includes('mobileBottomAccount')) {
                    accountLink.classList.add('text-gray-900');
                    accountLink.classList.remove('text-gray-400');
                    if (accountLink.querySelector('iconify-icon')) {
                        accountLink.querySelector('iconify-icon').setAttribute('icon', 'solar:user-bold');
                    }
                }

            } else {
                accountLink.href = window.resolvePath('login');
                accountLink.title = 'Se connecter';
                if (icon) {
                    icon.setAttribute('icon', 'solar:user-linear');
                    icon.className = 'text-gray-600';
                    showAccountIcon(icon);
                }
                const existingImg = accountLink.querySelector('.nav-user-avatar');
                if (existingImg) existingImg.style.display = 'none';
                accountLink.classList.remove('bg-gray-900', 'bg-gray-100', 'text-white', 'bg-white');
                accountLink.classList.add('hover:bg-gray-50');
                const badge = accountLink.querySelector('.role-badge');
                if (badge) badge.style.display = 'none';
                if (initialsBadge) initialsBadge.remove();

                // Ensure mobile cta reflects guest status if needed
                const guestCTA = document.getElementById('mobileGuestCTA');
                const loggedCTA = document.getElementById('mobileLoggedCTA');
                const logoutBtn = document.getElementById('mobileLogoutBtn');
                if (guestCTA) guestCTA.style.display = 'block';
                if (loggedCTA) loggedCTA.style.display = 'none';
                if (logoutBtn) logoutBtn.style.display = 'none';
            }
        });

        // Update Mobile Logged CTA Details
        const loggedLink = document.getElementById('mobileLoggedLink');
        const loggedName = document.getElementById('mobileLoggedName');
        const loggedRole = document.getElementById('mobileLoggedRole');
        const loggedAvatar = document.getElementById('mobileLoggedAvatar');
        const loggedIcon = document.getElementById('mobileLoggedIcon');

        if (loggedLink) {
            let userName = 'Mon Compte';
            if (window.ProfileManager) {
                const p = window.ProfileManager.getProfile();
                if (p && p.name) userName = p.name;
            }

            if (this.role === 'admin') {
                loggedLink.href = window.resolvePath('admin/');
                if (loggedName) loggedName.textContent = userName;
                if (loggedRole) loggedRole.textContent = 'Administrateur';
            } else if (this.role === 'supplier') {
                loggedLink.href = window.resolvePath('vendor-dashboard');
                // Fetch company if available, fallback to user name
                const companyName = localStorage.getItem('newketCompany') || userName;
                if (loggedName) loggedName.textContent = companyName;
                if (loggedRole) loggedRole.textContent = 'Vendeur Premium';
            } else {
                loggedLink.href = window.resolvePath('customer-dashboard');
                if (loggedName) loggedName.textContent = userName;
                if (loggedRole) loggedRole.textContent = 'Membre NewKet';
            }

            if (avatarUrl && loggedAvatar) {
                loggedAvatar.crossOrigin = 'anonymous';
                loggedAvatar.referrerPolicy = 'no-referrer';
                loggedAvatar.onerror = () => {
                    loggedAvatar.classList.add('hidden');
                    if (loggedIcon) loggedIcon.classList.remove('hidden');
                    localStorage.removeItem('newketUserAvatar');
                };
                if (loggedAvatar.src !== avatarUrl) {
                    loggedAvatar.src = avatarUrl;
                }
                loggedAvatar.classList.remove('hidden');
                if (loggedIcon) loggedIcon.classList.add('hidden');
            } else if (loggedAvatar) {
                loggedAvatar.classList.add('hidden');
                if (loggedIcon) loggedIcon.classList.remove('hidden');
            }
        }
    },

    async changePassword(currentPassword, newPassword) {
        if (!window.supabaseClient) {
            throw new Error('Supabase non initialise.');
        }
        let email = this.user?.email;
        if (!email) {
            const { data, error } = await window.supabaseClient.auth.getUser();
            if (error) throw error;
            email = data?.user?.email || null;
        }
        if (!email) {
            throw new Error('Utilisateur non authentifie.');
        }
        if (!this.requiresCurrentPassword()) {
            if (!newPassword) {
                throw new Error('Parametres invalides.');
            }
            const { error: updateError } = await window.supabaseClient.auth.updateUser({
                password: newPassword
            });
            if (updateError) {
                throw updateError;
            }
            return true;
        }
        if (!currentPassword || !newPassword) {
            throw new Error('Parametres invalides.');
        }

        // Re-authenticate to ensure the current password is correct
        const { error: signInError } = await window.supabaseClient.auth.signInWithPassword({
            email,
            password: currentPassword
        });
        if (signInError) {
            throw new Error('Mot de passe actuel incorrect.');
        }

        const { error: updateError } = await window.supabaseClient.auth.updateUser({
            password: newPassword
        });
        if (updateError) {
            throw updateError;
        }

        return true;
    },

    showPendingNotice() {
        if (document.getElementById('kyc-notice')) return;
        const notice = document.createElement('div');
        notice.id = 'kyc-notice';
        notice.className = 'fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[100] bg-yellow-50 border border-yellow-200 p-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-slide-up';
        notice.innerHTML = `
            <div class="w-12 h-12 bg-yellow-400/20 text-yellow-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <iconify-icon icon="solar:clock-circle-bold" width="24"></iconify-icon>
            </div>
            <div class="flex-1">
                <div class="text-sm font-black text-gray-900 leading-tight">Profil vendeur en attente</div>
                <div class="text-[10px] text-gray-500 font-medium mb-2">Veuillez finaliser votre dossier pour vendre.</div>
                <a href="${window.resolvePath('seller-onboarding')}" class="text-[11px] font-bold text-yellow-600 underline">Compléter mon profil</a>
            </div>
            <button onclick="this.parentElement.remove()" class="text-gray-400 hover:text-gray-900">
                <iconify-icon icon="solar:close-circle-bold"></iconify-icon>
            </button>
        `;
        document.body.appendChild(notice);
    },

    showRejectedNotice() {
        if (document.getElementById('kyc-notice')) return;
        const notice = document.createElement('div');
        notice.id = 'kyc-notice';
        notice.className = 'fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[100] bg-red-50 border border-red-200 p-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-slide-up';
        notice.innerHTML = `
            <div class="w-12 h-12 bg-red-400/20 text-red-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <iconify-icon icon="solar:danger-bold" width="24"></iconify-icon>
            </div>
            <div class="flex-1">
                <div class="text-sm font-black text-gray-900 leading-tight">Profil vendeur rejeté</div>
                <div class="text-[10px] text-gray-500 font-medium mb-2">Veuillez contacter le support pour plus d'infos.</div>
                <a href="${window.resolvePath('seller-onboarding')}" class="text-[11px] font-bold text-red-600 underline">Soumettre à nouveau</a>
            </div>
            <button onclick="this.parentElement.remove()" class="text-gray-400 hover:text-gray-900">
                <iconify-icon icon="solar:close-circle-bold"></iconify-icon>
            </button>
        `;
        document.body.appendChild(notice);
    }
};

window.AuthManager = AuthManager;

