/* NewKet EMarket - Main Orchestrator */
import { initSentry, setSentryUser } from './sentry.js';

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
                            <button onclick="(async()=>{try{if(window.supabaseClient)await window.supabaseClient.auth.signOut();}catch(_){}window.location.href='/src/pages/login.html';})()" style="display:inline-flex; align-items:center; justify-content:center; min-height:48px; padding:0 20px; border-radius:16px; background:#ffffff; color:#0f172a; border:none; cursor:pointer; font-size:12px; font-weight:900; letter-spacing:.12em; text-transform:uppercase;">
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
                            <button onclick="(async()=>{try{if(window.supabaseClient)await window.supabaseClient.auth.signOut();}catch(_){}window.location.href='/src/pages/login.html';})()" style="display:inline-flex; align-items:center; justify-content:center; min-height:48px; padding:0 20px; border-radius:16px; background:#ffffff; color:#0f172a; border:none; cursor:pointer; font-size:12px; font-weight:900; letter-spacing:.12em; text-transform:uppercase;">
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

        const backendReady = await resolveLocalBackendReady();
        window.newketBackendReady = backendReady;
        if (!backendReady && isLocalHost) {
            console.warn('[NewKet App] Local backend unavailable. Skipping API-backed managers until /api/health is reachable.');
        }

        // Product and Order managers now handle their own internal "immediate resolve" from cache
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

        // 3. Initialize UI State
        if (window.CurrencyManager) {
            CurrencyManager.init();
        }
        if (window.FavoritesManager) {
            FavoritesManager.updateUI();
        }

        // 4. Global Event Listeners
        this.bindGlobalEvents();

        // Remove the loading screen only when the entire app and all managers are ready.
        document.documentElement.classList.remove('auth-loading');
        window.newketInitialized = true;
        window.dispatchEvent(new CustomEvent('newketInitialized'));
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

            if (openBtn) openBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            overlay.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
            menu.setAttribute('aria-hidden', isOpen ? 'false' : 'true');

            if (restoreFocus && !isOpen && openBtn) {
                openBtn.focus();
            } else if (isOpen && closeBtn) {
                closeBtn.focus();
            }
        };

        const normalizeBottomNavPath = (value) => {
            if (!value) return '/';

            try {
                const url = new URL(value, window.location.origin);
                let path = url.pathname || '/';
                path = path.replace(/\/index\.html$/i, '/');
                if (path.length > 1 && path.endsWith('/')) {
                    path = path.slice(0, -1);
                }
                return path || '/';
            } catch (_) {
                let path = String(value).split('?')[0].split('#')[0] || '/';
                path = path.replace(/\/index\.html$/i, '/');
                if (path.length > 1 && path.endsWith('/')) {
                    path = path.slice(0, -1);
                }
                return path || '/';
            }
        };

        let bottomNavRaf = 0;
        let bottomNavObserver = null;
        const syncMobileBottomNav = () => {
            const nav = document.getElementById('mobileBottomNav');
            const indicator = nav?.querySelector('.nav-indicator');
            const items = nav ? Array.from(nav.querySelectorAll('[data-bottom-nav-item]')) : [];

            if (!nav || !indicator || items.length === 0) return;

            const currentPath = normalizeBottomNavPath(window.location.href);
            const activeItem = items.find((item) => {
                const href = item.getAttribute('href');
                if (!href || href === '#') return false;
                if (href.startsWith('javascript:')) return false;
                return normalizeBottomNavPath(href) === currentPath;
            }) || items.find((item) => item.dataset.bottomNavItem === 'home') || items[0];

            items.forEach((item) => {
                const isActive = item === activeItem;
                item.classList.toggle('active', isActive);
                if (isActive) {
                    item.setAttribute('aria-current', 'page');
                } else {
                    item.removeAttribute('aria-current');
                }
            });

            if (!activeItem) return;

            const navRect = nav.getBoundingClientRect();
            const itemRect = activeItem.getBoundingClientRect();
            const left = Math.max(0, itemRect.left - navRect.left);

            indicator.style.width = `${Math.max(0, itemRect.width)}px`;
            indicator.style.transform = `translate3d(${left}px, 0, 0)`;
            indicator.style.opacity = '1';
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
                setMobileMenuState(false, true);
                return;
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                setMobileMenuState(false, true);
            }
        });

        window.addEventListener('componentsLoaded', scheduleMobileBottomNavSync);
        window.addEventListener('resize', scheduleMobileBottomNavSync);
        window.addEventListener('orientationchange', scheduleMobileBottomNavSync);
        window.addEventListener('load', scheduleMobileBottomNavSync, { once: true });
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
                return path.endsWith('/catalog.html') || path.includes('/src/pages/catalog.html');
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
                document.body.style.touchAction = 'none';
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
                document.body.style.touchAction = '';
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
                document.body.style.touchAction = '';
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

            // Prevent touch scroll chaining: block touchmove on modal backdrop only
            document.addEventListener('touchmove', (e) => {
                if (_lockCount <= 0) return;
                const touch = e.touches[0];
                if (!touch) return;
                const el = document.elementFromPoint(touch.clientX, touch.clientY);
                if (!el) { e.preventDefault(); return; }
                // Walk up to find a scrollable container inside the modal
                let node = el;
                while (node && node !== document.body && node !== document.documentElement) {
                    const style = window.getComputedStyle(node);
                    const overflowY = style.overflowY;
                    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
                        return; // allow scroll inside this scrollable area
                    }
                    node = node.parentElement;
                }
                // No scrollable ancestor inside modal — block to prevent background scroll
                e.preventDefault();
            }, { passive: false });

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
