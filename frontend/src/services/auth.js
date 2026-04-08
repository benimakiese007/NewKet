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
    _authChecking: false,
    _initialized: false, // New flag
    _realtimeChannel: null,

    async init() {
        this._authChecking = true;
        if (window.supabaseClient) {
            window.supabaseClient.auth.onAuthStateChange(async (event, session) => {

                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    const user = session.user;
                    this.user = user; // Store user object for settings page
                    const email = user.email;
                    let role = user.user_metadata.role || 'customer';
                    
                    // Force admin role if email is in ADMIN_EMAILS (from admin-config.js)
                    const admins = (window.ADMIN_EMAILS || []).map(e => e.toLowerCase());
                    if (email && admins.includes(email.toLowerCase())) {
                        role = 'admin';
                    }
                    
                    // L'utilisateur est admin uniquement si son métadata le dit, ou son email figure dans ADMIN_EMAILS.

                    this.role = role;
                    localStorage.setItem('newketRole', role);
                    localStorage.setItem('newketUserEmail', email);
                    localStorage.setItem('newketUserId', user.id);

                    const avatarUrl = user.user_metadata.avatar_url || user.user_metadata.picture || null;
                    if (avatarUrl) localStorage.setItem('newketUserAvatar', avatarUrl);

                    const status = await this.fetchUserStatus(email);
                    this.status = status;
                    localStorage.setItem('newketUserStatus', status);

                    this.setupRealtimeSync(user.id);
                    this.enforcePermissions();

                    if (window.FavoritesManager) FavoritesManager.syncFromSupabase();
                } else if (event === 'SIGNED_OUT') {
                    if (this._realtimeChannel) {
                        window.supabaseClient.removeChannel(this._realtimeChannel);
                        this._realtimeChannel = null;
                    }
                    this.role = null;
                    this.status = null;
                    this.user = null;
                    this.clearSession();
                    this.enforcePermissions();
                    if (window.location.pathname.includes('/admin/') || window.location.pathname.includes('customer-dashboard')) {
                        window.location.href = '/index.html';
                    }
                }
            });

            const { data } = await window.supabaseClient.auth.getSession();
            if (data.session) {
                const user = data.session.user;
                this.user = user; 
                
                const hasProfile = await this.checkProfile(user.id);
                if (!hasProfile) {
                    console.error('[NewKet Auth] No profile found for user:', user.id);
                    this.logout('Profil utilisateur introuvable');
                    return;
                }

                let role = user.user_metadata.role || 'customer';

                // Force admin role if email is in ADMIN_EMAILS (from admin-config.js)
                const admins = (window.ADMIN_EMAILS || []).map(e => e.toLowerCase());
                if (user.email && admins.includes(user.email.toLowerCase())) {
                    role = 'admin';
                }

                // L'utilisateur est admin uniquement si son métadata le dit, ou son email figure dans ADMIN_EMAILS.
                
                this.role = role;
                
                // Ensure localStorage is in sync with session (Fix for Issue 2: Info mixup)
                localStorage.setItem('newketRole', this.role);
                localStorage.setItem('newketUserEmail', user.email);
                localStorage.setItem('newketUserId', user.id);
                
                const avatar = user.user_metadata.avatar_url || user.user_metadata.picture || null;
                if (avatar) localStorage.setItem('newketUserAvatar', avatar);

                this.status = await this.fetchUserStatus(user.email);
                localStorage.setItem('newketUserStatus', this.status);

                this.setupRealtimeSync(user.id);
            } else {
                this.role = null;
                this.status = null;
                this.user = null;
                this.clearSession(); // Ensure old data is wiped if no session
                
                // Pas de bypass autorisé si l'utilisateur n'est pas connecté.
                if (window.location.pathname.includes('/admin/')) {
                    if (!window.location.pathname.includes('login.html') && !window.location.pathname.endsWith('admin/')) {
                        window.location.href = '/index.html';
                    }
                }
            }
        }

        this._authChecking = false;
        this._initialized = true; // Mark as fully initialized
        this.enforcePermissions();
        this.updateAccountLink();
        this.checkWelcomeBonus();

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
        localStorage.removeItem('newketRole');
        localStorage.removeItem('newketUserEmail');
        localStorage.removeItem('newketUserId');
        localStorage.removeItem('newketUserAvatar');
        localStorage.removeItem('newketUserStatus');
        sessionStorage.removeItem('adminAuth');
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

    async logout(reason = 'Utilisateur/Système') {
        console.warn(`[NewKet Auth] Logout triggered. Reason: ${reason}`);
        console.trace('[NewKet Auth] Logout Stack Trace');

        if (window.supabaseClient) {
            await window.supabaseClient.auth.signOut();
        }
        this.role = null;
        this.status = null;
        this.user = null;
        this.clearSession();
        window.location.href = '/pages/login.html';
    },

    redirectToOnboarding() {
        window.location.href = '/pages/seller-onboarding.html';
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
        console.log(`[NewKet Auth] Enforcing permissions for role: ${this.role}, status: ${this.status}`);

        const path = window.location.pathname;
        const isLoginPage = path.includes('login.html');

        // --- NEW: Bounce logic for users already logged in ---
        if (this.role && isLoginPage) {
            console.log('[NewKet Auth] User already logged in, redirecting from login page...');
            // Zero-flash: Hide body until redirect starts
            document.body.style.opacity = '0';
            document.body.style.pointerEvents = 'none';

            if (this.role === 'admin') {
                window.location.href = '/pages/admin/dashboard.html';
            } else if (this.role === 'supplier') {
                window.location.href = '/pages/vendor-dashboard.html';
            } else {
                window.location.href = '/pages/customer-dashboard.html';
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
            if (window.location.pathname.includes('seller-onboarding.html')) {
                window.location.href = '/pages/admin/dashboard.html';
                return;
            }
            
            return;
        }

        if (this.role === 'supplier') {
            // KYC Enforcement
            const isApproved = this.status === 'approved';
            const isSubmitted = this.status === 'submitted'; // Form filled, waiting for admin
            const isPending = this.status === 'pending' || !this.status; // Never filled the form

            if (isPending) {
                // Determine if we are on a protected vendor-only page
                const path = window.location.pathname;
                const isDashboard = path.includes('vendor-dashboard.html');
                const isPublish = path.includes('publish.html');

                // On n'empêche plus l'accès, mais on laisse le "CORRECTIF C" tourner en arrière-plan
                // Pour rafraîchir le statut dès que possible au cas où Supabase Realtime a eu un souci
                const email = this.user?.email || localStorage.getItem('newketUserEmail');
                if (email && (isDashboard || isPublish)) {
                    this.fetchUserStatus(email).then(freshStatus => {
                        if (freshStatus !== this.status) {
                            const oldStatus = this.status;
                            this.status = freshStatus;
                            localStorage.setItem('newketUserStatus', freshStatus);
                            this.enforcePermissions();
                            if (oldStatus !== 'approved' && freshStatus === 'approved') {
                                if (typeof showToast === 'function') showToast('Votre profil a été approuvé !', 'success');
                            }
                        }
                    });
                }
            } else if (isSubmitted) {
                // Form submitted, waiting for admin to review — show notice
                this.showPendingNotice();
            } else if (this.status === 'rejected') {
                this.showRejectedNotice();
            }

            if (window.location.pathname.includes('/admin/')) {
                window.location.href = '/pages/vendor-dashboard.html';
            }
        }

        if (this.role === 'customer') {
            document.querySelectorAll('.publish-btn, .supplier-only').forEach(el => {
                el.style.display = 'none';
            });

            if (window.location.pathname.includes('/admin/')) {
                window.location.href = '/pages/customer-dashboard.html';
            }

            if (window.location.pathname.includes('publish.html') || window.location.pathname.includes('vendor-dashboard.html')) {
                window.location.href = '/index.html';
            }
        }

        // If still initializing, don't enforce yet to avoid race conditions
        if (!this._initialized) {
            console.log('[NewKet Auth] Skipping enforcement: Initialization in progress.');
            return;
        }

        if (this.role === null) {
            const path = window.location.pathname;
            const isProtectedPage = path.includes('/admin/') || 
                                   path.includes('dashboard.html') || 
                                   path.includes('publish.html') ||
                                   path.includes('settings.html');
            const isLoginPage = path.includes('login.html');

            if (isProtectedPage && !isLoginPage) {
                console.error('[NewKet Auth] Access denied: No active role on protected page.');
                this.logout('Session ou rôle manquant sur page protégée');
                return;
            }
        }
    },

    updateAccountLink() {
        const accountLinks = document.querySelectorAll('#accountLink, #mobileBottomAccountCustomer, #mobileBottomAccountVendor');
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
                    accountLink.appendChild(img);
                }
                img.src = avatarUrl;
                img.style.display = 'block';
            } else {
                if (icon) icon.style.display = 'block';
                const img = accountLink.querySelector('.nav-user-avatar');
                if (img) img.style.display = 'none';
            }

            if (this.role === 'admin') {
                accountLink.href = '/pages/admin/dashboard.html';
                accountLink.title = 'Dashboard Admin';
                if (icon) {
                    icon.setAttribute('icon', 'solar:user-bold');
                    icon.className = 'text-white';
                }
                accountLink.classList.add('bg-gray-900', 'text-white');
                accountLink.classList.remove('hover:bg-gray-50');

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
                accountLink.href = '/pages/vendor-dashboard.html';
                accountLink.title = 'Tableau de bord Vendeur';
                if (icon) {
                    icon.setAttribute('icon', 'solar:user-bold');
                    icon.className = 'text-gray-900';
                }
                accountLink.classList.add('bg-gray-100');
                accountLink.classList.remove('hover:bg-gray-50');
                let badge = accountLink.querySelector('.role-badge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'role-badge absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-500 rounded-full border-2 border-white';
                    badge.title = 'Vendeur';
                    accountLink.appendChild(badge);
                }
                badge.style.display = 'block';

            } else if (this.role === 'customer') {
                accountLink.href = '/pages/customer-dashboard.html';
                accountLink.title = 'Mon Espace';
                if (icon) {
                    icon.setAttribute('icon', 'solar:user-bold');
                    icon.className = 'text-gray-900';
                }
                accountLink.classList.add('bg-gray-100');
                accountLink.classList.remove('hover:bg-gray-50');
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
                accountLink.href = '/pages/login.html';
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
                loggedLink.href = '/pages/admin/dashboard.html';
                if (loggedName) loggedName.textContent = userName;
                if (loggedRole) loggedRole.textContent = 'Administrateur';
            } else if (this.role === 'supplier') {
                loggedLink.href = '/pages/vendor-dashboard.html';
                // Fetch company if available, fallback to user name
                const companyName = localStorage.getItem('newketCompany') || userName;
                if (loggedName) loggedName.textContent = companyName;
                if (loggedRole) loggedRole.textContent = 'Vendeur Premium';
            } else {
                loggedLink.href = '/pages/customer-dashboard.html';
                if (loggedName) loggedName.textContent = userName;
                if (loggedRole) loggedRole.textContent = 'Membre NewKet';
            }

            if (avatarUrl && loggedAvatar) {
                loggedAvatar.src = avatarUrl;
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
                <a href="/pages/seller-onboarding.html" class="text-[11px] font-bold text-yellow-600 underline">Compléter mon profil</a>
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
                <a href="/pages/seller-onboarding.html" class="text-[11px] font-bold text-red-600 underline">Soumettre à nouveau</a>
            </div>
            <button onclick="this.parentElement.remove()" class="text-gray-400 hover:text-gray-900">
                <iconify-icon icon="solar:close-circle-bold"></iconify-icon>
            </button>
        `;
        document.body.appendChild(notice);
    }
};

window.AuthManager = AuthManager;
