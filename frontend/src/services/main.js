/* NewKet EMarket - Main Orchestrator */

window.newketConfig = {
    exchangeRate: 2500
};

// Admin email list is now centralized in auth.js for early initialization.
// window.ADMIN_EMAILS is available here via AuthManager/auth.js.
// ADMIN_PASSWORD intentionally removed — use Supabase Auth only.

const App = {
    async init() {
        // 0. Initialize Configuration
        if (window.ConfigManager) await ConfigManager.init();

        // 1 & 2. Initialize Managers
        // AuthManager is critical for session state, we usually await it.
        if (window.AuthManager) await AuthManager.init();

        // Product and Order managers now handle their own internal "immediate resolve" from cache
        const initPromises = [];
        if (window.ProductManager) initPromises.push(ProductManager.init());
        
        const currentRole = window.AuthManager?.role;
        const isLoggedIn = !!currentRole;
        const isAdmin = currentRole === 'admin';
        const isSupplier = currentRole === 'supplier';

        if (window.OrderManager && (isAdmin || isSupplier)) initPromises.push(OrderManager.init());
        if (window.UserManager && isAdmin) initPromises.push(UserManager.init());
        
        // Managed Utilities
        if (window.PromoManager && isAdmin) initPromises.push(PromoManager.init().catch(e => console.warn('[App] PromoManager init failed (non-blocking):', e.message)));
        if (window.ActivityManager && isAdmin) initPromises.push(ActivityManager.init().catch(e => console.warn('[App] ActivityManager init failed (non-blocking):', e.message)));
        if (window.NotificationManager && isLoggedIn) initPromises.push(NotificationManager.init().catch(e => console.warn('[App] NotificationManager init failed (non-blocking):', e.message)));
        if (window.FavoritesManager && isLoggedIn) initPromises.push(FavoritesManager.syncFromSupabase().catch(e => console.warn('[App] FavoritesManager sync failed (non-blocking):', e.message)));

        await Promise.all(initPromises);

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
                document.getElementById('mobileMenu')?.classList.add('active');
                document.getElementById('mobileOverlay')?.classList.add('active');
                document.body.style.overflow = 'hidden';
                return;
            }

            // Mobile Menu Close
            if (e.target.closest('#closeMobileMenu') || e.target.closest('#mobileOverlay')) {
                document.getElementById('mobileMenu')?.classList.remove('active');
                document.getElementById('mobileOverlay')?.classList.remove('active');
                document.body.style.overflow = '';
                return;
            }


        });
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
