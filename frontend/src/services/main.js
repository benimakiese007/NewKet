/* NewKet EMarket - Main Orchestrator */
import { initSentry, setSentryUser } from './sentry.js';

window.newketConfig = {
    exchangeRate: 2500
};

// Admin email list is now centralized in auth.js for early initialization.
// window.ADMIN_EMAILS is available here via AuthManager/auth.js.
// ADMIN_PASSWORD intentionally removed — use Supabase Auth only.

const App = {
    async init() {
        // --- INITIALISATION SENTRY (Monitoring) ---
        initSentry();

        // --- GLOBAL APP FAIL-SAFE ---
        // Ensure the white loading screen is REMOVED after 6 seconds, even if something hangs deep in a manager.
        setTimeout(() => {
            if (document.documentElement.classList.contains('auth-loading')) {
                console.warn('[NewKet App] Initialization fail-safe triggered. Removing loading screen.');
                document.documentElement.classList.remove('auth-loading');
            }
        }, 6000);

        // 0. Initialize Configuration
        if (window.ConfigManager) await ConfigManager.init();

        // 1 & 2. Initialize Managers
        // AuthManager is critical for session state, we usually await it.
        if (window.AuthManager) await AuthManager.init();

        // Product and Order managers now handle their own internal "immediate resolve" from cache
        const initPromises = [];
        if (window.ProductManager) initPromises.push(ProductManager.init());
        
        const currentRole = window.AuthManager?.role;
        const currentUser = window.AuthManager?.user;
        const isLoggedIn = !!currentRole;
        const isAdmin = currentRole === 'admin';
        const isSupplier = currentRole === 'supplier';

        // Set Sentry user for context if logged in
        if (isLoggedIn && currentUser) {
            setSentryUser({ id: currentUser.id, email: currentUser.email, role: currentRole });
        }

        // Check Maintenance Mode
        if (window.newketConfig && window.newketConfig.maintenanceMode === true && !isAdmin) {
            const currentPath = window.location.pathname;
            if (!currentPath.includes('/admin/') && !currentPath.includes('login.html')) {
                // Remove loading screen immediately
                document.documentElement.classList.remove('auth-loading');
                // Replace entire body with maintenance view
                document.body.innerHTML = `
                    <div style="height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; background:#111827; color:#fff; font-family:'Inter', sans-serif; text-align:center; padding:20px;">
                        <iconify-icon icon="solar:shield-warning-bold-duotone" width="80" style="color:#ef4444; margin-bottom:20px;"></iconify-icon>
                        <h1 style="font-size:2rem; font-weight:900; margin-bottom:10px;">NewKet en Maintenance</h1>
                        <p style="color:#9ca3af; max-width:400px; line-height:1.6;">Notre plateforme fait actuellement l'objet d'une maintenance technique afin d'améliorer vos services. Nous serons de retour très rapidement !</p>
                        <a href="login.html" style="margin-top:30px; font-size:12px; font-weight:bold; color:#4b5563; text-decoration:none;">Accès Administrateur</a>
                    </div>
                `;
                return; // Halt further initialization
            }
        }

        // Orders are needed for customer + vendor dashboards too.
        if (window.OrderManager && isLoggedIn) initPromises.push(OrderManager.init());
        if (window.UserManager && isAdmin) initPromises.push(UserManager.init());
        
        // Managed Utilities
        if (window.PromoManager && isAdmin) initPromises.push(PromoManager.init().catch(e => console.warn('[App] PromoManager init failed (non-blocking):', e.message)));
        if (window.ActivityManager && isAdmin) initPromises.push(ActivityManager.init().catch(e => console.warn('[App] ActivityManager init failed (non-blocking):', e.message)));
        if (window.NotificationManager && isLoggedIn) initPromises.push(NotificationManager.init().catch(e => console.warn('[App] NotificationManager init failed (non-blocking):', e.message)));
        if (window.FavoritesManager && isLoggedIn) initPromises.push(FavoritesManager.syncFromSupabase().catch(e => console.warn('[App] FavoritesManager sync failed (non-blocking):', e.message)));

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

        window.addEventListener('resize', () => {
            if (window.innerWidth >= 640) {
                setMobileMenuState(false);
            }
        });

        // Scroll Direction Detection for Category Nav
        let lastScrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
        let accumulatedDelta = 0;
        let scrollTicking = false;
        const deltaThreshold = 18;
        const categoryNav = document.getElementById('categoryNav');
        const mobileSearch = document.getElementById('mobileSearchContainer');
        const mainHeader = document.querySelector('.main-header');
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
                categoryNav?.classList.remove('nav-hidden');
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
                categoryNav?.classList.remove('nav-hidden');
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

            if (clampedScrollTop <= 24) {
                categoryNav?.classList.remove('nav-hidden');
                mobileSearch?.classList.remove('search-bar-hidden');
                mainHeader.classList.remove('header-compact', 'header-retracted');
                accumulatedDelta = 0;
                lastScrollTop = clampedScrollTop;
                return;
            }

            const scrollingDown = accumulatedDelta > deltaThreshold;
            const scrollingUp = accumulatedDelta < -deltaThreshold;

            if (clampedScrollTop > scrollThreshold && scrollingDown) {
                categoryNav?.classList.add('nav-hidden');

                if (headerScrollState.searchOnSeparateRow && clampedScrollTop > compactThreshold) {
                    mobileSearch?.classList.add('search-bar-hidden');
                    mainHeader.classList.add('header-compact');
                    mainHeader.classList.remove('header-retracted');
                } else if (clampedScrollTop > retractThreshold) {
                    mainHeader.classList.remove('header-compact');
                    mobileSearch?.classList.remove('search-bar-hidden');
                    mainHeader.classList.add('header-retracted');
                }

                accumulatedDelta = 0;
            } else if (scrollingUp) {
                categoryNav?.classList.remove('nav-hidden');
                mobileSearch?.classList.remove('search-bar-hidden');
                mainHeader.classList.remove('header-compact', 'header-retracted');
                accumulatedDelta = 0;
            }

            if (clampedScrollTop <= scrollThreshold) {
                categoryNav?.classList.remove('nav-hidden');
            }

            if (clampedScrollTop <= compactThreshold) {
                mobileSearch?.classList.remove('search-bar-hidden');
                mainHeader.classList.remove('header-compact');
            }

            if (clampedScrollTop <= retractThreshold) {
                mainHeader.classList.remove('header-retracted');
            }

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
            image: imgEl?.src || 'Images/default.png',
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
