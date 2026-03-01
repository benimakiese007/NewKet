/* newket EMarket Auth Manager */

const AuthManager = {
    role: null,
    _authChecking: true, // Prevents redirect loops while checking auth

    async init() {
        this._authChecking = true; // Set flag: auth check in progress
        // Subscribe to auth state changes
        if (window.supabaseClient) {
            window.supabaseClient.auth.onAuthStateChange((event, session) => {
                console.log('Auth State Change:', event, session);

                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    const user = session.user;
                    const role = user.user_metadata.role || 'customer';
                    const email = user.email;
                    const avatarUrl = user.user_metadata.avatar_url || user.user_metadata.picture || null;

                    // Admin Override Logic
                    const adminEmails = (window.ADMIN_EMAILS || []).map(e => e.toLowerCase());
                    let finalRole = role;
                    if (adminEmails.includes(email.toLowerCase())) {
                        finalRole = 'admin';
                    }

                    // Sync LocalStorage
                    if (localStorage.getItem('newketRole') !== finalRole) {
                        this.setRole(finalRole);
                    }
                    if (localStorage.getItem('newketUserEmail') !== email) {
                        localStorage.setItem('newketUserEmail', email);
                    }
                    if (avatarUrl) {
                        localStorage.setItem('newketUserAvatar', avatarUrl);
                    }

                    // Sync cart and favorites from Supabase on login
                    if (window.CartManager) CartManager.syncFromSupabase();
                    if (window.FavoritesManager) FavoritesManager.syncFromSupabase();
                } else if (event === 'SIGNED_OUT') {
                    this.role = null;
                    localStorage.removeItem('newketRole');
                    localStorage.removeItem('newketUserEmail');
                    localStorage.removeItem('newketUserAvatar');
                    this.enforcePermissions();
                    this.updateAccountLink();
                    // Redirect to home if on protected page
                    if (window.location.pathname.includes('/admin/') || window.location.pathname.includes('customer-dashboard')) {
                        window.location.href = '../index.html';
                    }
                }
            });

            // Initial Check
            const { data } = await window.supabaseClient.auth.getSession();
            if (data.session) {
                const user = data.session.user;
                const role = user.user_metadata.role || 'customer';

                const adminEmails = (window.ADMIN_EMAILS || []).map(e => e.toLowerCase());
                let finalRole = role;
                if (adminEmails.includes(user.email.toLowerCase())) {
                    finalRole = 'admin';
                }

                const avatarUrl = user.user_metadata.avatar_url || user.user_metadata.picture || null;
                if (avatarUrl) {
                    localStorage.setItem('newketUserAvatar', avatarUrl);
                }

                this.setRole(finalRole);
            } else {
                // No Supabase session — but respect the localStorage role if admin auth was done via PHOENIX password
                const localRole = localStorage.getItem('newketRole');
                const adminAuth = sessionStorage.getItem('adminAuth') === 'true';
                if (!localRole || (!adminAuth && localRole === 'admin')) {
                    this.setRole(null);
                }
            }
        }

        this._authChecking = false; // Auth check done
        this.enforcePermissions();
        this.updateAccountLink();
        this.checkWelcomeBonus();
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
                showToast('Bienvenue ! 0% de commission sur votre première vente', 'success');
            }
            localStorage.removeItem('newketSupplierBonus');
        }
    },

    getRole() {
        return this.role;
    },

    setRole(role) {
        this.role = role;
        localStorage.setItem('newketRole', role);
        this.enforcePermissions();
        this.updateAccountLink();

        // Dispatch event
        window.dispatchEvent(new CustomEvent('roleChanged', { detail: { role } }));
    },

    async logout() {
        if (window.supabaseClient) {
            await window.supabaseClient.auth.signOut();
        }
        this.role = null;
        localStorage.removeItem('newketRole');
        localStorage.removeItem('newketUserEmail');
        localStorage.removeItem('newketUserAvatar');
        window.location.href = 'index.html';
    },

    enforcePermissions() {
        if (this._authChecking) return;

        const body = document.body;
        body.classList.add(`role-${this.role}`);

        if (this.role === 'supplier' || this.role === 'admin') {
            const isAdmin = this.role === 'admin';

            document.querySelectorAll('.sidebar-link').forEach(link => {
                const text = link.textContent.trim();
                if (isAdmin) {
                    if (text.includes('Mes Produits')) link.innerHTML = '<iconify-icon icon="solar:box-bold" width="20"></iconify-icon> Gestion Produits';
                    if (text.includes('Commandes') && text === 'Commandes') link.innerHTML = '<iconify-icon icon="solar:cart-large-bold" width="20"></iconify-icon> Gestion Commandes';
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
            document.querySelectorAll('.publish-btn, .supplier-only, .admin-only').forEach(el => {
                el.style.display = '';
            });
            return;
        }

        if (this.role === 'supplier') {
            document.querySelectorAll('.cart-trigger, .add-to-cart-btn, #cart-count').forEach(el => {
                el.style.display = '';
            });

            if (window.location.pathname.includes('/admin/')) {
                window.location.href = '../vendor-dashboard.html';
            }
        }

        if (this.role === 'customer') {
            document.querySelectorAll('.cart-trigger, .add-to-cart-btn, #cart-count').forEach(el => {
                el.style.display = '';
            });
            document.querySelectorAll('.publish-btn, .supplier-only').forEach(el => {
                el.style.display = 'none';
            });

            if (window.location.pathname.includes('/admin/')) {
                window.location.href = '../customer-dashboard.html';
            }

            if (window.location.pathname.includes('publish.html')) {
                window.location.href = 'index.html';
            }
        }

        if (this.role === null) {
            const path = window.location.pathname;
            const isAdminFolder = path.includes('/admin/');
            const isLoginPage = path.endsWith('/admin/') || path.endsWith('index.html');

            if (isAdminFolder && !isLoginPage) {
                window.location.href = 'index.html';
            }
        }
    },

    updateAccountLink() {
        const accountLinks = document.querySelectorAll('#accountLink, #mobileBottomAccount');
        if (accountLinks.length === 0) return;

        const avatarUrl = localStorage.getItem('newketUserAvatar');

        accountLinks.forEach(accountLink => {
            const icon = accountLink.querySelector('iconify-icon');

            if (avatarUrl) {
                if (icon) icon.style.display = 'none';
                let img = accountLink.querySelector('.nav-user-avatar');
                if (!img) {
                    img = document.createElement('img');
                    img.className = 'nav-user-avatar w-6 h-6 sm:w-full sm:h-full object-cover rounded-full';
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
                accountLink.href = 'admin/dashboard.html';
                accountLink.title = 'Admin Panel';
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

                if (accountLink.id === 'mobileBottomAccount') {
                    accountLink.classList.add('text-gray-900');
                    accountLink.classList.remove('text-gray-400');
                    if (accountLink.querySelector('iconify-icon')) {
                        accountLink.querySelector('iconify-icon').setAttribute('icon', 'solar:user-bold');
                    }
                }

            } else if (this.role === 'supplier') {
                accountLink.href = 'vendor-dashboard.html';
                accountLink.title = 'Mon espace vendeur';
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
                accountLink.href = 'customer-dashboard.html';
                accountLink.title = 'Mon compte';
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

                if (accountLink.id === 'mobileBottomAccount') {
                    accountLink.classList.add('text-gray-900');
                    accountLink.classList.remove('text-gray-400');
                    if (accountLink.querySelector('iconify-icon')) {
                        accountLink.querySelector('iconify-icon').setAttribute('icon', 'solar:user-bold');
                    }
                }

            } else {
                accountLink.href = 'login.html';
                accountLink.title = 'Se connecter';
                if (icon) {
                    icon.setAttribute('icon', 'solar:user-linear');
                    icon.className = 'text-gray-600';
                }
                accountLink.classList.remove('bg-gray-900', 'bg-gray-100', 'text-white');
                accountLink.classList.add('hover:bg-gray-50');
                const badge = accountLink.querySelector('.role-badge');
                if (badge) badge.style.display = 'none';
            }
        });
    },
};

window.AuthManager = AuthManager;
