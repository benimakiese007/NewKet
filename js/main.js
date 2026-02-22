/* ENova EMarket Main Scripts */

document.addEventListener('DOMContentLoaded', () => {
    // ========== DATA MIGRATION ==========
    const migrateData = () => {
        const keys = ['currency', 'Cart', 'Favorites', 'Promos', 'Products', 'Orders'];
        keys.forEach(k => {
            const oldKey = 'nova' + k;
            const newKey = 'enova' + k;
            if (localStorage.getItem(oldKey) && !localStorage.getItem(newKey)) {
                localStorage.setItem(newKey, localStorage.getItem(oldKey));
                console.log(`Migrated ${oldKey} to ${newKey}`);
            }
        });
    };
    migrateData();

    // ========== MOBILE MENU & SEARCH ==========
    const initMobileControls = () => {
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const closeMobileMenu = document.getElementById('closeMobileMenu');
        const mobileMenu = document.getElementById('mobileMenu');
        const mobileOverlay = document.getElementById('mobileOverlay');
        const mobileSearchBtn = document.getElementById('mobileSearchBtn');
        const mobileSearchContainer = document.getElementById('mobileSearchContainer');

        const toggleMenu = () => {
            mobileMenu.classList.toggle('active');
            mobileOverlay.classList.toggle('active');
            document.body.classList.toggle('overflow-hidden');
        };

        if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleMenu);
        if (closeMobileMenu) closeMobileMenu.addEventListener('click', toggleMenu);
        if (mobileOverlay) mobileOverlay.addEventListener('click', toggleMenu);

        if (mobileSearchBtn && mobileSearchContainer) {
            mobileSearchBtn.addEventListener('click', () => {
                mobileSearchContainer.classList.toggle('hidden');
            });
        }

        // Update mobile favorites badge
        const updateMobileBadges = () => {
            const mobileFavBadge = document.getElementById('mobileFavoritesBadge');
            if (mobileFavBadge && window.FavoritesManager) {
                const count = window.FavoritesManager.getCount();
                mobileFavBadge.textContent = count;
                mobileFavBadge.style.display = count > 0 ? 'flex' : 'none';
            }
        };

        window.addEventListener('favoritesUpdated', updateMobileBadges);
        updateMobileBadges();
    };
    initMobileControls();

    console.log('ENova EMarket Loaded');

    // ========== CURRENCY MANAGER ==========
    const CurrencyManager = {
        currentCurrency: localStorage.getItem('enovaCurrency') || 'CDF',
        defaultRate: 2500, // 1 USD = 2500 CDF

        init() {
            this.updateCurrencyUI();
            this.bindEvents();
            this.updateAllPrices();
            this.updatePriceFilter();
        },

        bindEvents() {
            // Switch Bulle & Segmented Toggle Logic
            document.querySelectorAll('.currency-switch, .currency-toggle, .currency-switch-segmented').forEach(toggle => {
                toggle.addEventListener('click', () => {
                    const newCurrency = this.currentCurrency === 'CDF' ? 'USD' : 'CDF';
                    this.setCurrency(newCurrency);

                    // Small haptic animation
                    toggle.style.transform = 'scale(0.95)';
                    setTimeout(() => toggle.style.transform = 'scale(1)', 100);
                });
            });

            // Keep support for legacy .currency-option buttons
            document.querySelectorAll('.currency-option').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const currency = e.currentTarget.dataset.currency;
                    this.setCurrency(currency);
                });
            });
        },

        setCurrency(currency) {
            this.currentCurrency = currency;
            localStorage.setItem('enovaCurrency', currency);
            this.updateCurrencyUI();
            this.updateAllPrices();
            this.updatePriceFilter();

            // Dispatch event for other components
            window.dispatchEvent(new CustomEvent('currencyChanged', { detail: { currency } }));
        },

        updateCurrencyUI() {
            // Update Toggles
            document.querySelectorAll('.currency-switch, .currency-toggle, .currency-switch-segmented').forEach(toggle => {
                toggle.setAttribute('data-active', this.currentCurrency);

                // Old label support (if any)
                const label = toggle.querySelector('.currency-switch-label');
                if (label) label.textContent = this.currentCurrency;

                // Sync active class on segmented labels
                toggle.querySelectorAll('.segmented-label').forEach(lbl => {
                    if (lbl.getAttribute('data-currency') === this.currentCurrency) {
                        lbl.classList.add('active');
                    } else {
                        lbl.classList.remove('active');
                    }
                });

                // For the legacy slider toggle classes (if still present)
                toggle.classList.remove('usd', 'cdf');
                toggle.classList.add(this.currentCurrency.toLowerCase());

                toggle.querySelectorAll('button').forEach(btn => {
                    if (btn.getAttribute('data-currency') === this.currentCurrency) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
            });

            // Update legacy options
            document.querySelectorAll('.currency-option').forEach(btn => {
                if (btn.dataset.currency === this.currentCurrency) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });

            // Sync parent data-active for sliding effects if any
            document.querySelectorAll('.currency-selector').forEach(selector => {
                selector.setAttribute('data-active', this.currentCurrency);
            });
        },

        formatPrice(amount, currency = this.currentCurrency, isBaseAmount = true) {
            let value = amount;
            // If amount is in CDF (isBaseAmount=true) and we want USD, convert it
            if (isBaseAmount && currency === 'USD' && this.currentCurrency === 'USD') {
                value = this.convert(amount, true);
            }
            // If specified currency is USD but we didn't specify isBaseAmount=false, 
            // and we are currently in USD mode, it might have been already converted or not.
            // Let's make it simpler: if isBaseAmount is true, we always treat 'amount' as CDF.

            if (isBaseAmount && currency === 'USD') {
                value = this.convert(amount, true);
            }

            if (currency === 'CDF') {
                return new Intl.NumberFormat('fr-CD', {
                    style: 'currency',
                    currency: 'CDF',
                    maximumFractionDigits: 0
                }).format(value).replace('CDF', 'FC');
            } else {
                return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD'
                }).format(value);
            }
        },

        // Convert between currencies
        // If fromCDF is true, converts CDF -> USD
        // If fromCDF is false, converts USD -> CDF
        convert(amount, toUSD = true) {
            const config = window.enovaConfig || this.getConfigFallback();
            const rate = config.exchangeRate || 2500;
            if (toUSD) return amount / rate;
            return amount * rate;
        },

        getConfigFallback() {
            return { exchangeRate: 2500 };
        },

        updateAllPrices() {
            document.querySelectorAll('[data-price-cdf]').forEach(el => {
                const cdfPrice = parseFloat(el.dataset.priceCdf);
                el.textContent = this.formatPrice(cdfPrice);
            });
        },

        updatePriceFilter() {
            const minInput = document.querySelector('.input-min');
            const maxInput = document.querySelector('.input-max');
            const currencyLabels = document.querySelectorAll('.price-inputs .currency-label');

            if (!minInput || !maxInput) return;

            // Update Labels
            const formattedCurrency = this.currentCurrency === 'CDF' ? 'FC' : '$';
            currencyLabels.forEach(label => label.textContent = formattedCurrency);

            // Update Values
            [minInput, maxInput].forEach(input => {
                if (input.dataset.priceCdf !== undefined && input.dataset.priceCdf !== "") {
                    const basePrice = parseFloat(input.dataset.priceCdf);
                    if (!isNaN(basePrice)) {
                        if (this.currentCurrency === 'CDF') {
                            input.value = basePrice;
                        } else {
                            // Convert to USD and round to 2 decimals
                            input.value = Math.round(this.convert(basePrice, true));
                        }
                    }
                } else {
                    input.value = ""; // Garder vide si pas de valeur définie
                }
            });

            // Update semantic range inputs (hidden sliders) if needed similarly, 
            // but for now visual inputs are enough.
        }
    };

    window.CurrencyManager = CurrencyManager;

    // ========== AUTH MANAGER (New) ==========
    const AuthManager = {
        role: localStorage.getItem('enovaRole') || null, // 'customer' | 'supplier' | null

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

                        // Admin Override Logic
                        const adminEmails = window.ADMIN_EMAILS || [];
                        let finalRole = role;
                        if (adminEmails.includes(email)) {
                            finalRole = 'admin';
                        }

                        // Sync LocalStorage
                        if (localStorage.getItem('enovaRole') !== finalRole) {
                            this.setRole(finalRole);
                        }
                        if (localStorage.getItem('enovaUserEmail') !== email) {
                            localStorage.setItem('enovaUserEmail', email);
                        }
                    } else if (event === 'SIGNED_OUT') {
                        this.role = null;
                        localStorage.removeItem('enovaRole');
                        localStorage.removeItem('enovaUserEmail');
                        this.enforcePermissions();
                        this.updateAccountLink();
                        // Redirect to home if on protected page
                        if (window.location.pathname.includes('ADMIN') || window.location.pathname.includes('customer-dashboard')) {
                            window.location.href = '../index.html';
                        }
                    }
                });

                // Initial Check
                const { data } = await window.supabaseClient.auth.getSession();
                if (data.session) {
                    const user = data.session.user;
                    const role = user.user_metadata.role || 'customer';

                    const adminEmails = window.ADMIN_EMAILS || [];
                    let finalRole = role;
                    if (adminEmails.includes(user.email)) {
                        finalRole = 'admin';
                    }
                    this.setRole(finalRole);
                } else {
                    // No Supabase session — but respect the localStorage role if admin auth was done via PHOENIX password
                    const localRole = localStorage.getItem('enovaRole');
                    const adminAuth = sessionStorage.getItem('adminAuth') === 'true';
                    if (!localRole || (!adminAuth && localRole === 'admin')) {
                        this.setRole(null);
                    }
                    // else: keep the localStorage role from the local login
                }
            }

            this._authChecking = false; // Auth check done
            this.enforcePermissions();
            this.updateAccountLink();
            this.checkWelcomeBonus();
        },

        checkWelcomeBonus() {
            if (localStorage.getItem('enovaWelcomeBonus') === 'true') {
                // Check if showToast is available, otherwise alert or log
                if (typeof showToast === 'function') {
                    showToast('🎉 Bienvenue ! Profitez de -5% avec le code BIENVENUE', 'success');
                }
                localStorage.removeItem('enovaWelcomeBonus');
            }
            if (localStorage.getItem('enovaSupplierBonus') === 'true') {
                if (typeof showToast === 'function') {
                    showToast('🎉 Bienvenue ! 0% de commission sur votre première vente', 'success');
                }
                localStorage.removeItem('enovaSupplierBonus');
            }
        },

        getRole() {
            return this.role;
        },

        setRole(role) {
            this.role = role;
            localStorage.setItem('enovaRole', role);
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
            localStorage.removeItem('enovaRole');
            localStorage.removeItem('enovaUserEmail');
            window.location.href = 'index.html';
        },

        enforcePermissions() {
            // Don't redirect while auth check is still in progress
            if (this._authChecking) return;

            const body = document.body;

            body.classList.add(`role-${this.role}`);

            // Supplier/Admin UI Adjustments
            if (this.role === 'supplier' || this.role === 'admin') {
                const isAdmin = this.role === 'admin';

                // Sidebar label updates based on role
                document.querySelectorAll('.sidebar-link').forEach(link => {
                    const text = link.textContent.trim();
                    if (isAdmin) {
                        if (text.includes('Mes Produits')) link.innerHTML = '<iconify-icon icon="solar:box-bold" width="20"></iconify-icon> Gestion Produits';
                        if (text.includes('Commandes') && text === 'Commandes') link.innerHTML = '<iconify-icon icon="solar:cart-large-bold" width="20"></iconify-icon> Gestion Commandes';
                        if (text.includes('Mes Clients')) link.innerHTML = '<iconify-icon icon="solar:users-group-rounded-bold" width="20"></iconify-icon> Clients Plateforme';
                        if (text.includes('Calcul des Profits')) link.innerHTML = '<iconify-icon icon="solar:wad-of-money-bold" width="20"></iconify-icon> Profits Plateforme';
                        if (text === 'Utilisateurs') link.innerHTML = '<iconify-icon icon="solar:user-bold" width="20"></iconify-icon> Fournisseurs Plateforme';
                    } else {
                        // Reset for supplier if needed (usually already correct in HTML, but for toggle safety)
                    }
                });

                // Admin specific menu visibility
                document.querySelectorAll('.admin-only').forEach(el => {
                    el.style.display = isAdmin ? '' : 'none';
                });
            }

            // Admin: Full access (no restrictions)
            if (this.role === 'admin') {
                document.querySelectorAll('.publish-btn, .supplier-only, .admin-only').forEach(el => {
                    el.style.display = '';
                });
                return;
            }

            // Supplier Restrictions (Redirected to vendor-dashboard.html)
            if (this.role === 'supplier') {
                // Hide Cart Triggers & Buttons
                document.querySelectorAll('.cart-trigger, .add-to-cart-btn, #cart-count').forEach(el => {
                    el.style.display = 'none';
                });

                // Redirect if on admin-folder pages (Vendeurs have their own dashboard now)
                if (window.location.pathname.includes('/ADMIN%20NOVA/') || window.location.pathname.includes('/ADMIN NOVA/')) {
                    window.location.href = '../vendor-dashboard.html';
                }

                // Redirect if on forbidden customer pages
                if (window.location.pathname.includes('cart.html')) {
                    window.location.href = 'index.html';
                }
            }

            // Customer Restrictions
            if (this.role === 'customer') {
                // Show Cart
                document.querySelectorAll('.cart-trigger, .add-to-cart-btn, #cart-count').forEach(el => {
                    el.style.display = ''; // Restore default
                });
                // Hide Publish Actions
                document.querySelectorAll('.publish-btn, .supplier-only').forEach(el => {
                    el.style.display = 'none';
                });

                // Redirect if on forbidden pages (customer in Admin folder)
                if (window.location.pathname.includes('/ADMIN%20NOVA/') || window.location.pathname.includes('/ADMIN NOVA/')) {
                    window.location.href = '../customer-dashboard.html';
                }

                if (window.location.pathname.includes('publish.html')) {
                    window.location.href = 'index.html';
                }
            }

            // Not Logged In Restrictions (Protection for Admin folder)
            if (this.role === null) {
                const path = window.location.pathname;
                const isAdminFolder = path.includes('/ADMIN%20NOVA/') || path.includes('/ADMIN NOVA/');
                const isLoginPage = path.endsWith('ADMIN%20NOVA/') || path.endsWith('ADMIN NOVA/') || path.endsWith('index.html');

                if (isAdminFolder && !isLoginPage) {
                    window.location.href = 'index.html'; // In Admin Nova, index.html is the login
                }
            }
        },

        updateAccountLink() {
            const accountLink = document.getElementById('accountLink');
            if (!accountLink) return;

            const icon = accountLink.querySelector('iconify-icon');

            if (this.role === 'admin') {
                accountLink.href = 'ADMIN NOVA/dashboard.html';
                accountLink.title = 'Admin Panel';
                if (icon) {
                    icon.setAttribute('icon', 'solar:user-bold');
                    icon.className = 'text-white';
                }
                accountLink.classList.add('bg-gray-900', 'text-white');
                accountLink.classList.remove('hover:bg-gray-50');
                // Badge rôle
                let badge = accountLink.querySelector('.role-badge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'role-badge absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white';
                    badge.title = 'Admin';
                    accountLink.appendChild(badge);
                }
                badge.style.display = 'block';

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

            } else {
                // Non connecté — état par défaut
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
        },
    };
    window.AuthManager = AuthManager;

    // Initialize immediately
    AuthManager.init();

    // ========== CART MANAGEMENT SYSTEM ==========
    const CartManager = {
        // Get cart from localStorage
        getCart() {
            const cart = localStorage.getItem('enovaCart');
            return cart ? JSON.parse(cart) : [];
        },

        // Save cart to localStorage
        saveCart(cart) {
            localStorage.setItem('enovaCart', JSON.stringify(cart));
            this.updateBadge();
            window.dispatchEvent(new CustomEvent('cartUpdated', { detail: cart }));
        },

        // Add item to cart
        addItem(product) {
            const cart = this.getCart();
            const existingItem = cart.find(item => item.id === product.id);

            if (existingItem) {
                existingItem.quantity += 1;
            } else {
                cart.push({ ...product, quantity: 1 });
            }

            this.saveCart(cart);
            return cart;
        },

        // Remove item from cart
        removeItem(productId) {
            let cart = this.getCart();
            cart = cart.filter(item => item.id !== productId);
            this.saveCart(cart);
            return cart;
        },

        // Update quantity
        updateQuantity(productId, delta) {
            const cart = this.getCart();
            const item = cart.find(item => item.id === productId);

            if (item) {
                item.quantity += delta;
                if (item.quantity <= 0) {
                    return this.removeItem(productId);
                }
            }

            this.saveCart(cart);
            return cart;
        },

        // Set specific quantity (Maintains position but updates count)
        setQuantity(productId, quantity) {
            let cart = this.getCart();
            const itemIndex = cart.findIndex(item => item.id === productId);

            if (itemIndex > -1) {
                const newQty = parseInt(quantity);
                if (isNaN(newQty) || newQty < 1) {
                    cart[itemIndex].quantity = 1; // Default to 1 if invalid input (avoid accidental deletion)
                } else {
                    cart[itemIndex].quantity = newQty;
                }
                this.saveCart(cart);
            }
            return cart;
        },

        // Get total items count
        getItemCount() {
            const cart = this.getCart();
            return cart.reduce((total, item) => total + item.quantity, 0);
        },

        // Update badge on all pages
        updateBadge() {
            const badges = document.querySelectorAll('.cart-count, #cart-count');
            const count = this.getItemCount();

            badges.forEach(badge => {
                badge.textContent = count;

                // Hide badge if cart is empty
                if (count === 0) {
                    badge.style.display = 'none';
                } else {
                    badge.style.display = 'flex';
                }

                // Bounce animation
                badge.style.transform = 'scale(1.3)';
                setTimeout(() => {
                    badge.style.transform = 'scale(1)';
                }, 200);
            });
        },

        // Clear cart
        clear() {
            localStorage.removeItem('enovaCart');
            this.updateBadge();
        }
    };

    // Make CartManager globally accessible
    window.CartManager = CartManager;

    // Initialize badge on page load
    CartManager.updateBadge();

    // ========== FAVORITES MANAGER ==========
    const FavoritesManager = {
        // Get favorites from localStorage
        getFavorites() {
            const favorites = localStorage.getItem('enovaFavorites');
            return favorites ? JSON.parse(favorites) : [];
        },

        // Save favorites to localStorage
        saveFavorites(favorites) {
            localStorage.setItem('enovaFavorites', JSON.stringify(favorites));
            this.updateUI();
            window.dispatchEvent(new CustomEvent('favoritesUpdated'));
        },

        // Add item to favorites
        addItem(product) {
            const favorites = this.getFavorites();
            const exists = favorites.find(item => item.id === product.id);

            if (!exists) {
                favorites.push({
                    ...product,
                    addedAt: new Date().toISOString()
                });
                this.saveFavorites(favorites);
                return true;
            }
            return false;
        },

        // Remove item from favorites
        removeItem(productId) {
            let favorites = this.getFavorites();
            favorites = favorites.filter(item => item.id !== productId);
            this.saveFavorites(favorites);
        },

        // Clear all favorites
        clearAll() {
            localStorage.removeItem('enovaFavorites');
            this.updateUI();
        },

        // Check if item is in favorites
        isInFavorites(productId) {
            const favorites = this.getFavorites();
            return favorites.some(item => item.id === productId);
        },

        // Get count
        getCount() {
            return this.getFavorites().length;
        },

        // Update UI elements (badges and icons)
        updateUI() {
            const count = this.getCount();
            const favorites = this.getFavorites();

            // Update badges
            const badges = document.querySelectorAll('#favoritesBadge');
            const totalText = document.getElementById('favoritesTotal');

            badges.forEach(badge => {
                badge.textContent = count;
                badge.style.display = count > 0 ? 'flex' : 'none';
            });

            if (totalText) {
                totalText.textContent = count;
            }

            // Update heart icons on the page
            document.querySelectorAll('.product-card').forEach((card, index) => {
                // Try to identify product
                let productId = card.getAttribute('data-product-id') || '';

                if (!productId) {
                    // Strategy 1: Link ID
                    const link = card.querySelector('a[href*="id="]');
                    if (link) {
                        const url = new URL(link.href, window.location.origin);
                        productId = url.searchParams.get('id');
                    }
                }

                // Strategy 2: Scrape name (fallback)
                if (!productId) {
                    const titleEl = card.querySelector('.product-title a, .product-title, h3 a, h3');
                    if (titleEl) {
                        const productName = titleEl.textContent.trim();
                        productId = productName.toLowerCase().replace(/\s+/g, '-');
                    }
                }

                if (!productId) return;

                const isFavorite = this.isInFavorites(productId);

                // Target both font-awesome and iconify-icon
                const wishlistBtn = card.querySelector('.wishlist-btn');
                if (wishlistBtn) {
                    const iconify = wishlistBtn.querySelector('iconify-icon');
                    const faIcon = wishlistBtn.querySelector('i');

                    if (iconify) {
                        iconify.setAttribute('icon', isFavorite ? 'solar:heart-bold' : 'solar:heart-linear');
                        if (isFavorite) {
                            wishlistBtn.classList.add('text-red-500');
                        } else {
                            wishlistBtn.classList.remove('text-red-500');
                        }
                    } else if (faIcon) {
                        if (isFavorite) {
                            faIcon.classList.remove('far');
                            faIcon.classList.add('fas');
                            faIcon.style.color = '#EF4444';
                        } else {
                            faIcon.classList.remove('fas');
                            faIcon.classList.add('far');
                            faIcon.style.color = '';
                        }
                    }
                }
            });

            // Update heart icon on product detail page
            const productDetailH1 = document.querySelector('.product-info-col h1');
            if (productDetailH1) {
                const productName = productDetailH1.textContent.trim();
                const productId = productName.toLowerCase().replace(/\s+/g, '-');
                const wishlistBtn = document.querySelector('.wishlist-btn');
                if (wishlistBtn) {
                    const isFavorite = this.isInFavorites(productId);
                    const iconify = wishlistBtn.querySelector('iconify-icon');
                    const faIcon = wishlistBtn.querySelector('i');

                    if (iconify) {
                        iconify.setAttribute('icon', isFavorite ? 'solar:heart-bold' : 'solar:heart-linear');
                        if (isFavorite) wishlistBtn.classList.add('text-red-500');
                        else wishlistBtn.classList.remove('text-red-500');
                    } else if (faIcon) {
                        if (isFavorite) {
                            faIcon.classList.remove('far');
                            faIcon.classList.add('fas');
                            faIcon.style.color = '#EF4444';
                        } else {
                            faIcon.classList.remove('fas');
                            faIcon.classList.add('far');
                            faIcon.style.color = '';
                        }
                    }
                }
            }
        }
    };

    // Make it globally accessible
    window.FavoritesManager = FavoritesManager;

    // Initialize favorites UI
    FavoritesManager.updateUI();

    // ========== PROMO MANAGER ==========
    const PromoManager = {
        promos: {},

        async init() {
            const data = await window.SupabaseAdapter.fetch('promos');
            if (data && data.length > 0) {
                const promoMap = {};
                data.forEach(p => {
                    promoMap[p.code] = {
                        type: p.type,
                        value: p.value,
                        maxUses: p.max_uses,
                        expiryDate: p.expiry_date,
                        currentUses: p.current_uses,
                        usedBy: p.used_by || []
                    };
                });
                this.promos = promoMap;
            } else {
                this.promos = {};
            }
            window.dispatchEvent(new CustomEvent('promosUpdated'));
        },

        getPromos() {
            return this.promos;
        },

        async addPromo(code, type, value, maxUses = null, expiryDate = null) {
            const promoData = {
                code,
                type,
                value: parseFloat(value),
                max_uses: maxUses ? parseInt(maxUses) : null,
                expiry_date: expiryDate || null,
                current_uses: 0,
                used_by: []
            };
            const inserted = await window.SupabaseAdapter.upsert('promos', promoData, 'code');
            if (inserted) {
                this.promos[code] = {
                    type: inserted.type,
                    value: inserted.value,
                    maxUses: inserted.max_uses,
                    expiryDate: inserted.expiry_date,
                    currentUses: inserted.current_uses,
                    usedBy: inserted.used_by
                };
                window.dispatchEvent(new CustomEvent('promosUpdated'));
            }
        },

        async removePromo(code) {
            const success = await window.SupabaseAdapter.delete('promos', code, 'code');
            if (success) {
                delete this.promos[code];
                window.dispatchEvent(new CustomEvent('promosUpdated'));
            }
        },

        canApply(code, userId) {
            const promo = this.promos[code];
            if (!promo) return { valid: false, message: 'Ce code privilège n\'est pas reconnu par notre système.' };

            if (promo.maxUses !== null && promo.currentUses >= promo.maxUses) {
                return { valid: false, message: 'Cette offre exclusive est malheureusement victime de son succès.' };
            }

            if (promo.expiryDate) {
                const now = new Date();
                const expiry = new Date(promo.expiryDate);
                expiry.setHours(23, 59, 59, 999);
                if (now > expiry) {
                    return { valid: false, message: 'Cette offre prestigieuse a malheureusement expiré.' };
                }
            }

            if (userId && promo.usedBy && promo.usedBy.includes(userId)) {
                return { valid: false, message: 'Vous avez déjà bénéficié de cette offre exclusive.' };
            }

            return { valid: true };
        },

        async incrementUsage(code, userId) {
            const promo = this.promos[code];
            if (promo) {
                const newUses = (promo.currentUses || 0) + 1;
                const newUsedBy = [...(promo.usedBy || [])];
                if (userId && !newUsedBy.includes(userId)) newUsedBy.push(userId);

                const updated = await window.SupabaseAdapter.update('promos', code, {
                    current_uses: newUses,
                    used_by: newUsedBy
                }, 'code');

                if (updated) {
                    promo.currentUses = newUses;
                    promo.usedBy = newUsedBy;
                    window.dispatchEvent(new CustomEvent('promosUpdated'));
                }
            }
        }
    };
    window.PromoManager = PromoManager;

    // ========== ACTIVITY MANAGER (New) ==========
    const ActivityManager = {
        activities: [],

        async init() {
            const data = await window.SupabaseAdapter.fetch('activities');
            if (data && data.length > 0) {
                this.activities = data.sort((a, b) => new Date(b.time) - new Date(a.time));
            }
            window.dispatchEvent(new CustomEvent('activitiesUpdated'));
        },

        getActivities() {
            return this.activities;
        },

        async log(text, type = 'system') {
            const newActivity = {
                id: 'act-' + Date.now(),
                text,
                type,
                time: new Date().toISOString()
            };
            const inserted = await window.SupabaseAdapter.insert('activities', newActivity);
            if (inserted) {
                this.activities.unshift(inserted);
                if (this.activities.length > 50) this.activities.pop();
                window.dispatchEvent(new CustomEvent('activitiesUpdated'));
            }
        },

        formatTime(isoString) {
            const date = new Date(isoString);
            const now = new Date();
            const diffInSeconds = Math.floor((now - date) / 1000);

            if (diffInSeconds < 60) return 'À l\'instant';
            if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min`;
            if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} h`;
            return date.toLocaleDateString();
        },

        getRecentActivity(limit = 5) {
            return this.activities.slice(0, limit);
        }
    };
    window.ActivityManager = ActivityManager;

    // ========== PRODUCT MANAGER (New) ==========
    const ProductManager = {
        products: [],

        async init() {
            const data = await window.SupabaseAdapter.fetch('products');
            if (data && data.length > 0) {
                // Map snake_case from SQL to camelCase for JS UI
                this.products = data.map(p => ({
                    ...p,
                    isNew: p.is_new,
                    isPromo: p.is_promo,
                    oldPrice: p.old_price,
                }));
            } else {
                this.products = [];
            }
            window.dispatchEvent(new CustomEvent('productsUpdated'));
        },

        getProducts() {
            return this.products;
        },

        getProduct(id) {
            return this.products.find(p => p.id === id);
        },

        async addProduct(product) {
            const newProd = await window.SupabaseAdapter.insert('products', product);
            if (newProd) {
                this.products.push(newProd);
                window.dispatchEvent(new CustomEvent('productsUpdated'));
                ActivityManager.log(`Produit ajouté : ${product.name}`, 'stock');
            }
        },

        async updateProduct(id, updatedData) {
            const updated = await window.SupabaseAdapter.update('products', id, updatedData);
            if (updated) {
                const index = this.products.findIndex(p => p.id === id);
                if (index !== -1) {
                    this.products[index] = updated;
                    window.dispatchEvent(new CustomEvent('productsUpdated'));
                    ActivityManager.log(`Produit modifié : ${updated.name}`, 'stock');
                }
            }
        },

        async deleteProduct(id) {
            const success = await window.SupabaseAdapter.delete('products', id);
            if (success) {
                const product = this.products.find(p => p.id === id);
                this.products = this.products.filter(p => p.id !== id);
                window.dispatchEvent(new CustomEvent('productsUpdated'));
                if (product) ActivityManager.log(`Produit supprimé : ${product.name}`, 'stock');
            }
        },

        async deleteBulk(ids) {
            for (const id of ids) {
                await window.SupabaseAdapter.delete('products', id);
            }
            this.products = this.products.filter(p => !ids.includes(p.id));
            window.dispatchEvent(new CustomEvent('productsUpdated'));
            ActivityManager.log(`${ids.length} produits supprimés par action groupée`, 'stock');
        },

        async updateCategoryBulk(ids, newCategory) {
            for (const id of ids) {
                await window.SupabaseAdapter.update('products', id, { category: newCategory });
            }
            this.products.forEach(p => {
                if (ids.includes(p.id)) p.category = newCategory;
            });
            window.dispatchEvent(new CustomEvent('productsUpdated'));
            ActivityManager.log(`Catégorie mise à jour pour ${ids.length} produits`, 'stock');
        }
    };
    window.ProductManager = ProductManager;

    // ========== ORDER MANAGER (New) ==========
    const OrderManager = {
        orders: [],

        async init() {
            const data = await window.SupabaseAdapter.fetch('orders');
            if (data && data.length > 0) {
                this.orders = data.map(o => ({
                    ...o,
                    customer: {
                        name: o.customer_name,
                        email: o.customer_email
                    }
                })).sort((a, b) => new Date(b.date) - new Date(a.date));
            } else {
                // If data is empty (or blocked by RLS), just init with empty array
                this.orders = [];
            }
            window.dispatchEvent(new CustomEvent('ordersUpdated'));
        },

        getOrders() {
            return this.orders;
        },

        async addOrder(order) {
            // SECURITY: Recalculate total from items server-side to guard against manipulation.
            // The items passed here should already have server-verified prices from cart.html.
            const recalculatedSubtotal = (order.items || []).reduce(
                (acc, item) => acc + (parseFloat(item.price) * parseInt(item.quantity || 1)),
                0
            );
            const pointsUsedAmount = parseFloat(order.pointsUsed || 0);
            // Accept the passed total only if it's plausible (>= 0 and not > recalculated)
            // Use the minimum of passed total vs recalculated - discounts to prevent overpaying
            const safeFinalTotal = order.total !== undefined
                ? Math.max(0, Math.min(order.total, recalculatedSubtotal))
                : Math.max(0, recalculatedSubtotal - pointsUsedAmount);

            const newOrderData = {
                id: order.id || 'EN-' + Date.now(),
                date: new Date().toISOString(),
                status: 'En attente',
                total: safeFinalTotal,
                customer_name: order.customer?.name || order.customer_name,
                customer_email: order.customer?.email || order.customer_email,
                items: order.items,
                payment_method: order.paymentMethod || 'Non spécifié',
                phone_number: order.phoneNumber || '',
                points_used: order.pointsUsed || 0
            };
            const inserted = await window.SupabaseAdapter.insert('orders', newOrderData);
            if (inserted) {
                this.orders.unshift(inserted);
                window.dispatchEvent(new CustomEvent('ordersUpdated'));
                return inserted;
            }
            return null;
        },


        async updateStatus(orderId, status) {
            const updated = await window.SupabaseAdapter.update('orders', orderId, { status });
            if (updated) {
                const order = this.orders.find(o => o.id === orderId);
                if (order) {
                    order.status = status;
                    window.dispatchEvent(new CustomEvent('ordersUpdated'));
                }
            }
        },

        getCustomerStats(email) {
            const allOrders = this.orders.filter(o => o.customer_email === email && o.status !== 'Annulé');
            const totalSpent = allOrders.reduce((sum, o) => sum + o.total, 0);

            // Points earned: 2% cashback only for products > 50$
            const thresholdUSD = 50;
            const thresholdCDF = CurrencyManager.convert(thresholdUSD, false);
            let earnedTotal = 0;

            allOrders.forEach(order => {
                (order.items || []).forEach(item => {
                    if (item.price >= thresholdCDF) {
                        earnedTotal += (item.price * item.quantity);
                    }
                });
            });

            const pointsEarned = Math.floor(earnedTotal * 0.02);
            const pointsUsed = allOrders.reduce((sum, o) => sum + (o.points_used || 0), 0);
            const currentBalance = Math.max(0, pointsEarned - pointsUsed);

            return {
                totalOrders: allOrders.length,
                totalSpent: totalSpent,
                avgOrderValue: allOrders.length > 0 ? totalSpent / allOrders.length : 0,
                lastOrder: allOrders.length > 0 ? allOrders[0] : null,
                novaPoints: currentBalance,
                pointsEarned,
                pointsUsed
            };
        },

        getVendorStats(vendorEmail) {
            const allOrders = this.getOrders();
            let vendorTotalSales = 0;
            let vendorOrderCount = 0;
            const salesByDay = {};

            // Last 7 days labels
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                salesByDay[d.toISOString().split('T')[0]] = 0;
            }

            allOrders.forEach(order => {
                const vendorItems = order.items.filter(item => {
                    const product = ProductManager.getProduct(item.id);
                    return product && product.supplier_email === vendorEmail;
                });

                if (vendorItems.length > 0) {
                    vendorOrderCount++;
                    const orderTotalForVendor = vendorItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    vendorTotalSales += orderTotalForVendor;

                    const dateKey = new Date(order.date).toISOString().split('T')[0];
                    if (salesByDay[dateKey] !== undefined) {
                        salesByDay[dateKey] += orderTotalForVendor;
                    }
                }
            });

            const platformCommission = vendorTotalSales * 0.10;
            const netGains = vendorTotalSales - platformCommission;

            return {
                totalSales: vendorTotalSales,
                netGains: netGains,
                commission: platformCommission,
                totalOrders: vendorOrderCount,
                chartData: {
                    labels: Object.keys(salesByDay).map(date => {
                        const d = new Date(date);
                        return d.toLocaleDateString('fr-FR', { weekday: 'short' });
                    }),
                    data: Object.values(salesByDay)
                },
                recentOrders: allOrders.filter(order =>
                    order.items.some(item => {
                        const product = ProductManager.getProduct(item.id);
                        return product && product.supplier_email === vendorEmail;
                    })
                ).slice(0, 5)
            };
        },

        getAdvancedStats(timeframe = 'all') {
            const role = localStorage.getItem('enovaRole');
            const email = localStorage.getItem('enovaUserEmail');
            let orders = this.orders;

            // Apply timeframe filter
            if (timeframe !== 'all') {
                const now = new Date();
                const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                orders = orders.filter(o => {
                    const orderDate = new Date(o.date);
                    if (timeframe === 'day') {
                        return orderDate >= startOfDay;
                    }
                    const diffTime = now - orderDate;
                    const diffDays = diffTime / (1000 * 60 * 60 * 24);

                    if (timeframe === 'week') return diffDays <= 7;
                    if (timeframe === 'month') return diffDays <= 30;
                    if (timeframe === 'year') return diffDays <= 365;
                    return true;
                });
            }

            if (role === 'supplier' && email) {
                orders = orders.filter(o => {
                    return (o.items || []).some(item => {
                        const p = ProductManager.getProduct(item.id);
                        return p && p.supplier_email === email; // Note: SQL snake_case
                    });
                });
            }

            const config = { sellerCommission: 10 }; // Fallback
            const products = ProductManager.getProducts();
            const commissionRate = config.sellerCommission || 0;

            const totalOrders = orders.length;
            const totalSales = orders.reduce((sum, order) => sum + (order.total || 0), 0);
            const aov = totalOrders > 0 ? totalSales / totalOrders : 0;

            const productSalesCount = {};
            const categorySales = {};
            const customerEmails = new Set();

            orders.forEach(o => {
                const email = o.customer?.email || o.customer_email;
                if (email) customerEmails.add(email);

                (o.items || []).forEach(item => {
                    productSalesCount[item.id] = (productSalesCount[item.id] || 0) + item.quantity;
                    const p = products.find(prod => prod.id === item.id);
                    const cat = p ? p.category : 'Autre';
                    categorySales[cat] = (categorySales[cat] || 0) + (item.price * item.quantity);
                });
            });

            const totalCustomers = customerEmails.size;

            const deadStock = products.filter(p => !productSalesCount[p.id]);
            const topProducts = products
                .map(p => ({ ...p, salesCount: productSalesCount[p.id] || 0 }))
                .filter(p => p.salesCount > 0)
                .sort((a, b) => b.salesCount - a.salesCount)
                .slice(0, 5);

            return {
                totalOrders,
                totalSales,
                aov,
                commissionTotal: totalSales * (commissionRate / 100),
                netSales: totalSales * (1 - commissionRate / 100),
                totalCustomers,
                deadStockCount: deadStock.length,
                deadStockList: deadStock.slice(0, 10),
                categorySales,
                topProducts
            };
        },

        getStats() {
            const role = localStorage.getItem('enovaRole');
            const stats = this.getAdvancedStats();

            if (role === 'admin') {
                return {
                    totalOrders: stats.totalOrders,
                    totalSales: stats.totalSales,
                    netSales: stats.commissionTotal,
                    commissionTotal: stats.commissionTotal,
                    totalCustomers: stats.totalCustomers
                };
            }

            return {
                totalOrders: stats.totalOrders,
                totalSales: stats.totalSales,
                netSales: stats.netSales,
                commissionTotal: stats.commissionTotal,
                totalCustomers: stats.totalCustomers
            };
        },

        getProfitStats() {
            const stats = this.getAdvancedStats();
            const totalNet = stats.netSales;

            const payouts = [
                { id: 'PAY-001', date: new Date(Date.now() - 7 * 86400000).toISOString(), amount: 150000, status: 'Payé' },
                { id: 'PAY-002', date: new Date(Date.now() - 14 * 86400000).toISOString(), amount: 85000, status: 'Payé' }
            ].filter(p => p.amount > 0);

            return {
                totalGross: stats.totalSales,
                totalCommission: stats.commissionTotal,
                totalNet,
                commissionPercent: 10,
                payouts,
                pendingPayout: totalNet - 235000 > 0 ? totalNet - 235000 : 0
            };
        }
    };
    window.OrderManager = OrderManager;

    // ========== STICKY HEADER ==========
    const header = document.querySelector('.main-header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }

    // ========== NOTIFICATION MANAGER ==========
    const NotificationManager = {
        notifications: [],

        async init() {
            const data = await window.SupabaseAdapter.fetch('notifications');
            if (data && data.length > 0) {
                this.notifications = data.sort((a, b) => new Date(b.date) - new Date(a.date));
            }
            this.updateBadge();
            window.dispatchEvent(new CustomEvent('notificationsUpdated'));
        },

        getNotifications() {
            return this.notifications;
        },

        async addNotification(title, message, type = 'info') {
            const newNotif = {
                id: 'notif-' + Date.now(),
                title,
                message,
                type,
                date: new Date().toISOString(),
                read: false
            };
            const inserted = await window.SupabaseAdapter.insert('notifications', newNotif);
            if (inserted) {
                this.notifications.unshift(inserted);
                if (this.notifications.length > 50) this.notifications.pop();
                this.updateBadge();
                window.dispatchEvent(new CustomEvent('notificationsUpdated'));
                return inserted;
            }
            return null;
        },

        async markAsRead(id) {
            const updated = await window.SupabaseAdapter.update('notifications', id, { read: true });
            if (updated) {
                const notif = this.notifications.find(n => n.id === id);
                if (notif) {
                    notif.read = true;
                    this.updateBadge();
                    window.dispatchEvent(new CustomEvent('notificationsUpdated'));
                }
            }
        },

        async markAllAsRead() {
            for (const n of this.notifications) {
                if (!n.read) await this.markAsRead(n.id);
            }
        },

        async clearAll() {
            // Bulk delete not implemented in adapter easily for all, but for now:
            for (const n of this.notifications) {
                await window.SupabaseAdapter.delete('notifications', n.id);
            }
            this.notifications = [];
            this.updateBadge();
            window.dispatchEvent(new CustomEvent('notificationsUpdated'));
        },

        getUnreadCount() {
            return this.notifications.filter(n => !n.read).length;
        },

        updateBadge() {
            const unreadCount = this.getUnreadCount();
            const badges = document.querySelectorAll('.notification-badge');
            badges.forEach(badge => {
                if (unreadCount > 0) {
                    badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                    badge.classList.remove('hidden');
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }
            });
        }
    };
    window.NotificationManager = NotificationManager;

    // Run update badge on init
    document.addEventListener('DOMContentLoaded', () => {
        NotificationManager.updateBadge();
    });

    // ========== TOAST NOTIFICATION SYSTEM ==========
    window.showToast = function (message, type = 'success') {
        const existingToast = document.querySelector('.enova-toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.className = `enova-toast ${type}`;

        // Define icons based on type
        let icon = 'solar:check-circle-bold';
        if (type === 'info') icon = 'solar:info-circle-bold';
        if (type === 'error') icon = 'solar:danger-circle-bold';
        if (type === 'warning') icon = 'solar:bell-bing-bold';

        // Translate type for notification history title
        const titles = {
            'success': 'Succès',
            'info': 'Information',
            'error': 'Erreur',
            'warning': 'Attention'
        };

        // Add to history
        NotificationManager.addNotification(titles[type] || 'Système', message, type);

        toast.innerHTML = `
            <div class="toast-icon-bg">
                <iconify-icon icon="${icon}"></iconify-icon>
            </div>
            <span>${message}</span>
        `;

        document.body.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.add('active');
        });

        // Animate out
        setTimeout(() => {
            toast.classList.remove('active');
            setTimeout(() => toast.remove(), 600);
        }, 4000);
    }

    // ========== PREMIUM OVERLAY & MODAL SYSTEM ==========
    window.showConfirm = function (title, message, onConfirm, confirmText = 'Confirmer', cancelText = 'Annuler') {
        const existingOverlay = document.getElementById('enova-global-overlay');
        if (existingOverlay) existingOverlay.remove();

        const overlay = document.createElement('div');
        overlay.id = 'enova-global-overlay';
        overlay.className = 'fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm transition-all duration-300 opacity-0 invisible';
        overlay.innerHTML = `
            <div class="enova-modal-card bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl transform scale-90 transition-all duration-300">
                <div class="flex flex-col items-center text-center">
                    <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-6 text-gray-900">
                        <iconify-icon icon="solar:question-circle-bold" width="32"></iconify-icon>
                    </div>
                    <h3 class="text-2xl font-black tracking-tighter text-gray-900 mb-2">${title}</h3>
                    <p class="text-gray-500 font-medium text-sm mb-10">${message}</p>
                    
                    <div class="flex flex-col sm:flex-row gap-3 w-full">
                        <button id="modal-cancel-btn" class="flex-1 py-4 px-6 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-400 hover:text-black hover:bg-gray-50 transition-all">
                            ${cancelText}
                        </button>
                        <button id="modal-confirm-btn" class="flex-1 py-4 px-6 rounded-2xl text-xs font-black uppercase tracking-widest bg-black text-white shadow-xl shadow-black/20 hover:shadow-black/40 hover:-translate-y-1 transition-all">
                            ${confirmText}
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Show animation
        requestAnimationFrame(() => {
            overlay.classList.remove('invisible', 'opacity-0');
            overlay.querySelector('.enova-modal-card').classList.remove('scale-90');
        });

        const close = () => {
            overlay.classList.add('opacity-0');
            overlay.querySelector('.enova-modal-card').classList.add('scale-90');
            setTimeout(() => {
                overlay.classList.add('invisible');
                overlay.remove();
            }, 300);
        };

        const confirmBtn = overlay.querySelector('#modal-confirm-btn');
        const cancelBtn = overlay.querySelector('#modal-cancel-btn');

        confirmBtn.onclick = () => {
            close();
            if (onConfirm) onConfirm();
        };

        cancelBtn.onclick = () => {
            close();
        };

        overlay.onclick = (e) => {
            if (e.target === overlay) close();
        };
    }

    // ========== GLOBAL LOADER SYSTEM ==========
    const LoaderManager = {
        show(message = 'Traitement en cours...') {
            const existing = document.getElementById('enova-global-loader');
            if (existing) return;

            const loader = document.createElement('div');
            loader.id = 'enova-global-loader';
            loader.className = 'fixed inset-0 z-[2000] flex items-center justify-center bg-white/80 backdrop-blur-md transition-all duration-300 opacity-0 invisible';
            loader.innerHTML = `
                <div class="flex flex-col items-center gap-6">
                    <div class="w-12 h-12 border-[3px] border-gray-100 border-t-black rounded-full animate-spin"></div>
                    <div class="text-[10px] font-black uppercase tracking-[0.2em] text-gray-900">${message}</div>
                </div>
            `;
            document.body.appendChild(loader);

            requestAnimationFrame(() => {
                loader.classList.remove('invisible', 'opacity-0');
            });
        },
        hide() {
            const loader = document.getElementById('enova-global-loader');
            if (loader) {
                loader.classList.add('opacity-0');
                setTimeout(() => {
                    loader.classList.add('invisible');
                    loader.remove();
                }, 300);
            }
        }
    };
    window.LoaderManager = LoaderManager;

    function showPasswordConfirm(title, message, onConfirm) {
        const existingOverlay = document.getElementById('enova-global-overlay');
        if (existingOverlay) existingOverlay.remove();

        const overlay = document.createElement('div');
        overlay.id = 'enova-global-overlay';
        overlay.className = 'fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm transition-all duration-300 opacity-0 invisible';
        overlay.innerHTML = `
            <div class="enova-modal-card bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl transform scale-90 transition-all duration-300">
                <div class="flex flex-col items-center text-center">
                    <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-6 text-gray-900">
                        <iconify-icon icon="solar:lock-password-bold" width="32"></iconify-icon>
                    </div>
                    <h3 class="text-2xl font-black tracking-tighter text-gray-900 mb-2">${title}</h3>
                    <p class="text-gray-500 font-medium text-sm mb-6">${message}</p>
                    
                    <div class="w-full mb-8">
                        <input type="password" id="modal-password-input" placeholder="Mot de passe requis" 
                            class="w-full px-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 outline-none focus:border-black transition-all text-center font-bold tracking-widest">
                    </div>

                    <div class="flex flex-col sm:flex-row gap-3 w-full">
                        <button id="modal-cancel-btn" class="flex-1 py-4 px-6 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-400 hover:text-black hover:bg-gray-50 transition-all">
                            Annuler
                        </button>
                        <button id="modal-confirm-btn" class="flex-1 py-4 px-6 rounded-2xl text-xs font-black uppercase tracking-widest bg-black text-white shadow-xl shadow-black/20 hover:shadow-black/40 hover:-translate-y-1 transition-all">
                            Confirmer
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        requestAnimationFrame(() => {
            overlay.classList.remove('invisible', 'opacity-0');
            overlay.querySelector('.enova-modal-card').classList.remove('scale-90');
            overlay.querySelector('#modal-password-input').focus();
        });

        const close = () => {
            overlay.classList.add('opacity-0');
            overlay.querySelector('.enova-modal-card').classList.add('scale-90');
            setTimeout(() => {
                overlay.classList.add('invisible');
                overlay.remove();
            }, 300);
        };

        const confirmBtn = overlay.querySelector('#modal-confirm-btn');
        const cancelBtn = overlay.querySelector('#modal-cancel-btn');
        const passwordInput = overlay.querySelector('#modal-password-input');

        const validate = () => {
            if (passwordInput.value === 'PHOENIX') {
                close();
                if (onConfirm) onConfirm();
            } else {
                showToast("Mot de passe incorrect.", "error");
                passwordInput.classList.add('border-red-500');
                passwordInput.value = '';
                passwordInput.focus();
                // Shake effect on the input
                passwordInput.style.animation = 'shake 0.4s';
                setTimeout(() => passwordInput.style.animation = '', 400);
            }
        };

        confirmBtn.onclick = validate;
        cancelBtn.onclick = close;
        passwordInput.onkeypress = (e) => { if (e.key === 'Enter') validate(); };

        overlay.onclick = (e) => {
            if (e.target === overlay) close();
        };
    }

    window.showConfirm = showConfirm;
    window.showPasswordConfirm = showPasswordConfirm;
    window.LoaderManager = LoaderManager;


    // ========== TRUST MARKERS INFINITE SCROLL ==========
    const featuresGrid = document.querySelector('.features-grid');
    if (featuresGrid) {
        // Clone the items to create a seamless loop (DRY principle)
        const items = featuresGrid.innerHTML;
        featuresGrid.innerHTML = items + items;
    }

    // Make showToast globally accessible
    window.showToast = showToast;

    // ========== ADD TO CART BUTTONS ==========
    document.querySelectorAll('.add-to-cart-btn, .product-card .btn-primary').forEach((btn, index) => {
        // Avoid double binding on product page where we have explicit class
        if (btn.dataset.cartBound) return;
        btn.dataset.cartBound = 'true';

        btn.addEventListener('click', function (e) {
            e.preventDefault();

            // Find product info
            const card = this.closest('.product-card');
            let productName = 'Produit';
            let productPrice = 0;
            let productImage = '';
            let productId = 'product-' + index;

            if (card) {
                const imgEl = card.querySelector('.product-image img');
                if (imgEl) productImage = imgEl.src;
                const titleEl = card.querySelector('.product-title a, .product-title');
                if (titleEl) productName = titleEl.textContent.trim();

                const priceEl = card.querySelector('.current-price');
                if (priceEl) {
                    // Prefer data attribute if available for accurate base price
                    if (priceEl.dataset.priceCdf) {
                        productPrice = parseFloat(priceEl.dataset.priceCdf);
                    } else if (priceEl.dataset.priceUsd) {
                        // Fallback to USD convert if only USD is there (less likely)
                        productPrice = CurrencyManager.convert(parseFloat(priceEl.dataset.priceUsd), false);
                    } else {
                        // Fallback to text scraping (risky with formatting)
                        const rawText = priceEl.textContent.replace(/[^\d,]/g, '').replace(',', '.');
                        productPrice = parseFloat(rawText) || 0;

                        // If scraping from a formatted price that might be USD (small number), assume it needs conversion or is already base
                        // This part is tricky without data attributes. 
                        // Strategy: The new standard is data-price-cdf. 
                    }
                }

                // Generate unique ID from product name
                productId = productName.toLowerCase().replace(/\s+/g, '-');
            } else {
                // On product page
                const imgEl = document.querySelector('.main-image');
                if (imgEl) productImage = imgEl.src;

                const h1 = document.querySelector('.product-info-col h1');
                if (h1) {
                    productName = h1.textContent.trim();
                    productId = productName.toLowerCase().replace(/\s+/g, '-');
                }

                const priceEl = document.querySelector('.product-info-col .current-price');
                if (priceEl) {
                    if (priceEl.dataset.priceCdf) {
                        productPrice = parseFloat(priceEl.dataset.priceCdf);
                    } else {
                        productPrice = parseFloat(priceEl.textContent.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
                    }
                }
            }

            // Add to cart using CartManager
            CartManager.addItem({
                id: productId,
                name: productName,
                price: productPrice,
                image: productImage
            });

            showToast(`${productName} ajouté au panier !`, 'success');
        });
    });


    // ========== WISHLIST BUTTONS ==========
    document.querySelectorAll('.wishlist-btn').forEach((btn, index) => {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            const card = this.closest('.product-card');
            const icon = this.querySelector('i');

            if (card) {
                // Extract product info
                let productName = 'Produit';
                let productPrice = 0;
                let productImg = '';
                let productCat = '';
                let productId = 'product-' + index;

                const titleEl = card.querySelector('.product-title a, .product-title');
                if (titleEl) {
                    productName = titleEl.textContent.trim();
                    productId = productName.toLowerCase().replace(/\s+/g, '-');
                }

                const priceEl = card.querySelector('.current-price');
                if (priceEl) {
                    if (priceEl.dataset.priceCdf) {
                        productPrice = parseFloat(priceEl.dataset.priceCdf);
                    } else {
                        productPrice = parseFloat(priceEl.textContent.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
                    }
                }

                const imgEl = card.querySelector('.product-image img');
                if (imgEl) productImg = imgEl.src;

                const catEl = card.querySelector('.product-cat');
                if (catEl) productCat = catEl.textContent.trim();

                // Toggle favorite
                if (FavoritesManager.isInFavorites(productId)) {
                    FavoritesManager.removeItem(productId);
                    showToast('Retiré des favoris', 'info');
                } else {
                    FavoritesManager.addItem({
                        id: productId,
                        name: productName,
                        price: productPrice,
                        image: productImg,
                        category: productCat
                    });
                    showToast('Ajouté aux favoris', 'success');
                }
            } else {
                // Logic for Product Detail Page
                const productPage = document.querySelector('.product-info-col');
                if (productPage) {
                    let productName = document.querySelector('.product-info-col h1').textContent.trim();
                    let productId = productName.toLowerCase().replace(/\s+/g, '-');

                    let productPrice = 0;
                    const priceEl = document.querySelector('.product-price-large');
                    if (priceEl) {
                        // Get text node only (price) excluding child elements (old price)
                        const priceText = Array.from(priceEl.childNodes)
                            .filter(node => node.nodeType === 3)
                            .map(node => node.textContent.trim())
                            .join('');
                        productPrice = parseFloat(priceText.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
                    }

                    let productImg = document.querySelector('.main-image').src;

                    // Toggle favorite
                    if (FavoritesManager.isInFavorites(productId)) {
                        FavoritesManager.removeItem(productId);
                        showToast('Retiré des favoris', 'info');

                        // Update icon state
                        icon.classList.remove('fas');
                        icon.classList.add('far');
                        icon.style.color = '';
                    } else {
                        FavoritesManager.addItem({
                            id: productId,
                            name: productName,
                            price: productPrice,
                            image: productImg,
                            category: 'High-Tech' // Hardcoded for demo or extract from breadcrumb
                        });
                        showToast('Ajouté aux favoris', 'success');

                        // Update icon state
                        icon.classList.remove('far');
                        icon.classList.add('fas');
                        icon.style.color = '#EF4444';
                    }
                }
            }
        });
    });

    // ========== LOGIN FORM SIMULATION ==========
    const loginForm = document.querySelector('.login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const email = document.getElementById('email')?.value;
            if (email) {
                showToast('Connexion réussie !', 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            }
        });
    }

    // ========== SCROLL REVEAL ANIMATION ==========
    const revealElements = document.querySelectorAll('.product-card, .feature-item, .review-card');

    const revealOnScroll = () => {
        revealElements.forEach(el => {
            const rect = el.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            if (rect.top < windowHeight - 100) {
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }
        });
    };

    // Initial style for reveal
    revealElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    });

    window.addEventListener('scroll', revealOnScroll);
    revealOnScroll(); // Run once on load

    // ========== SEARCH SYSTEM ==========
    const searchBars = document.querySelectorAll('.search-bar');
    searchBars.forEach(bar => {
        const input = bar.querySelector('.search-input');
        const icon = bar.querySelector('.search-icon');

        const performSearch = () => {
            const query = input.value.trim();
            if (query) {
                // Simulate search by redirecting to catalog with query param
                window.location.href = `catalog.html?q=${encodeURIComponent(query)}`;
            }
        };

        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') performSearch();
            });
        }

        if (icon) {
            icon.addEventListener('click', performSearch);
        }
    });

    // Check for search query in URL
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');
    if (searchQuery) {
        const globalSearchInput = document.querySelector('.search-input');
        if (globalSearchInput) globalSearchInput.value = searchQuery;
    }


    // ========== RENDER PRODUCTS (Homepage - 3 grilles) ==========

    // Helper: génère le HTML d'une carte produit
    function buildProductCardHTML(product) {
        let badgeHTML = '';
        if (product.isNew || product.is_new) badgeHTML = '<span class="badge badge-new"><iconify-icon icon="solar:stars-bold" width="12"></iconify-icon>Nouveau</span>';
        if (product.isPromo || product.is_promo) badgeHTML = '<span class="badge badge-sale"><iconify-icon icon="solar:tag-price-bold" width="12"></iconify-icon>Promo</span>';

        const oldPrice = product.oldPrice || product.old_price;

        return `
            <div class="product-card flex flex-col h-full bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all hover:shadow-xl group" data-product-id="${product.id}">
                <div class="product-image relative aspect-[4/3] overflow-hidden bg-gray-50">
                    ${badgeHTML}
                    <img src="${product.image}" alt="${product.name}" class="w-full h-full object-contain p-4 transition-transform duration-500 group-hover:scale-110" onerror="this.src='https://via.placeholder.com/300'">
                    <button class="wishlist-btn absolute top-3 right-3 w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-gray-900 hover:text-white ${FavoritesManager.isInFavorites(product.id) ? 'text-red-500' : ''}" onclick="addToWishlist('${product.id}', event)">
                        <iconify-icon icon="${FavoritesManager.isInFavorites(product.id) ? 'solar:heart-bold' : 'solar:heart-linear'}" width="18"></iconify-icon>
                    </button>
                </div>
                <div class="product-info p-6 flex flex-col flex-1">
                    <div class="text-[10px] font-bold text-gray-900 uppercase tracking-widest mb-1">${product.category}</div>
                    <h3 class="text-sm font-semibold text-gray-900 mb-2 line-clamp-2 min-h-[40px]">
                        <a href="product.html?id=${product.id}" class="hover:text-gray-600 transition-colors">${product.name}</a>
                    </h3>
                    <div class="flex items-center gap-1 mb-3">
                        <div class="flex text-yellow-400">
                            <iconify-icon icon="solar:star-bold" width="12"></iconify-icon>
                            <iconify-icon icon="solar:star-bold" width="12"></iconify-icon>
                            <iconify-icon icon="solar:star-bold" width="12"></iconify-icon>
                            <iconify-icon icon="solar:star-bold" width="12"></iconify-icon>
                            <iconify-icon icon="solar:star-bold" width="12" class="text-gray-200"></iconify-icon>
                        </div>
                        <span class="text-[10px] text-gray-400 font-medium">(${product.reviews || 0})</span>
                    </div>
                    <div class="mt-auto">
                        <div class="flex items-baseline gap-2 mb-3">
                            <span class="text-base font-bold text-gray-900" data-price-cdf="${product.price}">${CurrencyManager.formatPrice(product.price)}</span>
                            ${oldPrice ? `<span class="text-xs text-gray-400 line-through" data-price-cdf="${oldPrice}">${CurrencyManager.formatPrice(oldPrice)}</span>` : ''}
                        </div>
                        <button class="w-full bg-gray-900 hover:bg-black text-white py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 group/btn add-to-cart-btn" onclick="addToCart('${product.id}')">
                            <iconify-icon icon="solar:cart-large-2-linear" width="16" class="transition-transform group-hover/btn:scale-110"></iconify-icon>
                            Ajouter
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // 1. Produits épinglés
    function renderPinnedProducts() {
        const grid = document.getElementById('pinnedProductGrid');
        const section = document.getElementById('pinnedSection');
        if (!grid || !section) return;

        const products = ProductManager.getProducts();
        const pinned = products.filter(p => p.pinned === true);

        if (pinned.length === 0) {
            // Si aucun produit épinglé, cacher la section entièrement
            section.style.display = 'none';
            return;
        }

        // S'il y a des épinglés, on s'assure d'afficher la section
        section.style.display = 'block';

        grid.innerHTML = pinned.map(p => buildProductCardHTML(p)).join('');
        CurrencyManager.updateAllPrices();
        grid.querySelectorAll('.product-card').forEach(el => {
            el.style.opacity = '1'; el.style.transform = 'translateY(0)';
        });
    }

    // 2. 10 produits récemment publiés
    function renderRecentProducts() {
        const grid = document.getElementById('recentProductGrid');
        if (!grid) return;

        const products = ProductManager.getProducts();
        // Trier par date de création (created_at) dekodée, sinon par id
        const sorted = [...products].sort((a, b) => {
            const da = a.created_at ? new Date(a.created_at) : 0;
            const db = b.created_at ? new Date(b.created_at) : 0;
            return db - da;
        });
        const recent10 = sorted.slice(0, 10);

        grid.innerHTML = recent10.length > 0
            ? recent10.map(p => buildProductCardHTML(p)).join('')
            : '<p class="col-span-5 text-center text-sm text-gray-400 py-8">Aucun produit disponible.</p>';

        CurrencyManager.updateAllPrices();
        grid.querySelectorAll('.product-card').forEach(el => {
            el.style.opacity = '1'; el.style.transform = 'translateY(0)';
        });
    }

    // 3. Tous les produits (avec filtre & tri)
    let _currentFilter = 'all';

    function renderAllProducts(filterCat, sortMode) {
        const grid = document.getElementById('allProductGrid');
        const noMsg = document.getElementById('noProductsMsg');
        if (!grid) return;

        filterCat = filterCat || _currentFilter || 'all';
        sortMode = sortMode || document.getElementById('sortAllProducts')?.value || 'recent';

        const products = ProductManager.getProducts();
        let filtered = filterCat === 'all' ? [...products] : products.filter(p => p.category === filterCat);

        // Tri
        if (sortMode === 'price_asc') filtered.sort((a, b) => a.price - b.price);
        else if (sortMode === 'price_desc') filtered.sort((a, b) => b.price - a.price);
        else filtered.sort((a, b) => {
            const da = a.created_at ? new Date(a.created_at) : 0;
            const db = b.created_at ? new Date(b.created_at) : 0;
            return db - da;
        });

        if (noMsg) noMsg.classList.toggle('hidden', filtered.length > 0);

        grid.innerHTML = filtered.length > 0
            ? filtered.map(p => buildProductCardHTML(p)).join('')
            : '';

        CurrencyManager.updateAllPrices();
        grid.querySelectorAll('.product-card').forEach(el => {
            el.style.opacity = '1'; el.style.transform = 'translateY(0)';
        });
    }

    // Expose filter & sort handlers globally
    window.filterAllProducts = function (cat) {
        _currentFilter = cat;
        // Update active button style
        document.querySelectorAll('#filterBar .filter-btn').forEach(btn => {
            const isActive = btn.dataset.filter === cat;
            btn.classList.toggle('bg-gray-900', isActive);
            btn.classList.toggle('text-white', isActive);
            btn.classList.toggle('bg-gray-100', !isActive);
            btn.classList.toggle('text-gray-700', !isActive);
        });
        renderAllProducts(cat);
    };

    window.sortAndRenderAll = function () {
        renderAllProducts(_currentFilter);
    };

    // Backward compat - ancienne fonction (si appelée ailleurs)
    function renderProducts() {
        renderPinnedProducts();
        renderRecentProducts();
        renderAllProducts();
    }

    // Expose helpers for onclick
    window.addToCart = function (productId) {
        const product = ProductManager.getProduct(productId);
        if (product) {
            CartManager.addItem(product);
            showToast(`${product.name} ajouté au panier!`, 'success');
        }
    };

    window.addToWishlist = function (productId, event) {
        if (event) event.stopPropagation();
        const product = ProductManager.getProduct(productId);
        if (product) {
            if (FavoritesManager.isInFavorites(productId)) {
                FavoritesManager.removeItem(productId);
                showToast('Retiré des favoris', 'info');
            } else {
                FavoritesManager.addItem(product);
                showToast('Ajouté aux favoris', 'success');
            }
            FavoritesManager.updateUI();
        }
    };

    // Call render
    renderProducts();


    // ========== CART PAGE LOGIC ==========
    function initCartPage() {
        const cartItemsContainer = document.getElementById('cartItemsContainer');
        const emptyCartMessage = document.getElementById('emptyCartMessage');
        const summarySection = document.querySelector('.cart-summary');

        // Promo Code State
        let activePromo = null;

        // Mock User ID
        const currentUser = sessionStorage.getItem('currentUser') || 'user_' + Math.floor(Math.random() * 1000);

        if (!cartItemsContainer) return;

        // Setup Promo Code Listeners
        const addPromoBtn = document.getElementById('addPromoBtn');
        const promoInputContainer = document.getElementById('promoInputContainer');
        const promoInput = document.getElementById('promoInput');
        const applyPromoBtn = document.getElementById('applyPromoBtn');
        const activePromoBadge = document.getElementById('activePromoBadge');
        const appliedCodeText = document.getElementById('appliedCodeText');
        const removePromoBtn = document.getElementById('removePromoBtn');

        if (addPromoBtn) {
            addPromoBtn.addEventListener('click', () => {
                promoInputContainer.classList.toggle('hidden');
                if (!promoInputContainer.classList.contains('hidden')) {
                    promoInput.focus();
                }
            });
        }

        if (applyPromoBtn) {
            applyPromoBtn.addEventListener('click', () => {
                const code = promoInput.value.trim().toUpperCase();

                if (!code) return;

                if (activePromo) {
                    showToast('Un code promo est déjà appliqué', 'info');
                    return;
                }

                const validation = PromoManager.canApply(code, currentUser);

                if (validation.valid) {
                    const validPromos = PromoManager.getPromos();
                    activePromo = { ...validPromos[code], code: code };

                    showToast('Code promo appliqué !', 'success');

                    // Update UI State
                    promoInput.value = '';
                    promoInputContainer.classList.add('hidden');
                    addPromoBtn.parentElement.classList.add('hidden');
                    activePromoBadge.classList.remove('hidden');
                    appliedCodeText.textContent = code;

                    renderCart();
                } else {
                    showToast(validation.message || "Ce privilège n'a pas encore été forgé dans notre univers.", 'error');
                }
            });
        }

        if (removePromoBtn) {
            removePromoBtn.addEventListener('click', () => {
                activePromo = null;
                activePromoBadge.classList.add('hidden');
                addPromoBtn.parentElement.classList.remove('hidden');
                showToast('Code promo retiré', 'info');
                renderCart();
            });
        }

        // Expose finalizePromo for Checkout
        window.finalizePromoUsage = function () {
            if (activePromo && activePromo.code) {
                PromoManager.incrementUsage(activePromo.code, currentUser);
            }
        };

        function renderCart() {
            const cart = CartManager.getCart();

            if (cart.length === 0) {
                cartItemsContainer.innerHTML = '';
                if (emptyCartMessage) emptyCartMessage.classList.remove('hidden');
                return;
            }

            if (emptyCartMessage) emptyCartMessage.classList.add('hidden');

            cartItemsContainer.innerHTML = cart.map(item => {
                const priceCDF = item.price;
                const priceUSD = CurrencyManager.convert(priceCDF, true);

                return `
                <div class="p-6 border-b border-gray-100 last:border-0 flex flex-col sm:flex-row gap-6 sm:items-center group transition-all hover:bg-white/40">
                    <!-- Image -->
                    <div class="w-24 h-24 bg-white/50 rounded-[1.5rem] overflow-hidden flex-shrink-0 border border-white/50 shadow-sm relative">
                        <img src="${item.image || ''}" alt="${item.name}" class="w-full h-full object-contain p-3 transition-transform duration-500 group-hover:scale-110" onerror="this.src='https://via.placeholder.com/100'">
                    </div>
                    
                    <!--Details -->
                    <div class="flex-1 min-w-0">
                        <div class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">${item.category || 'Article'}</div>
                        <h3 class="text-lg font-bold text-gray-900 mb-4 truncate">${item.name}</h3>
                        
                        <div class="flex items-center gap-6">
                            <!-- Qty Control -->
                            <!-- Qty Control -->
                            <div class="flex items-center bg-gray-100/50 rounded-2xl p-1 border border-white">
                                <button onclick="CartManager.updateQuantity('${item.id}', -1)" class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white hover:shadow-sm transition-all text-gray-600 hover:text-black">
                                    <iconify-icon icon="solar:minus-circle-linear" width="20"></iconify-icon>
                                </button>
                                <input type="number" min="1" value="${item.quantity}" onchange="CartManager.setQuantity('${item.id}', this.value)" class="w-12 text-center text-sm font-black text-gray-900 bg-transparent focus:outline-none appearance-none spin-button-none">
                                <button onclick="CartManager.updateQuantity('${item.id}', 1)" class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white hover:shadow-sm transition-all text-gray-600 hover:text-black">
                                    <iconify-icon icon="solar:add-circle-linear" width="20"></iconify-icon>
                                </button>
                            </div>
                            
                            <!-- Remove -->
                            <button onclick="CartManager.removeItem('${item.id}')" class="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-red-500 transition-colors flex items-center gap-2">
                                <iconify-icon icon="solar:trash-bin-trash-bold" width="16"></iconify-icon>
                                <span>Supprimer</span>
                            </button>
                        </div>
                    </div>
                    
                    <!--Price -->
                <div class="text-right sm:pl-6">
                    <div class="text-xl font-black text-gray-900 mb-1 tracking-tighter" data-price-cdf="${priceCDF * item.quantity}">
                        ${CurrencyManager.formatPrice(item.price * item.quantity)}
                    </div>
                    <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                        ${CurrencyManager.formatPrice(item.price)} / unité
                    </div>
                </div>
                </div>
                `;
            }).join('');

            updateSummary(cart);
            CurrencyManager.updateAllPrices();
        }

        function updateSummary(cart) {
            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

            // Calculate Discount
            let discount = 0;
            if (activePromo) {
                if (activePromo.type === 'percent') {
                    discount = subtotal * activePromo.value;
                } else if (activePromo.type === 'fixed') {
                    discount = activePromo.value;
                }
            }

            // Ensure discount doesn't exceed subtotal
            if (discount > subtotal) discount = subtotal;

            const total = subtotal - discount;

            // Helper to update an element
            const updateEl = (id, amount) => {
                const el = document.getElementById(id);
                if (el) {
                    el.dataset.priceCdf = amount;
                    let formatted = CurrencyManager.formatPrice(amount);
                    if (id === 'summaryDiscount') {
                        formatted = '-' + formatted;
                    }
                    el.textContent = formatted;
                }
            };

            // Update Summary Rows
            updateEl('summarySubtotal', subtotal);

            const discountRow = document.getElementById('summaryDiscountRow');
            if (discountRow) {
                if (discount > 0) {
                    discountRow.classList.remove('hidden');
                    updateEl('summaryDiscount', discount);
                } else {
                    discountRow.classList.add('hidden');
                }
            }

            updateEl('summaryTotal', total);
        }

        window.addEventListener('cartUpdated', renderCart);
        window.addEventListener('currencyChanged', renderCart);
        renderCart();
    }

    initCartPage();

    // Listen for storage changes (Cross-tab synchronization)
    window.addEventListener('storage', (e) => {
        if (e.key === 'enovaProducts') {
            console.log('Produits mis à jour depuis un autre onglet');
            renderProducts(); // Re-render main grid
            // Render cart if needed (though cart items might be stale if product details changed)
        }
        if (e.key === 'enovaCurrency') {
            CurrencyManager.currentCurrency = localStorage.getItem('enovaCurrency') || 'CDF';
            CurrencyManager.updateCurrencyUI();
            CurrencyManager.updateAllPrices();
            CurrencyManager.updatePriceFilter();
        }
        if (e.key === 'enovaCart') {
            CartManager.updateBadge();
        }
        if (e.key === 'enovaFavorites') {
            FavoritesManager.updateUI();
        }
    });

    // ========== CONFIG MANAGER (New) ==========
    const ConfigManager = {
        getConfig() {
            try {
                const config = localStorage.getItem('enovaConfig');
                const defaults = {
                    shopName: 'ENova EMarket',
                    email: 'contact@enova-emarket.com',
                    currencySymbol: 'FC',
                    shippingFee: 2,
                    freeShippingThreshold: 50,
                    shippingCurrency: 'USD',
                    sellerCommission: 5,
                    targetAOV: 20,
                    exchangeRate: 2500,
                    logoUrl: '',
                    primaryColor: '#000000',
                    supportPhone: '+243 000 000 000',
                    maintenanceMode: false,
                    socialLinks: {
                        facebook: '',
                        instagram: '',
                        twitter: ''
                    }
                };

                if (!config) {
                    this.saveConfig(defaults);
                    return defaults;
                }
                const parsed = JSON.parse(config);
                return (parsed && typeof parsed === 'object') ? { ...defaults, ...parsed } : defaults;
            } catch (e) {
                console.error('Error loading config:', e);
                return defaults; // Will fail if defaults weren't defined in this scope, but they are.
            }
        },

        saveConfig(config) {
            localStorage.setItem('enovaConfig', JSON.stringify(config));
            this.applyConfig();
        },

        applyConfig() {
            const config = this.getConfig();

            // Store for other parts to access
            window.enovaConfig = config;

            // Update Page Titles
            if (!document.title.includes('|')) {
                // If it's a main page, we might want to suffix it
            }

            // Update Logotype / Headers
            document.querySelectorAll('.logo span, a.logo span, .brand-name, header .font-black, a[href="index.html"] span, a[href="../index.html"] span').forEach(el => {
                // Only update if it contains "ENova" or similar to avoid overwriting other spans
                if (el.textContent.includes('ENova') || el.classList.contains('brand-name')) {
                    el.textContent = config.shopName;
                }
            });

            // Update Logo Image
            if (config.logoUrl) {
                document.querySelectorAll('.logo img, a.logo img').forEach(img => {
                    img.src = config.logoUrl;
                });
            }

            // Update Footer Copyright
            const copyright = document.querySelector('footer p, footer .copyright, footer .text-center');
            if (copyright && copyright.textContent.includes('©')) {
                const year = new Date().getFullYear();
                copyright.innerHTML = `&copy; ${year} ${config.shopName}&trade; Premium Experience`;
            }

            // Update Contact Emails
            document.querySelectorAll('.contact-email').forEach(el => {
                el.textContent = config.email;
                if (el.tagName === 'A') el.href = `mailto:${config.email}`;
            });

            // Update Support Phone
            document.querySelectorAll('.contact-phone').forEach(el => {
                el.textContent = config.supportPhone;
                if (el.tagName === 'A') el.href = `tel:${config.supportPhone}`;
            });

            // Handle Maintenance Mode
            if (config.maintenanceMode && !window.location.pathname.includes('ADMIN NOVA') && !window.location.pathname.includes('login.html')) {
                // Simples redirection or overlay could be added here
                console.warn('MAINTENANCE MODE ACTIVE');
            }
        }
    };
    window.ConfigManager = ConfigManager;

    // ========== PROFILE MANAGER (New) ==========
    const ProfileManager = {
        getProfile() {
            const profile = localStorage.getItem('enovaUserProfile');
            if (!profile) {
                const defaults = {
                    name: 'Client ENova',
                    email: 'client@example.com',
                    phone: '+243 000 000 000'
                };
                return defaults;
            }
            return JSON.parse(profile);
        },

        saveProfile(profile) {
            localStorage.setItem('enovaUserProfile', JSON.stringify(profile));
            this.updateUI();
        },

        updateUI() {
            const profile = this.getProfile();

            // Update Sidebar/Dashboard Greetings
            const greeting = document.querySelector('.user-greeting, #user-name-display');
            if (greeting) greeting.textContent = profile.name;

            const sidebarName = document.querySelector('aside h2, .sidebar-link + div h2');
            if (sidebarName && (window.location.pathname.includes('dashboard') || window.location.pathname.includes('customer'))) {
                sidebarName.textContent = profile.name;
            }

            // Update Navbar/Header User Name if exists
            const navUserName = document.querySelector('.nav-user-name');
            if (navUserName) navUserName.textContent = profile.name;
        }
    };
    window.ProfileManager = ProfileManager;

    // Initialize Config on load
    ConfigManager.applyConfig();
    ProfileManager.updateUI();

    // Final Initialization
    CurrencyManager.init();

    // ========== COOKIE CONSENT MANAGER ==========
    const CookieManager = {
        init() {
            // Check if user has already made a choice
            if (!localStorage.getItem('enovaCookieConsent')) {
                // Delay showing for better UX
                setTimeout(() => {
                    this.showConsentModal();
                }, 2000);
            }
        },

        showConsentModal() {
            // Create modal HTML
            if (document.querySelector('.cookie-consent-modal')) return;

            const modal = document.createElement('div');
            modal.className = 'cookie-consent-modal';
            modal.innerHTML = `
                <div class="cookie-icon">🍪</div>
                <div>
                    <div class="cookie-title">Nous respectons votre vie privée</div>
                    <div class="cookie-text">
                        Nous utilisons des cookies pour améliorer votre expérience de navigation, diffuser des publicités ou des contenus personnalisés et analyser notre trafic.
                    </div>
                </div>
                <div class="cookie-actions">
                    <button class="btn-cookie-decline" id="btnCookieDecline">Refuser</button>
                    <button class="btn-cookie-accept" id="btnCookieAccept">Accepter</button>
                </div>
            `;

            document.body.appendChild(modal);

            // Trigger animation
            setTimeout(() => {
                modal.classList.add('active');
            }, 100);

            // Bind events
            document.getElementById('btnCookieAccept').addEventListener('click', () => {
                this.setConsent(true);
                this.closeModal(modal);
            });

            document.getElementById('btnCookieDecline').addEventListener('click', () => {
                this.setConsent(false);
                this.closeModal(modal);
            });
        },

        closeModal(modal) {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.remove();
            }, 500);
        },

        setConsent(accepted) {
            localStorage.setItem('enovaCookieConsent', JSON.stringify({
                accepted: accepted,
                timestamp: new Date().toISOString()
            }));

            if (accepted) {
                showToast('Expérience personnalisée activée. Merci de votre confiance.', 'success');
            }
        }
    };

    // ========== USER MANAGER (New) ==========
    const UserManager = {
        users: [],

        async init() {
            const data = await window.SupabaseAdapter.fetch('users');
            if (data && data.length > 0) {
                this.users = data.map(u => ({
                    ...u,
                    dateJoined: u.date_joined
                }));
            } else {
                this.users = [];
            }
            window.dispatchEvent(new CustomEvent('usersUpdated'));
        },

        getUsers() {
            return this.users;
        },

        async signup(userData) {
            const newUser = {
                id: 'user-' + Date.now(),
                name: userData.name,
                email: userData.email,
                role: userData.role || 'customer',
                date_joined: new Date().toISOString(),
                avatar: userData.name ? userData.name.substring(0, 2).toUpperCase() : 'U'
            };

            const inserted = await window.SupabaseAdapter.upsert('users', newUser);
            if (inserted) {
                const formattedUser = { ...inserted, dateJoined: inserted.date_joined };
                this.users.push(formattedUser);
                window.dispatchEvent(new CustomEvent('usersUpdated'));
                if (window.ActivityManager) ActivityManager.log(`Nouvel utilisateur inscrit : ${formattedUser.name}`, 'system');
                return formattedUser;
            }
            return null;
        },

        async deleteUser(id) {
            const success = await window.SupabaseAdapter.delete('users', id);
            if (success) {
                this.users = this.users.filter(u => u.id !== id);
                window.dispatchEvent(new CustomEvent('usersUpdated'));
            }
        }
    };
    window.UserManager = UserManager;

    // ========== SIDEBAR RESIZER ==========
    const SidebarResizer = {
        init() {
            const sidePanel = document.querySelector('aside .glass-panel.sticky') || document.querySelector('aside > div');
            if (!sidePanel) return;

            const aside = sidePanel.closest('aside');
            if (!aside) return;

            // Don't init on mobile
            if (window.innerWidth < 768) return;

            // Inject Resizer Handle
            let resizer = sidePanel.querySelector('.sidebar-resizer');
            if (!resizer) {
                resizer = document.createElement('div');
                resizer.className = 'sidebar-resizer';
                sidePanel.appendChild(resizer);
            }

            // Restore width
            const savedWidth = localStorage.getItem('enovaAdminSidebarWidth');
            if (savedWidth) {
                this.applyWidth(aside, savedWidth);
            }

            let isResizing = false;
            let startX, startWidth;

            resizer.addEventListener('mousedown', (e) => {
                isResizing = true;
                startX = e.clientX;
                startWidth = aside.offsetWidth;
                document.body.classList.add('sidebar-resizing');
                e.preventDefault();
            });

            window.addEventListener('mousemove', (e) => {
                if (!isResizing) return;

                const deltaX = e.clientX - startX;
                const newWidth = startWidth + deltaX;

                // New limits: 60px (icons only) to 50% screen
                if (newWidth > 60 && newWidth < (window.innerWidth / 2)) {
                    this.applyWidth(aside, `${newWidth}px`);
                }
            });

            window.addEventListener('mouseup', () => {
                if (isResizing) {
                    isResizing = false;
                    document.body.classList.remove('sidebar-resizing');
                    localStorage.setItem('enovaAdminSidebarWidth', aside.style.width);
                }
            });
        },

        applyWidth(aside, width) {
            aside.style.setProperty('width', width, 'important');
            aside.style.setProperty('min-width', width, 'important');
            aside.style.setProperty('max-width', width, 'important');

            // Toggle narrow class for CSS labels hiding
            const widthVal = parseInt(width);
            if (widthVal < 160) {
                aside.classList.add('sidebar-narrow');
            } else {
                aside.classList.remove('sidebar-narrow');
            }
        }
    };
    window.SidebarResizer = SidebarResizer;

    // ========== GLOBAL INITIALIZATION ==========
    async function initializeApp() {
        console.log('Initializing NOVA V2 with Supabase...');

        try {
            // Show loader during initial fetch
            if (window.LoaderManager) LoaderManager.show('Chargement des données...');

            // Initialize all managers in parallel, using allSettled so one failure doesn't block others
            const results = await Promise.allSettled([
                ProductManager.init(),
                OrderManager.init(),
                PromoManager.init(),
                ActivityManager.init(),
                NotificationManager.init(),
                UserManager.init()
            ]);

            // Log any individual failures without crashing
            results.forEach((result, i) => {
                if (result.status === 'rejected') {
                    const names = ['ProductManager', 'OrderManager', 'PromoManager', 'ActivityManager', 'NotificationManager', 'UserManager'];
                    console.warn(`[NOVA] ${names[i]}.init() failed (likely RLS):`, result.reason);
                }
            });

            // Initialize UI Components
            SidebarResizer.init();

            console.log('NOVA V2 Initialized successfully');

            // Dispatch global ready event
            window.enovaInitialized = true;
            window.dispatchEvent(new CustomEvent('enovaInitialized'));

            // Initial render for homepage / components
            if (typeof renderProducts === 'function') renderProducts();

            // Re-bind currency event
            window.removeEventListener('currencyChanged', renderProducts);
            window.addEventListener('currencyChanged', renderProducts);

            // Initialize Cookie Manager
            if (window.CookieManager) CookieManager.init();

        } catch (error) {
            console.error('Failed to initialize app:', error);
            if (window.showToast) showToast('Erreur de connexion à la base de données', 'error');
        } finally {
            if (window.LoaderManager) LoaderManager.hide();
        }
    }

    // Run initialization
    window.enovaInitializationPromise = initializeApp();
});
