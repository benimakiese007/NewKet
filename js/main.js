/* NewKet EMarket - Main Orchestrator */

window.newketConfig = {
    exchangeRate: 2500,
    adminEmails: ['tmautuimane00@gmail.com', 'admin@newket.com']
};

window.ADMIN_EMAILS = window.newketConfig.adminEmails;

const App = {
    async init() {
        console.log('[NewKet] App initializing...');

        // 1. Initialize Supabase first as others depend on it
        if (window.AuthManager) await AuthManager.init();

        // 2. Initialize Data Managers
        if (window.ProductManager) await ProductManager.init();
        if (window.OrderManager) await OrderManager.init();

        // 3. Initialize UI State
        if (window.CurrencyManager) CurrencyManager.init();
        if (window.CartManager) CartManager.updateBadge();
        if (window.FavoritesManager) FavoritesManager.updateUI();

        // 4. Global Event Listeners
        this.bindGlobalEvents();

        console.log('[NewKet] App initialized successfully.');
        window.newketInitialized = true;
        window.dispatchEvent(new CustomEvent('newketInitialized'));
    },

    bindGlobalEvents() {
        // Sync Cart and Favorites across tabs
        window.addEventListener('storage', (e) => {
            if (e.key === 'newketCart' && window.CartManager) CartManager.updateBadge();
            if (e.key === 'newketFavorites' && window.FavoritesManager) FavoritesManager.updateUI();
        });

        // Add to Cart global handler
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.add-to-cart-btn');
            if (btn && window.CartManager) {
                e.preventDefault();
                this.handleAddToCart(btn);
            }
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
    },

    shakeFavoritesIcon() {
        const favLinks = document.querySelectorAll('a[href="favorites.html"], a[href*="favorites"]');
        favLinks.forEach(link => {
            link.classList.remove('fav-shake');
            // Force reflow to restart animation
            void link.offsetWidth;
            link.classList.add('fav-shake');
            link.addEventListener('animationend', () => link.classList.remove('fav-shake'), { once: true });
        });
    },

    handleAddToCart(btn) {
        const productId = btn.dataset.productId || this.resolveProductId(btn);
        const product = this.resolveProductData(productId, btn);
        CartManager.addItem(product);
        if (typeof showToast === 'function') showToast(`Ajouté au panier : ${product.name}`);
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

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
    // If ComponentLoader is present, it will re-trigger manager updates after loading header/footer
    App.init();
});
