/* newket EMarket Auth Manager */
/**
 * Rôle interne: 'supplier'. Label UI: 'Vendeur'.
 * Rôle interne: 'customer'. Label UI: 'Client'.
 * Rôle interne: 'admin'. Label UI: 'Administrateur'.
 */
// Admin email list is now centralized in admin-config.js (synchronous script)
const ADMIN_EMAILS = window.ADMIN_EMAILS || [];

const AuthManager = {
    role: null,
    status: null, // Status KYC : pending (jamais soumis), submitted (en attente validation), approved, rejected
    user: null, // Supabase user object for pages like settings.html
    _authChecking: true, // Start as true to block UI
    _initialized: false,
    _realtimeChannel: null,
    _syncInterval: null,

    async init() {
        this._authChecking = true;

        // --- GLOBAL FAIL-SAFE ---
        // Force-remove loading screen after 5s regardless of what happens
        setTimeout(() => {
            if (this._authChecking) {
                console.warn('[NewKet Auth] Fail-safe: Forcefully removing loading screen.');
                document.documentElement.classList.remove('auth-loading');
                this._authChecking = false;
            }
        }, 5000);
        
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
        const email = user.email;
        
        // --- 🛡️ SECURE ROLE RESOLUTION ---
        // Priority 1: app_metadata (Controlled strictly by server/admin)
        // Priority 2: window.ADMIN_EMAILS (Hardcoded whitelist)
        // Priority 3: user_metadata (Legacy/User-set - fallback only)
        
        let role = (user.app_metadata && user.app_metadata.role) || user.user_metadata.role || 'customer';

        const admins = (window.ADMIN_EMAILS || []).map(e => e.toLowerCase());
        if (email && admins.includes(email.toLowerCase())) {
            role = 'admin';
        }

        this.role = role;
        localStorage.setItem('newketRole', role);
        localStorage.setItem('newketUserEmail', email);
        localStorage.setItem('newketUserId', user.id);

        // --- 🖼️ AVATAR RESOLUTION (Priority: DB > OAuth metadata) ---
        // Always refresh the OAuth avatar URL from user metadata (Google may rotate URLs).
        const oauthAvatar = user.user_metadata.avatar_url || user.user_metadata.picture || null;
        try {
            if (window.supabaseClient) {
                const { data: profile } = await window.supabaseClient
                    .from('users')
                    .select('avatar')
                    .eq('id', user.id)
                    .maybeSingle();
                const dbAvatar = profile?.avatar || null;
                // If user has a custom DB avatar, use that. Otherwise always use fresh OAuth URL.
                const resolvedAvatar = dbAvatar || oauthAvatar;
                if (resolvedAvatar) {
                    localStorage.setItem('newketUserAvatar', resolvedAvatar);
                } else {
                    localStorage.removeItem('newketUserAvatar');
                }
                // Keep the DB avatar in sync with the latest OAuth picture (if no custom upload)
                if (!dbAvatar && oauthAvatar && profile) {
                    window.supabaseClient
                        .from('users')
                        .update({ avatar: oauthAvatar })
                        .eq('id', user.id)
                        .then(() => {})
                        .catch(() => {});
                }
            } else if (oauthAvatar) {
                localStorage.setItem('newketUserAvatar', oauthAvatar);
            }
        } catch (_) {
            if (oauthAvatar) localStorage.setItem('newketUserAvatar', oauthAvatar);
        }

        // --- 🛡️ AUTO-PROFILE CREATION (Skill 5 & 6) ---
        // Verify if user exists in the 'users' table, if not, create it.
        const profileExists = await this.checkProfile(user.id);
        if (!profileExists) {
            console.log('[NewKet Auth] New user detected, creating database profile...');
            const fullName = user.user_metadata.full_name || user.user_metadata.name || email.split('@')[0];
            const avatarUrl = localStorage.getItem('newketUserAvatar');
            
            const newProfile = {
                id: user.id,
                email: email,
                name: fullName,
                avatar: avatarUrl,
                role: role,
                status: (role === 'customer' || role === 'admin') ? 'approved' : 'pending'
            };

            const success = await window.SupabaseAdapter.upsert('users', newProfile);
            if (!success) {
                console.error('[NewKet Auth] Failed to create profile. User might have limited access.');
            }
        }

        this.status = await this.fetchUserStatus(email);
        localStorage.setItem('newketUserStatus', this.status);

        this.setupRealtimeSync(user.id);
        this.enforcePermissions();
        // Refresh avatar in the header now that DB data is loaded
        this.updateAccountLink();

        if (window.FavoritesManager) window.FavoritesManager.syncFromSupabase();
        if (window.ProfileManager) window.ProfileManager.syncWithSupabase();
        
        // Finalize initialization
        this._authChecking = false;
        this._initialized = true;
        document.documentElement.classList.remove('auth-loading');
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

    async checkProfile(userId) {
        if (!window.supabaseClient || !userId) return false;
        try {
            const { data, error } = await window.supabaseClient
                .from('users')
                .select('id')
                .eq('id', userId)
                .maybeSingle();
            
            if (error) {
                console.error('[NewKet Auth] Database error during profile check:', error);
                return false;
            }
            
            return !!data;
        } catch (err) {
            console.error('[NewKet Auth] Unexpected error checking profile:', err);
            return false;
        }
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
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // Clear specific non-prefixed session keys
        sessionStorage.removeItem('adminAuth');
        localStorage.removeItem('supabase.auth.token'); // Fallback for old tokens if any
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
        
        const originalHTML = btnEl.innerHTML;
        const originalDisabled = btnEl.disabled;

        try {
            // Confirmation before disabling button to avoid "stuck" disabled state if user cancels
            if (confirmFirst) {
                const confirmed = await window.showLogoutConfirm();
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
        if (confirmFirst) {
            const confirmed = await window.showLogoutConfirm();
            if (!confirmed) return;
        }

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
            // getUser() always calls the server to get fresh data, unlike getSession()
            const { data: { user }, error } = await window.supabaseClient.auth.getUser();
            
            if (error || !user) {
                console.warn('[NewKet Auth] Session invalid or expired during refresh.');
                this.logout('Session expirée');
                return;
            }

            const newRole = (user.app_metadata && user.app_metadata.role) || user.user_metadata.role || 'customer';
            
            if (newRole !== this.role) {
                console.log(`[NewKet Auth] Role change detected: ${this.role} -> ${newRole}`);
                this.setRole(newRole);
            }
        } catch (err) {
            console.error('[NewKet Auth] Periodic validation failed:', err);
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
        let role = user.user_metadata.role || 'customer';

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

        // --- NEW: Bounce logic for users already logged in ---
        if (this.role && isLoginPage) {
            // Zero-flash: Hide body until redirect starts
            document.body.style.opacity = '0';
            document.body.style.pointerEvents = 'none';

            if (this.role === 'admin') {
                window.location.href = window.resolvePath('admin/');
            } else if (this.role === 'supplier') {
                window.location.href = window.resolvePath('vendor-dashboard');
            } else {
                window.location.href = window.resolvePath('customer-dashboard');
            }
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
            const path = window.location.pathname;
            const isProtectedPage = path.includes('/admin/') || 
                                   path.includes('dashboard') || 
                                   path.includes('publish') ||
                                   path.includes('settings');
            const isLoginPage = path.includes('login');

            if (isProtectedPage && !isLoginPage) {
                console.error('[NewKet Auth] Access denied: No active role on protected page.');
                this.logout('Session ou rôle manquant sur page protégée');
                return;
            }
        }
    },

    updateAccountLink() {
        const accountLinks = document.querySelectorAll('#accountLink, #accountLinkMobile, #accountLinkFooter, #mobileBottomAccountCustomer, #mobileBottomAccountVendor');
        if (accountLinks.length === 0) return;

        const avatarUrl = localStorage.getItem('newketUserAvatar');

        accountLinks.forEach(accountLink => {
            const icon = accountLink.querySelector('iconify-icon');

            if (avatarUrl) {
                if (icon) icon.style.display = 'none';
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
                    // URL cassée : masquer l'image et afficher l'icône
                    img.style.display = 'none';
                    if (icon) icon.style.display = 'block';
                    // Nettoyer le cache pour éviter la boucle
                    localStorage.removeItem('newketUserAvatar');
                };
                // Avoid re-setting src if unchanged (prevents flicker)
                if (img.src !== avatarUrl) {
                    img.src = avatarUrl;
                }
                img.style.display = 'block';
            } else {
                if (icon) icon.style.display = 'block';
                const img = accountLink.querySelector('.nav-user-avatar');
                if (img) img.style.display = 'none';
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
                }
                accountLink.classList.remove('bg-gray-900', 'bg-gray-100', 'text-white', 'bg-white');
                accountLink.classList.add('hover:bg-gray-50');
                const badge = accountLink.querySelector('.role-badge');
                if (badge) badge.style.display = 'none';

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
