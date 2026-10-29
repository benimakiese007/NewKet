/* NewKet EMarket - Main Orchestrator */
import { initSentry, setSentryUser } from './sentry.js';
import { initCapacitorPlugins } from './capacitor-plugins.js';


window.newketConfig = {
    exchangeRate: 2500
};

const isLocalHost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

const resolveLocalBackendReady = async () => {
    if (!isLocalHost) return true;
    if (window.newketBackendReady === true) return true;
    if (window.newketBackendReady === false) return false;
    if (window.ApiClient?.isLocalBackendReady) {
        const ready = await window.ApiClient.isLocalBackendReady(1200);
        window.newketBackendReady = ready;
        return ready;
    }
    return true;
};

// Admin emails are made available early by auth/admin-config so shell code can read them.
// ADMIN_PASSWORD intentionally removed — use Supabase Auth only.

const App = {
    async init() {
        // --- INITIALISATION SENTRY (Monitoring) ---
        initSentry();

        // --- GLOBAL APP FAIL-SAFE ---
        // Ensure the white loading screen is REMOVED after 12 seconds, even if something hangs deep in a manager.
        setTimeout(() => {
            if (document.documentElement.classList.contains('auth-loading')) {
                console.warn('[NewKet App] Initialization fail-safe triggered. Removing loading screen.');
                document.documentElement.classList.remove('auth-loading');
                window.newketInitialized = true;
                window.dispatchEvent(new CustomEvent('newketInitialized'));
            }
        }, 12000);

        // 0. Initialize Configuration
        if (window.ConfigManager) await ConfigManager.init();

        // 1 & 2. Initialize Managers
        // AuthManager is critical for session state, we usually await it.
        if (window.AuthManager) await AuthManager.init();
        // Initialize Capacitor native plugins (push notifications + geolocation)
        // Non-blocking — runs after auth is ready so FCM token can be linked to the user.
        initCapacitorPlugins().catch(e => console.warn('[App] Capacitor plugins init:', e?.message));


        // Initialize Presence Tracking (non-blocking — fire & forget)
        if (window.PresenceManager) PresenceManager.init().catch(e => console.warn('[App] PresenceManager init failed:', e?.message));
        if (window.BehaviorTracking) BehaviorTracking.init();

        const currentRole = window.AuthManager?.role;
        const currentUser = window.AuthManager?.user;
        const isLoggedIn = !!currentRole;
        const isAdmin = currentRole === 'admin';
        const isSupplier = currentRole === 'supplier';
        const MAINTENANCE_MODAL_ID = 'newket-maintenance-modal';
        const removeMaintenanceOverlay = () => {
            if (!document.body) return;

            document.body.classList.remove('newket-maintenance-active');
            document.body.style.removeProperty('overflow');
            document.body.style.removeProperty('touch-action');
            delete document.body.dataset.newketMaintenanceView;

            const existingModal = document.getElementById(MAINTENANCE_MODAL_ID);
            if (existingModal) existingModal.remove();
        };
        const renderMaintenanceOverlay = () => {
            document.documentElement.classList.remove('auth-loading');
            if (!document.body) return;

            removeMaintenanceOverlay();
            document.body.dataset.newketMaintenanceView = '1';
            document.body.classList.add('newket-maintenance-active');
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none';

            const modal = document.createElement('div');
            modal.id = MAINTENANCE_MODAL_ID;
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-labelledby', 'newket-maintenance-title');
            modal.setAttribute('aria-describedby', 'newket-maintenance-description');
            modal.innerHTML = `
                <div style="position:fixed; inset:0; z-index:99999; display:flex; align-items:center; justify-content:center; padding:24px; background:rgba(2,6,23,0.78); backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px);">
                    <div style="position:relative; width:min(620px, 100%); overflow:hidden; border-radius:32px; border:1px solid rgba(255,255,255,0.12); background:linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(3,7,18,0.98) 100%); box-shadow:0 40px 120px rgba(0,0,0,0.45); color:#fff; text-align:center; padding:44px 32px;">
                        <div style="width:92px; height:92px; margin:0 auto 22px; border-radius:30px; display:flex; align-items:center; justify-content:center; background:rgba(239,68,68,0.14); border:1px solid rgba(239,68,68,0.28);">
                            <iconify-icon icon="solar:shield-warning-bold-duotone" width="46" style="color:#fb7185;"></iconify-icon>
                        </div>
                        <div style="display:inline-flex; align-items:center; gap:8px; margin-bottom:18px; padding:8px 14px; border-radius:999px; background:rgba(255,255,255,0.07); color:#cbd5e1; font-size:11px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">
                            Maintenance en cours
                        </div>
                        <h1 id="newket-maintenance-title" style="font-size:clamp(2rem, 4vw, 2.8rem); font-weight:950; line-height:1.05; margin:0 0 14px; color:#ffffff;">Le site est en Maintenance</h1>
                        <p id="newket-maintenance-description" style="color:#cbd5e1; max-width:500px; margin:0 auto; line-height:1.75; font-size:15px;">
                            L&apos;acc&egrave;s public est temporairement suspendu. Les clients, vendeurs et invit&eacute;s ne peuvent pas naviguer ni effectuer d&apos;actions pendant cette p&eacute;riode.
                        </p>
                        <p style="color:#94a3b8; max-width:440px; margin:12px auto 0; line-height:1.65; font-size:13px;">
                            L&apos;&eacute;quipe admin garde l&apos;acc&egrave;s pour la supervision et le r&eacute;tablissement du service.
                        </p>
                        <div style="margin-top:30px; display:flex; justify-content:center;">
                            <button onclick="(async()=>{try{if(window.supabaseClient)await window.supabaseClient.auth.signOut();}catch(_){}window.location.href='/login';})()" style="display:inline-flex; align-items:center; justify-content:center; min-height:48px; padding:0 20px; border-radius:16px; background:#ffffff; color:#0f172a; border:none; cursor:pointer; font-size:12px; font-weight:900; letter-spacing:.12em; text-transform:uppercase;">
                                Acc&egrave;s admin
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
        };
        const isMaintenanceViewActive = () => document.body?.dataset?.newketMaintenanceView === '1';
        const renderMaintenanceView = () => {
            document.documentElement.classList.remove('auth-loading');
            document.body.dataset.newketMaintenanceView = '1';
            document.body.innerHTML = `
                <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; background:radial-gradient(circle at top, #1f2937 0%, #0b1220 52%, #050816 100%); color:#fff; font-family:'Inter', sans-serif; text-align:center; padding:24px;">
                    <div style="width:min(560px, 100%); padding:40px 32px; border-radius:28px; background:rgba(17,24,39,0.72); border:1px solid rgba(255,255,255,0.08); box-shadow:0 30px 80px rgba(0,0,0,0.35); backdrop-filter:blur(18px);">
                        <div style="width:84px; height:84px; margin:0 auto 20px; border-radius:28px; display:flex; align-items:center; justify-content:center; background:rgba(239,68,68,0.14); border:1px solid rgba(239,68,68,0.28);">
                            <iconify-icon icon="solar:shield-warning-bold-duotone" width="42" style="color:#fb7185;"></iconify-icon>
                        </div>
                        <div style="display:inline-flex; align-items:center; gap:8px; margin-bottom:18px; padding:8px 14px; border-radius:999px; background:rgba(255,255,255,0.06); color:#cbd5e1; font-size:11px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">
                            Maintenance en cours
                        </div>
                        <h1 style="font-size:clamp(1.9rem, 4vw, 2.6rem); font-weight:900; line-height:1.1; margin:0 0 14px;">Accès public suspendu</h1>
                        <p style="color:#cbd5e1; max-width:460px; margin:0 auto; line-height:1.7; font-size:15px;">
                            Les clients, vendeurs et invités ne peuvent pas utiliser la plateforme pendant cette fenêtre de maintenance.
                            L’espace administrateur reste disponible pour la connexion et la supervision.
                        </p>
                        <div style="margin-top:28px; display:flex; justify-content:center;">
                            <button onclick="(async()=>{try{if(window.supabaseClient)await window.supabaseClient.auth.signOut();}catch(_){}window.location.href='/login';})()" style="display:inline-flex; align-items:center; justify-content:center; min-height:48px; padding:0 20px; border-radius:16px; background:#ffffff; color:#0f172a; border:none; cursor:pointer; font-size:12px; font-weight:900; letter-spacing:.12em; text-transform:uppercase;">
                                Se connecter en admin
                            </button>
                        </div>
                    </div>
                </div>
            `;
        };
        const syncMaintenanceState = () => {
            const shouldBlockPublic = window.newketConfig?.maintenanceMode === true && !isAdmin;
            const currentPath = window.location.pathname;
            const isAdminPath = currentPath.includes('/admin/');
            const isLoginPath = currentPath.includes('/login');

            if (shouldBlockPublic && !isAdminPath && !isLoginPath) {
                renderMaintenanceOverlay();
                return;
            }

            if (!shouldBlockPublic && isMaintenanceViewActive()) {
                removeMaintenanceOverlay();
                window.location.reload();
            }
        };

        window.addEventListener('configUpdated', syncMaintenanceState);
        window.addEventListener('maintenanceModeChanged', syncMaintenanceState);

        // Set Sentry user for context if logged in
        if (isLoggedIn && currentUser) {
            setSentryUser({ id: currentUser.id, email: currentUser.email, role: currentRole });
        }

        // Check Maintenance Mode
        syncMaintenanceState();
        if (window.newketConfig?.maintenanceMode === true && !isAdmin && isMaintenanceViewActive()) {
            return; // Halt further initialization
        }

        // ── AFFICHAGE IMMÉDIAT ──────────────────────────────────────────────
        // L'auth est vérifiée (AuthManager.init() est terminé).
        // On retire la classe de chargement maintenant pour afficher les skeletons
        // déjà présents dans le HTML, pendant que les managers chargent en arrière-plan.
        document.documentElement.classList.remove('auth-loading');
        window.newketInitialized = true;
        window.dispatchEvent(new CustomEvent('newketInitialized'));
        // ───────────────────────────────────────────────────────────────────

        // 3. Initialize UI State (synchrone, instantané)
        if (window.CurrencyManager) {
            CurrencyManager.init();
        }
        if (window.FavoritesManager) {
            FavoritesManager.updateUI();
        }

        // 4. Global Event Listeners
        this.bindGlobalEvents();

        // ── MANAGERS EN ARRIÈRE-PLAN (non-bloquants) ────────────────────────
        // On ne bloque plus l'affichage. Les skeletons se remplacent par les vraies
        // données dès que chaque manager a fini de charger.
        (async () => {
            const backendReady = await resolveLocalBackendReady();
            window.newketBackendReady = backendReady;
            if (!backendReady && isLocalHost) {
                console.warn('[NewKet App] Local backend unavailable. Skipping API-backed managers until /api/health is reachable.');
            }

            const initPromises = [];
            if (window.ProductManager && backendReady) initPromises.push(ProductManager.init());

            // Orders are needed for customer + vendor dashboards too.
            if (window.OrderManager && isLoggedIn && backendReady) initPromises.push(OrderManager.init());
            if (window.UserManager && isAdmin && backendReady) initPromises.push(UserManager.init());

            // Managed Utilities
            if (window.PromoManager && isAdmin && backendReady) initPromises.push(PromoManager.init().catch(e => console.warn('[App] PromoManager init failed (non-blocking):', e.message)));
            if (window.ActivityManager && isAdmin && backendReady) initPromises.push(ActivityManager.init().catch(e => console.warn('[App] ActivityManager init failed (non-blocking):', e.message)));
            if (window.NotificationManager && isLoggedIn && backendReady) initPromises.push(NotificationManager.init().catch(e => console.warn('[App] NotificationManager init failed (non-blocking):', e.message)));
            if (window.FavoritesManager && isLoggedIn && backendReady) initPromises.push(FavoritesManager.syncFromSupabase().catch(e => console.warn('[App] FavoritesManager sync failed (non-blocking):', e.message)));

            const initResults = await Promise.allSettled(initPromises);
            initResults.forEach((result) => {
                if (result.status === 'rejected') {
                    const message = result.reason?.message || String(result.reason || 'Unknown error');
                    console.warn('[App] Non-blocking init failure:', message);
                }
            });

            // Mettre à jour les favoris une fois les données prêtes
            if (window.FavoritesManager) {
                FavoritesManager.updateUI();
            }
        })().catch(e => console.warn('[App] Background init error:', e?.message));
        // ───────────────────────────────────────────────────────────────────
    },

    bindGlobalEvents() {
        const setMobileMenuState = (isOpen, restoreFocus = false) => {
            const menu = document.getElementById('mobileMenu');
            const overlay = document.getElementById('mobileOverlay');
            const openBtn = document.getElementById('mobileMenuBtn');
            const closeBtn = document.getElementById('closeMobileMenu');

            if (!menu || !overlay) return;

            menu.classList.toggle('active', isOpen);
            overlay.classList.toggle('active', isOpen);
            document.documentElement.classList.toggle('mobile-menu-open', isOpen);
            document.body.classList.toggle('mobile-menu-open', isOpen);

            if (isOpen) {
                overlay.classList.remove('hidden');
                overlay.style.display = 'block';
                menu.style.transform = 'translateX(0)';
                menu.style.opacity = '1';
                menu.style.pointerEvents = 'auto';
                menu.style.visibility = 'visible';
                overlay.style.opacity = '1';
                overlay.style.pointerEvents = 'auto';
                overlay.style.background = window.matchMedia('(min-width: 1024px)').matches
                    ? 'rgba(2, 6, 23, 0.28)'
                    : 'rgba(0, 0, 0, 0.5)';
                overlay.style.webkitBackdropFilter = window.matchMedia('(min-width: 1024px)').matches
                    ? 'blur(14px)'
                    : 'blur(3px)';
                overlay.style.backdropFilter = window.matchMedia('(min-width: 1024px)').matches
                    ? 'blur(14px)'
                    : 'blur(3px)';
                try { window.dispatchEvent(new CustomEvent('nativeOverlayOpen')); } catch (_) {}
            } else {
                menu.style.transform = 'translateX(-100%)';
                menu.style.opacity = '0';
                menu.style.pointerEvents = 'none';
                menu.style.visibility = 'hidden';
                overlay.style.opacity = '0';
                overlay.style.pointerEvents = 'none';
                overlay.classList.add('hidden');
                overlay.style.display = 'none';
                try { window.dispatchEvent(new CustomEvent('nativeOverlayClose')); } catch (_) {}
            }

            if (openBtn) openBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            overlay.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
            menu.setAttribute('aria-hidden', isOpen ? 'false' : 'true');

            if (restoreFocus && !isOpen && openBtn) {
                openBtn.focus();
            } else if (isOpen && closeBtn) {
                closeBtn.focus();
            }
        };

        const closeMobileMenu = (restoreFocus = true) => setMobileMenuState(false, restoreFocus);
        window.closeMobileMenu = closeMobileMenu;
        window.openMobileMenu = () => setMobileMenuState(true);

        const normalizeBottomNavPath = (value) => {
            if (!value) return '/';

            try {
                const url = new URL(value, window.location.origin);
                let path = url.pathname || '/';
                path = path.replace(/\/index\.html$/i, '/');
                path = path.replace(/^\/src\/pages/i, '').replace(/\.html$/i, '');
                if (path.length > 1 && path.endsWith('/')) {
                    path = path.slice(0, -1);
                }
                return path || '/';
            } catch (_) {
                let path = String(value).split('?')[0].split('#')[0] || '/';
                path = path.replace(/\/index\.html$/i, '/');
                path = path.replace(/^\/src\/pages/i, '').replace(/\.html$/i, '');
                if (path.length > 1 && path.endsWith('/')) {
                    path = path.slice(0, -1);
                }
                return path || '/';
            }
        };

        // 🗺️ Table de Filiation Intelligente (Option B : Onglets Parents)
        const ROUTE_PARENT_MAP = {
            // Filiation Catalogue
            '/product': 'catalog',
            '/lens': 'catalog',
            '/promo': 'catalog',

            // Filiation Boutiques / Vendre
            '/shop': 'shops',
            '/shops': 'shops',
            '/seller': 'sell',
            '/seller-onboarding': 'sell',
            '/publish': 'sell',

            // Filiation Panier & Tunnel d'achat
            '/achat': 'cart',
            '/payment-success': 'cart',
            '/payment-cancel': 'cart',
            '/invoice-verify': 'cart',

            // Filiation Compte utilisateur
            '/settings': 'account',
            '/favorites': 'account',
            '/customer-dashboard': 'account',
            '/vendor-dashboard': 'account',
            '/choose-role': 'account',
            '/reset-password': 'account',
            '/notifications': 'notifications'
        };

        let bottomNavRaf = 0;
        let bottomNavObserver = null;
        const syncMobileBottomNav = () => {
            const currentPath = normalizeBottomNavPath(window.location.href);

            // Synchronise avec la TabBar 100% native SwiftUI (iOS 26 Liquid Glass)
            try {
                if (window.Capacitor?.Plugins?.NativeTabBar) {
                    const activeTabId = ROUTE_PARENT_MAP[currentPath] || (currentPath === '/' || currentPath === '' ? 'home' : null);
                    if (activeTabId) {
                        window.Capacitor.Plugins.NativeTabBar.setActiveTab({ tabId: activeTabId }).catch(() => {});
                    }
                }
            } catch (_) {}

            const nav = document.getElementById('mobileBottomNav');
            const items = nav ? Array.from(nav.querySelectorAll('[data-bottom-nav-item]')) : [];

            if (!nav || items.length === 0) return;

            // 1. Recherche par correspondance exacte d'URL sur les onglets
            let activeItem = items.find((item) => {
                const href = item.getAttribute('href');
                if (!href || href === '#') return false;
                if (href.startsWith('javascript:')) return false;
                return normalizeBottomNavPath(href) === currentPath;
            });

            // 2. Si pas de match direct, recherche par filiation parent (Option B)
            if (!activeItem) {
                const parentKey = ROUTE_PARENT_MAP[currentPath];
                if (parentKey) {
                    activeItem = items.find((item) => {
                        const navKey = item.dataset.bottomNavItem;
                        if (navKey === parentKey) return true;
                        // Option A: match strict, les boutiques ne surbrillent pas l'onglet vendre d'un vendeur
                        if (parentKey === 'notifications' && navKey === 'cart') return true;
                        return false;
                    });
                }
            }

            // 3. Cas de la racine / Accueil
            if (!activeItem && (currentPath === '/' || currentPath === '')) {
                activeItem = items.find((item) => item.dataset.bottomNavItem === 'home');
            }

            // 4. Si la page n'a aucun parent direct (ex: /faq, /about, /terms, /404)
            // activeItem reste null : aucun onglet n'est faussement allumé, et la pastille s'efface

            items.forEach((item) => {
                const isActive = !!(activeItem && item === activeItem);
                item.classList.toggle('active', isActive);
                if (isActive) {
                    item.setAttribute('aria-current', 'page');
                } else {
                    item.removeAttribute('aria-current');
                }
                // Switch icône linear ↔ bold (filled) selon l'état actif
                const iconEl = item.querySelector('iconify-icon');
                if (iconEl) {
                    const currentIcon = iconEl.getAttribute('icon') || '';
                    if (isActive) {
                        iconEl.setAttribute('icon', currentIcon.replace(/-linear$/, '-bold'));
                    } else {
                        iconEl.setAttribute('icon', currentIcon.replace(/-bold$/, '-linear'));
                    }
                }
            });

            // Synchronise avec la TabBar 100% native SwiftUI (iOS 26 Liquid Glass)
            try {
                if (window.Capacitor?.Plugins?.NativeTabBar) {
                    const activeTabId = activeItem ? (activeItem.dataset?.bottomNavItem || 'home') : '';
                    if (activeTabId) {
                        window.Capacitor.Plugins.NativeTabBar.setActiveTab({ tabId: activeTabId }).catch(() => {});
                    }
                }
            } catch (_) {}

            // Positionne la pastille glissante Liquid Glass (iOS Capacitor uniquement)
            const slider = document.getElementById('liquidGlassSlider');
            if (slider) {
                const isLiquidGlass = nav.classList.contains('liquid-glass-nav');
                if (!isLiquidGlass) {
                    slider.style.display = 'none';
                } else if (activeItem) {
                    slider.style.display = '';
                    const navRect = nav.getBoundingClientRect();
                    const itemRect = activeItem.getBoundingClientRect();
                    if (navRect.width > 0 && itemRect.width > 0) {
                        const leftOffset = itemRect.left - navRect.left;
                        slider.style.width = `${itemRect.width}px`;
                        slider.style.transform = `translate3d(${leftOffset}px, -50%, 0)`;
                        slider.style.opacity = ''; // Rétablit l'opacité CSS standard
                    }
                } else {
                    // Page orpheline hors navbar : la pastille s'estompe discrètement
                    slider.style.opacity = '0';
                }
            }
        };

        const scheduleMobileBottomNavSync = () => {
            if (bottomNavRaf) return;

            bottomNavRaf = window.requestAnimationFrame(() => {
                bottomNavRaf = 0;
                syncMobileBottomNav();
            });
        };

        const watchForMobileBottomNav = () => {
            if (document.getElementById('mobileBottomNav') || bottomNavObserver || !window.MutationObserver) {
                return;
            }

            const observerTarget = document.body || document.documentElement;
            if (!observerTarget) return;

            bottomNavObserver = new MutationObserver(() => {
                if (!document.getElementById('mobileBottomNav')) return;

                bottomNavObserver?.disconnect();
                bottomNavObserver = null;
                scheduleMobileBottomNavSync();
            });

            bottomNavObserver.observe(observerTarget, { childList: true, subtree: true });
        };

        // Sync Favorites across tabs
        window.addEventListener('storage', (e) => {
            if (e.key === 'newketFavorites' && window.FavoritesManager) FavoritesManager.updateUI();
        });

        // PWA Install prompt
        window.addEventListener('pwaInstallAvailable', () => {
            const btn = document.getElementById('pwa-install-btn');
            if (btn) btn.classList.remove('hidden');
        });



        // Add to Wishlist global handler
        window.addToWishlist = (productId, event) => {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            if (!productId || !window.FavoritesManager) return;

            const isFavorite = FavoritesManager.isInFavorites(productId);
            if (isFavorite) {
                FavoritesManager.removeItem(productId);
            } else {
                // Try to get product data from manager or card
                const product = this.resolveProductData(productId, event?.currentTarget);
                FavoritesManager.addItem(product);
                // Shake the favorites icon in the header
                App.shakeFavoritesIcon();
            }
            FavoritesManager.updateUI();
        };

        // Mobile Menu & Search Handlers (Event Delegation)
        document.addEventListener('click', (e) => {
            // Mobile Menu Open
            if (e.target.closest('#mobileMenuBtn')) {
                setMobileMenuState(true);
                return;
            }

            // Mobile Menu Close
            if (e.target.closest('#closeMobileMenu') || e.target.closest('#mobileOverlay')) {
                closeMobileMenu(true);
                return;
            }
        });

        document.getElementById('mobileOverlay')?.addEventListener('click', () => {
            closeMobileMenu(true);
        });

        document.addEventListener('pointerdown', (e) => {
            const menu = document.getElementById('mobileMenu');
            const overlay = document.getElementById('mobileOverlay');
            if (!menu || !overlay) return;
            const isOpen = menu.classList.contains('active');
            if (!isOpen) return;
            if (menu.contains(e.target)) return;
            if (e.target.closest('#mobileMenuBtn') || e.target.closest('#closeMobileMenu')) return;
            closeMobileMenu(true);
        }, true);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeMobileMenu(true);
            }
        });

        window.addEventListener('componentsLoaded', scheduleMobileBottomNavSync);
        window.addEventListener('resize', scheduleMobileBottomNavSync);
        window.addEventListener('orientationchange', scheduleMobileBottomNavSync);
        window.addEventListener('load', scheduleMobileBottomNavSync, { once: true });
        // 🍏 Synchronisation instantanée lors du retour arrière (iOS bfcache & popstate)
        window.addEventListener('pageshow', scheduleMobileBottomNavSync);
        window.addEventListener('popstate', scheduleMobileBottomNavSync);
        // 🛒 Synchronisation lors de la fermeture du panier
        window.addEventListener('cartClosed', scheduleMobileBottomNavSync);

        // Surveillance dynamique de la fermeture du tiroir panier (#cartSlideOver)
        const setupCartSlideOverObserver = () => {
            const cartSlideOver = document.getElementById('cartSlideOver');
            if (cartSlideOver && !cartSlideOver._navObserverAttached) {
                cartSlideOver._navObserverAttached = true;
                const observer = new MutationObserver(() => {
                    if (cartSlideOver.classList.contains('translate-x-full')) {
                        scheduleMobileBottomNavSync();
                    }
                });
                observer.observe(cartSlideOver, { attributes: true, attributeFilter: ['class'] });
            }
        };
        setupCartSlideOverObserver();
        window.addEventListener('componentsLoaded', setupCartSlideOverObserver);

        // 🍏 Réactivité en direct aux Réglages Système iOS (Accessibilité & Contraste)
        try {
            window.matchMedia('(prefers-reduced-transparency: reduce)').addEventListener('change', scheduleMobileBottomNavSync);
            window.matchMedia('(prefers-contrast: more)').addEventListener('change', scheduleMobileBottomNavSync);
        } catch (_) {}

        scheduleMobileBottomNavSync();
        watchForMobileBottomNav();


        // Scroll Direction Detection for Category Nav
        let lastScrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
        let accumulatedDelta = 0;
        let scrollTicking = false;
        const deltaThreshold = 18;
        const categoryNav = document.getElementById('categoryNav');
        const mobileSearch = document.getElementById('mobileSearchContainer');
        const mainHeader = document.querySelector('.main-header[data-header-shell="main"]');
        const headerLeadRow = mainHeader?.querySelector('.header-content > div:first-child');
        const isCatalogPage = (() => {
            try {
                const path = String(window.location?.pathname || '');
                return path.endsWith('/catalog.html') || path.includes('/catalog');
            } catch (_) {
                return false;
            }
        })();
        const headerScrollState = {
            searchOnSeparateRow: false
        };
        const scrollThreshold = 96;
        const compactThreshold = 72;
        const retractThreshold = 148;
        const isDesktopViewport = () => window.matchMedia('(min-width: 1024px)').matches;

        const syncHeaderLayoutState = () => {
            if (!mobileSearch || !mainHeader || !headerLeadRow) {
                headerScrollState.searchOnSeparateRow = false;
                return;
            }

            headerScrollState.searchOnSeparateRow =
                mobileSearch.offsetTop > (headerLeadRow.offsetTop + 8);
        };

        const applyHeaderScrollState = (scrollTop) => {
            if (!mainHeader) return;

            const clampedScrollTop = Math.max(0, scrollTop);
            const shouldElevate = clampedScrollTop > 10;

            // Catalog: keep header/menu stable like Index (no retract/compact hiding).
            if (isCatalogPage) {
                mainHeader.classList.toggle('scrolled', shouldElevate);
                mobileSearch?.classList.remove('search-bar-hidden');
                mainHeader.classList.remove('header-compact', 'header-retracted');
                accumulatedDelta = 0;
                lastScrollTop = clampedScrollTop;
                return;
            }

            // Desktop keeps the full header visible. The compact/retracted behavior
            // is reserved for smaller screens where vertical space is tighter.
            if (isDesktopViewport()) {
                mainHeader.classList.toggle('scrolled', shouldElevate);
                mobileSearch?.classList.remove('search-bar-hidden');
                mainHeader.classList.remove('header-compact', 'header-retracted');
                accumulatedDelta = 0;
                lastScrollTop = clampedScrollTop;
                return;
            }

            // If an overlay/modal locks the page scroll, avoid retracting/hiding header UI.
            // Otherwise the category/search rows can remain "swallowed" while the user is in a dialog.
            if (
                document.documentElement.classList.contains('overflow-hidden') ||
                document.body.classList.contains('overflow-hidden') ||
                document.documentElement.classList.contains('mobile-menu-open') ||
                document.body.classList.contains('mobile-menu-open') ||
                document.body.classList.contains('checkout-modal-open') ||
                document.querySelector('[role="dialog"][aria-modal="true"]:not([aria-hidden="true"])') ||
                document.querySelector('dialog[open]')
            ) {
                mobileSearch?.classList.remove('search-bar-hidden');
                mainHeader.classList.remove('header-compact', 'header-retracted');
                accumulatedDelta = 0;
                lastScrollTop = clampedScrollTop;
                return;
            }

            const diff = clampedScrollTop - lastScrollTop;

            if ((diff > 0 && accumulatedDelta < 0) || (diff < 0 && accumulatedDelta > 0)) {
                accumulatedDelta = 0;
            }

            accumulatedDelta += diff;
            mainHeader.classList.toggle('scrolled', shouldElevate);

            // Keep the mobile header fully visible: no compact/retract behavior,
            // no hidden search row, and no collapsed sections while scrolling.
            mobileSearch?.classList.remove('search-bar-hidden');
            mainHeader.classList.remove('header-compact', 'header-retracted');
            accumulatedDelta = 0;

            lastScrollTop = clampedScrollTop;
        };

        const queueHeaderScrollUpdate = () => {
            if (scrollTicking) return;

            scrollTicking = true;
            window.requestAnimationFrame(() => {
                applyHeaderScrollState(window.pageYOffset || document.documentElement.scrollTop || 0);
                scrollTicking = false;
            });
        };

        syncHeaderLayoutState();
        window.addEventListener('resize', syncHeaderLayoutState);
        if (document.fonts?.ready) {
            document.fonts.ready.then(syncHeaderLayoutState).catch(() => {});
        }
        if (window.ResizeObserver && mainHeader) {
            const headerScrollObserver = new ResizeObserver(syncHeaderLayoutState);
            headerScrollObserver.observe(mainHeader);
        }

        applyHeaderScrollState(lastScrollTop);
        window.addEventListener('scroll', queueHeaderScrollUpdate, { passive: true });

        // Global Modal Manager — with robust touch scroll-lock and reference counting
        const setupGlobalModals = () => {
            window.NewKet = window.NewKet || {};
            
            let _lockCount = 0;
            let _savedScrollY = 0;
            let _failsafeTimer = null;

            const lockBodyScroll = () => {
                _lockCount++;
                if (_lockCount > 1) return; // Already locked
                
                _savedScrollY = window.scrollY || window.pageYOffset || 0;
                document.body.style.position = 'fixed';
                document.body.style.top = `-${_savedScrollY}px`;
                document.body.style.left = '0';
                document.body.style.right = '0';
                document.body.style.overflow = 'hidden';
                document.body.style.overscrollBehavior = 'none';

                // Failsafe: if locked for more than 15 seconds, assume a modal was closed without unlocking
                clearTimeout(_failsafeTimer);
                _failsafeTimer = setTimeout(() => {
                    if (_lockCount > 0) {
                        console.warn('[NewKet] Scroll lock failsafe triggered (15s) — force releasing lock.');
                        resetScrollLock();
                    }
                }, 15000);
            };

            const unlockBodyScroll = () => {
                if (_lockCount <= 0) return;
                _lockCount--;
                if (_lockCount > 0) return; // Still other locks active

                clearTimeout(_failsafeTimer);
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.left = '';
                document.body.style.right = '';
                document.body.style.overflow = '';
                document.body.style.overscrollBehavior = '';
                window.scrollTo({ top: _savedScrollY, left: 0, behavior: 'instant' });
            };

            const resetScrollLock = () => {
                _lockCount = 0;
                clearTimeout(_failsafeTimer);
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.left = '';
                document.body.style.right = '';
                document.body.style.overflow = '';
                document.body.style.overscrollBehavior = '';
                window.scrollTo({ top: _savedScrollY, left: 0, behavior: 'instant' });
            };

            // Expose globally
            window._newketLockScroll = lockBodyScroll;
            window._newketUnlockScroll = unlockBodyScroll;
            window.NewKet.scrollLock = {
                lock: lockBodyScroll,
                unlock: unlockBodyScroll,
                reset: resetScrollLock
            };

            // Helper: check if a node looks like a modal backdrop
            const isModalNode = (node) => {
                if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
                const id = (node.id || '').toLowerCase();
                const cls = node.className || '';
                return (
                    id.includes('modal') ||
                    node.hasAttribute('role') && node.getAttribute('role') === 'dialog' ||
                    (typeof cls === 'string' && (cls.includes('modal') || cls.includes('inset-0'))) ||
                    node.matches('[id$="Modal"],[id$="modal"],[id*="Modal"],[id*="modal"]')
                );
            };

            // Helper: check if a node is currently visible
            const isNodeVisible = (node) => {
                if (!node) return false;
                const style = window.getComputedStyle(node);
                return (
                    style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    style.opacity !== '0' &&
                    !node.classList.contains('hidden')
                );
            };

            // Handle clicking outside modal to close it
            document.addEventListener('mousedown', (e) => {
                const target = e.target;
                if (isModalNode(target) && target.classList.contains('fixed')) {
                    const closeBtn = target.querySelector('[data-action*="close"], [onclick*="close"], .close-modal, #closeModalBtn, button:has(iconify-icon[icon*="close"])');
                    if (closeBtn) {
                        closeBtn.click();
                    } else {
                        target.classList.add('hidden');
                        target.classList.remove('flex');
                        target.style.display = 'none';
                    }
                }
            });
            
            // Handle Escape key to close top modal
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    const modals = Array.from(document.querySelectorAll('.fixed.inset-0, [role="dialog"], [id$="Modal"], [id$="modal"]')).filter(m => isModalNode(m) && isNodeVisible(m) && m.classList.contains('fixed'));
                    if (modals.length > 0) {
                        modals.sort((a, b) => parseInt(window.getComputedStyle(b).zIndex || 0) - parseInt(window.getComputedStyle(a).zIndex || 0));
                        const topModal = modals[0];
                        const closeBtn = topModal.querySelector('[data-action*="close"], [onclick*="close"], .close-modal, #closeModalBtn, button:has(iconify-icon[icon*="close"])');
                        if (closeBtn) {
                            closeBtn.click();
                        } else {
                            topModal.classList.add('hidden');
                            topModal.classList.remove('flex');
                            topModal.style.display = 'none';
                        }
                    }
                }
            });
        };

        setupGlobalModals();
    },

    shakeFavoritesIcon() {
        const favLinks = document.querySelectorAll('a[href*="favorites"]');
        favLinks.forEach(link => {
            link.classList.remove('fav-shake');
            // Force reflow to restart animation
            void link.offsetWidth;
            link.classList.add('fav-shake');
            link.addEventListener('animationend', () => link.classList.remove('fav-shake'), { once: true });
        });
    },


    resolveProductId(element) {
        const card = element.closest('.product-card');
        if (card && card.dataset.productId) return card.dataset.productId;
        // Fallback to name-based ID
        const titleEl = card?.querySelector('.product-title a, .product-title, h3');
        return titleEl ? titleEl.textContent.trim().toLowerCase().replace(/\s+/g, '-') : 'unknown';
    },

    resolveProductData(productId, element) {
        // Try manager first
        if (window.ProductManager) {
            const p = ProductManager.getProduct(productId);
            if (p) return p;
        }

        // Fallback: Scrape from closest card or page
        const card = element?.closest('.product-card');
        const nameEl = card?.querySelector('.product-title a, .product-title, h3') || document.querySelector('h1, #product-name');
        const priceEl = card?.querySelector('[data-price-cdf], .current-price') || document.querySelector('[data-price-cdf], #product-price');
        const imgEl = card?.querySelector('img') || document.querySelector('.main-image, #mainImage');

        return {
            id: productId,
            name: nameEl?.textContent.trim() || 'Produit',
            price: priceEl?.dataset.priceCdf ? parseFloat(priceEl.dataset.priceCdf) : 0,
            image: imgEl?.src || 'https://res.cloudinary.com/dzhnphyp3/image/upload/f_auto,q_auto/v1782572380/newket_assets/frontend/src/assets/Images/default.jpg',
            category: 'Article'
        };
    }
};

window.App = App;

// Bootstrap: guard against DOMContentLoaded already fired (ES module behavior with Vite)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}

// --- OFFLINE/ONLINE LISTENER ---
window.addEventListener('offline', () => {
    if (window.UI) {
        window.UI.showToast("Vous êtes hors ligne. Mode lecture seule activé.", 'warning');
        document.body.classList.add('is-offline');
    }
});

window.addEventListener('online', () => {
    if (window.UI) {
        window.UI.showToast("Connexion rétablie ! Les données sont à jour.", 'success');
        document.body.classList.remove('is-offline');
        // Refresh cache optionally
    }
});
// -------------------------------

// === 🍏 iOS Capacitor Native Haptics & Liquid Glass Button Enhancement ===
window.NewKetHaptics = {
    trigger: async (style = 'light') => {
        try {
            if (window.Capacitor?.isNativePlatform?.() && window.Capacitor.getPlatform?.() === 'ios') {
                const plugin = window.Capacitor.Plugins?.LiveActivityPlugin;
                if (plugin && typeof plugin.triggerHaptic === 'function') {
                    await plugin.triggerHaptic({ style });
                }
            }
        } catch (_) {}
    }
};

const setupIOSLiquidGlassButtons = () => {
    try {
        const isIOS = !!(window.Capacitor?.isNativePlatform?.() && window.Capacitor.getPlatform?.() === 'ios');
        if (!isIOS) return;

        // 1. Header Buttons (Menu Burger & Recherche)
        const headerButtons = [
            document.getElementById('mobileMenuBtn'),
            document.getElementById('mobileHeaderSearchBtn')
        ].filter(Boolean);

        headerButtons.forEach((btn) => {
            btn.classList.add('liquid-glass-btn');
            btn.addEventListener('touchstart', () => window.NewKetHaptics.trigger('light'), { passive: true });
        });

        // 2. Dashboard Buttons (Menu Burger & Déconnexion sur Customer, Vendor, Admin)
        const dashMenuBtns = [
            document.getElementById('customerMobileBtn'),
            document.getElementById('vendorMobileBtn'),
            document.getElementById('adminMobileBtn'),
            document.querySelector('[data-toggle-sidebar]')
        ].filter(Boolean);

        dashMenuBtns.forEach((btn) => {
            btn.classList.add('liquid-glass-btn');
            btn.addEventListener('touchstart', () => window.NewKetHaptics.trigger('light'), { passive: true });
        });

        const logoutBtns = Array.from(document.querySelectorAll('[data-logout-safe]'));
        logoutBtns.forEach((btn) => {
            btn.classList.add('liquid-glass-btn-danger');
            btn.addEventListener('touchstart', () => window.NewKetHaptics.trigger('medium'), { passive: true });
        });

        // 3. Bottom Nav Gesture Glissement au doigt (Swipe / Drag interactif)
        setupIOSLiquidGlassDragGesture();
    } catch (_) {}
};

/**
 * 🍏 Gesture Glissement Continu Apple (Drag & Magnetic Snap)
 * ✅ Suivi 1:1 du doigt en temps réel (targetLeft = fingerX - lensWidth/2)
 * ✅ Anti-click conflict : hasDragged empêche les clics parasites après un swipe
 * ✅ Rubber-band calibré : plafond strict à 8px max
 * ✅ Effet ressort : nav.pressed → scale(1.035) via CSS
 */
const setupIOSLiquidGlassDragGesture = () => {
    const nav = document.getElementById('mobileBottomNav');
    const slider = document.getElementById('liquidGlassSlider');
    if (!nav || !slider || nav.dataset.dragInitialized === 'true') return;
    nav.dataset.dragInitialized = 'true';

    let isDragging = false;
    let hasDragged = false;        // ✅ Anti-click : detecte un vrai swipe
    let startX = 0;
    let pointerId = null;
    let lastHighlightedItem = null;

    const getItems = () => Array.from(nav.querySelectorAll('[data-bottom-nav-item]'));

    const findClosestItem = (clientX) => {
        const items = getItems();
        let closest = null;
        let minDistance = Infinity;

        items.forEach((item) => {
            const rect = item.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const dist = Math.abs(clientX - centerX);
            if (dist < minDistance) {
                minDistance = dist;
                closest = item;
            }
        });
        return closest;
    };

    const updateLens = (item, isPopped = false, customX = null) => {
        if (!item || !slider) return;
        const navRect = nav.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();
        if (navRect.width <= 0 || itemRect.width <= 0) return;

        // ✅ Débordement +28px total (±14px chaque côté) en mode pressé
        const extraSide = isPopped ? 28 : 0;
        const baseOffset = (itemRect.left - navRect.left) - (extraSide / 2);
        const finalOffset = customX !== null ? customX : baseOffset;

        slider.style.width = `${itemRect.width + extraSide}px`;
        slider.style.transform = `translate3d(${finalOffset}px, -50%, 0)`;
    };

    const highlightItem = (item) => {
        if (!item || item === lastHighlightedItem) return;
        lastHighlightedItem = item;
        getItems().forEach((it) => {
            const isMatch = it === item;
            it.classList.toggle('active', isMatch);
            // Switch icône linear ↔ bold (filled)
            const iconEl = it.querySelector('iconify-icon');
            if (iconEl) {
                const currentIcon = iconEl.getAttribute('icon') || '';
                if (isMatch) {
                    iconEl.setAttribute('icon', currentIcon.replace(/-linear$/, '-bold'));
                } else {
                    iconEl.setAttribute('icon', currentIcon.replace(/-bold$/, '-linear'));
                }
            }
        });
    };

    // 🍏 Formule Rubber-Band Apple calibrée : plafond strict à 8px max
    const rubberBand = (overflow, maxAllowed = 8) => {
        if (overflow <= 0) return 0;
        return (overflow * maxAllowed) / (overflow + 30);
    };

    const handleStart = (clientX, pId = null) => {
        isDragging = true;
        hasDragged = false;
        startX = clientX;
        pointerId = pId;

        // ✅ Effet ressort : navbar zoome au scale(1.035) via CSS .pressed
        nav.classList.add('pressed');
        slider.classList.add('is-dragging');
        lastHighlightedItem = null;

        const target = findClosestItem(clientX);
        if (target) highlightItem(target);

        if (pId !== null && typeof nav.setPointerCapture === 'function') {
            try { nav.setPointerCapture(pId); } catch (_) {}
        }

        if (target) updateLens(target, true);
    };

    const handleMove = (clientX) => {
        if (!isDragging) return;

        // ✅ Anti-click : si déplacement > 4px → c'est un vrai swipe
        if (Math.abs(clientX - startX) > 4) {
            hasDragged = true;
        }

        const items = getItems();
        const navRect = nav.getBoundingClientRect();
        const firstRect = items[0].getBoundingClientRect();
        const lastRect = items[items.length - 1].getBoundingClientRect();

        const target = findClosestItem(clientX);
        if (target) highlightItem(target);

        const activeItem = target || lastHighlightedItem || items[0];
        const itemRect = activeItem.getBoundingClientRect();
        const extraSide = 28;
        const lensWidth = itemRect.width + extraSide;

        // ✅ Suivi 1:1 du doigt : le centre de la capsule suit le doigt exactement
        let targetLeft = (clientX - navRect.left) - (lensWidth / 2);

        const minLeft = (firstRect.left - navRect.left) - (extraSide / 2);
        const maxLeft = (lastRect.left - navRect.left) - (extraSide / 2);

        // Rubber-band aux extrémités
        if (targetLeft < minLeft) {
            const overflow = minLeft - targetLeft;
            targetLeft = minLeft - rubberBand(overflow, 8);
        } else if (targetLeft > maxLeft) {
            const overflow = targetLeft - maxLeft;
            targetLeft = maxLeft + rubberBand(overflow, 8);
        }

        slider.style.transition = 'none';
        slider.style.width = `${lensWidth}px`;
        slider.style.transform = `translate3d(${targetLeft}px, -50%, 0)`;
    };

    let isNavigating = false;

    const handleEnd = () => {
        if (!isDragging) return;
        isDragging = false;

        // ✅ Relâchement : navbar rebondit sur scale(1) avec spring cubic-bezier
        nav.classList.remove('pressed');
        slider.classList.remove('is-dragging');
        slider.style.transition = '';

        if (lastHighlightedItem) {
            updateLens(lastHighlightedItem, false);

            // ✅ S'il y a eu un glissement (drag), l'utilisateur a relâché sur un item cible :
            // on déclenche la navigation vers cet item relâché.
            // Si c'était un simple tap (hasDragged === false), on ne fait RIEN ici :
            // l'événement click natif du navigateur sur la balise <a> ou <button> s'exécute déjà naturellement !
            // Faire window.location.href en plus du click natif provoquait une double navigation et corrompait l'historique iOS.
            if (hasDragged) {
                const href = lastHighlightedItem.getAttribute('href');
                const navItemType = lastHighlightedItem.getAttribute('data-bottom-nav-item');

                if (navItemType === 'cart' || (href && (href === '#' || href.startsWith('javascript:')))) {
                    if (window.CartManager && typeof window.CartManager.toggleCartUI === 'function') {
                        window.CartManager.toggleCartUI();
                    } else {
                        lastHighlightedItem.click();
                    }
                } else if (href && href !== '#' && !href.startsWith('javascript:')) {
                    if (!isNavigating) {
                        isNavigating = true;
                        setTimeout(() => {
                            window.location.href = href;
                        }, 80);
                    }
                } else {
                    lastHighlightedItem.click();
                }
            }
        }

        setTimeout(() => { hasDragged = false; }, 60);
    };

    // Empêcher la double exécution si pointerdown a déjà pris en charge le geste
    let usingPointer = false;

    // Pointer Events modernes (prioritaires)
    nav.addEventListener('pointerdown', (e) => {
        if (e.isPrimary === false) return;
        usingPointer = true;
        handleStart(e.clientX, e.pointerId);
    });

    nav.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        handleMove(e.clientX);
    });

    nav.addEventListener('pointerup', handleEnd);
    nav.addEventListener('pointercancel', handleEnd);

    // Fallback Touch Events UNIQUEMENT si pointer events n'ont pas démarré
    nav.addEventListener('touchstart', (e) => {
        if (usingPointer) return;
        if (e.touches.length !== 1) return;
        handleStart(e.touches[0].clientX);
    }, { passive: true });

    nav.addEventListener('touchmove', (e) => {
        if (usingPointer || !isDragging || e.touches.length !== 1) return;
        handleMove(e.touches[0].clientX);
    }, { passive: true });

    nav.addEventListener('touchend', (e) => {
        if (usingPointer) {
            // Réinitialise le flag pour le prochain toucher après le cycle complet d'événements
            setTimeout(() => { usingPointer = false; }, 100);
            return;
        }
        handleEnd();
    }, { passive: true });

    nav.addEventListener('touchcancel', (e) => {
        if (usingPointer) {
            setTimeout(() => { usingPointer = false; }, 100);
            return;
        }
        handleEnd();
    }, { passive: true });
};

window.addEventListener('DOMContentLoaded', setupIOSLiquidGlassButtons);
window.addEventListener('componentsLoaded', setupIOSLiquidGlassButtons);

/**
 * Gestionnaire universel de partage NewKet :
 * 1. Sur iOS Capacitor natif : utilise LiveActivityPlugin.share() (UIActivityViewController natif Apple)
 * 2. Sur Web / Android avec Web Share API : utilise navigator.share()
 * 3. Fallback universel : copie automatique dans le presse-papier + notification toast
 */
window.NewKetShare = async function ({ title, text, url } = {}) {
    const shareUrl = url || window.location.href;
    const shareTitle = title || document.title || 'NewKet';
    const shareText = text || '';

    // Détection plugin natif Capacitor iOS
    const nativePlugin = window.Capacitor?.Plugins?.LiveActivityPlugin;
    if (nativePlugin && typeof nativePlugin.share === 'function') {
        try {
            const res = await nativePlugin.share({
                title: shareTitle,
                text: shareText,
                url: shareUrl
            });
            return { success: true, method: 'native-ios', details: res };
        } catch (err) {
            console.warn('[NewKetShare] Native iOS share sheet error or canceled:', err);
            // Si l'utilisateur a annulé, on ne force pas le fallback clipboard
            const errStr = String(err?.message || err || '');
            if (errStr.toLowerCase().includes('cancel') || errStr.toLowerCase().includes('abort')) {
                return { success: false, method: 'native-ios-canceled' };
            }
        }
    }

    // Web Share API standard (Safari mobile, Chrome Android, etc.)
    if (navigator.share) {
        try {
            await navigator.share({
                title: shareTitle,
                text: shareText,
                url: shareUrl
            });
            return { success: true, method: 'web-share' };
        } catch (err) {
            if (err && (err.name === 'AbortError' || err.code === 20)) {
                return { success: false, method: 'web-share-canceled' };
            }
            console.warn('[NewKetShare] navigator.share failed, fallback to clipboard:', err);
        }
    }

    // Fallback presse-papier
    let copied = false;
    if (window.copyTextToClipboard) {
        copied = await window.copyTextToClipboard(shareUrl);
    } else if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(shareUrl);
            copied = true;
        } catch {
            copied = false;
        }
    }

    if (window.showToast) {
        window.showToast(copied ? 'Lien copié dans le presse-papier !' : 'Impossible de copier le lien.', copied ? 'success' : 'error');
    }

    return { success: copied, method: 'clipboard' };
};

