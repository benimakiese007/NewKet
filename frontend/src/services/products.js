/* newket EMarket Product Manager — V2.1 (Paginated + Image Optimization) */

const PRODUCTS_PAGE_SIZE = 20; // Load 20 at a time instead of 200

// ========== IMAGE URL HELPER ==========
/**
 * Appends Supabase image transformation params to a product image URL.
 * This dramatically reduces image file size sent over the network.
 * Only applies to Supabase storage URLs to avoid breaking external URLs.
 * @param {string} url - The original image URL
 * @param {object} opts - Transformation options
 * @returns {string} The optimized URL
 */
// Removed duplicate getOptimizedImageUrl - now using standard one from ui-helpers.js



const ProductManager = {
    products: [],

    // Pagination state
    _currentPage: 1,
    _totalCount: 0,
    _hasMore: true,
    _loading: false,
    _realtimeChannel: null,

    async init() {
        if (!window.SupabaseAdapter) {
            console.error('[NewKet] SupabaseAdapter not found. Cannot initialize ProductManager.');
            return;
        }

        this.loading = true;

        // --- FLASH CACHE (LOAD) ---
        // Reads from localStorage to display UI instantly before network finishes
        const localCache = localStorage.getItem('newket_products_cache');
        if (localCache) {
            try {
                const parsed = JSON.parse(localCache);
                if (parsed && Array.isArray(parsed) && parsed.length > 0) {
                    this.products = parsed;
                    window.dispatchEvent(new CustomEvent('productsUpdated'));
                }
            } catch (e) {
                console.warn('[NewKet] Error parsing local products cache', e);
            }
        }

        // Reset pagination and load first page from network
        this._currentPage = 1;
        this._hasMore = true;
        this.fetchFreshData().finally(() => {
            this.loading = false;
        });

        // --- REALTIME SUBSCRIPTION ---
        this._setupRealtime();

        return Promise.resolve();
    },

    /**
     * Set up Supabase Realtime subscription for new products.
     */
    _setupRealtime() {
        if (this._realtimeChannel) return; // Already subscribed

        this._realtimeChannel = window.SupabaseAdapter.subscribeToTable('products', 'INSERT', (payload) => {
            this._handleNewProductRealtime(payload.new);
        });
    },

    /**
     * Handles a new product arriving via Supabase Realtime.
     */
    _handleNewProductRealtime(rawProduct) {
        // 1. Map to UI format
        const product = this._mapProduct(rawProduct);

        // 2. Check if already exists (avoid duplicates from current user's unshift)
        if (this.products.some(p => p.id === product.id)) return;

        // 3. Add to list
        this.products.unshift(product);
        this._totalCount++;

        // 4. Update UI
        window.dispatchEvent(new CustomEvent('productsUpdated'));

        // 5. Notify user
        if (window.AppNotifications) {
            AppNotifications.showToast(
                'Nouveau produit ! 🆕',
                `"${product.name}" vient d'être publié par un vendeur.`,
                'info',
                'solar:shop-2-bold'
            );
        }
    },

    /**
     * Fetches the first page of products, replacing any cached/stale state.
     * Called on init and on manual refresh.
     */
    async fetchFreshData() {
        try {
            const result = await window.ApiClient.get(`/products?page=1&limit=${PRODUCTS_PAGE_SIZE}`);

            if (result && result.data) {
                const mappedProducts = result.data.map(p => this._mapProduct(p));

                this._totalCount = result.count;
                this._currentPage = 1;
                this._hasMore = mappedProducts.length < result.count;

                const dataChanged = this.products.length !== mappedProducts.length ||
                    (mappedProducts.length > 0 && this.products[0]?.id !== mappedProducts[0].id);

                this.products = mappedProducts;

                // Save a small cache for instant display on next load
                localStorage.setItem('newket_products_cache', JSON.stringify(this.products.slice(0, 20)));

                if (dataChanged) {
                    window.dispatchEvent(new CustomEvent('productsUpdated'));
                }
            }
        } catch (err) {
            console.error('[NewKet] Error fetching products:', err);
        }
    },

    /**
     * Loads the next page and appends to existing products.
     * Used by "Voir plus" button.
     */
    async loadMore() {
        if (this._loading || !this._hasMore) return;
        this._loading = true;

        try {
            const nextPage = this._currentPage + 1;
            const result = await window.ApiClient.get(`/products?page=${nextPage}&limit=${PRODUCTS_PAGE_SIZE}`);

            if (result && result.data && result.data.length > 0) {
                const mappedNew = result.data.map(p => this._mapProduct(p));
                this.products = [...this.products, ...mappedNew];
                this._currentPage = nextPage;
                this._hasMore = this.products.length < this._totalCount;

                window.dispatchEvent(new CustomEvent('productsUpdated'));
            } else {
                this._hasMore = false;
                window.dispatchEvent(new CustomEvent('productsUpdated'));
            }
        } catch (err) {
            console.error('[NewKet] Error loading more products:', err);
        } finally {
            this._loading = false;
        }
    },

    /**
     * Returns true if there are more pages to load.
     */
    hasMore() {
        return this._hasMore;
    },

    /**
     * Maps a raw Supabase product row to the camelCase format expected by the UI.
     * Also applies image URL optimization.
     */
    _mapProduct(p) {
        return {
            ...p,
            isNew: p.is_new,
            isPromo: p.is_promo,
            oldPrice: p.old_price,
            // Optimize the primary image URL for faster loading
            image: window.getOptimizedImageUrl ? window.getOptimizedImageUrl(p.image) : p.image,
        };
    },

    getProducts() {
        return this.products;
    },

    getProduct(id) {
        return this.products.find(p => p.id === id);
    },

    /**
     * Attempts to find a product locally, then fetches from Supabase if missing.
     * Essential for direct links to products not in the first 20 results.
     */
    async fetchProductById(id) {
        // 1. Check local memory
        const local = this.getProduct(id);
        if (local) return local;

        // 2. Fetch from network
        try {
            const product = await window.ApiClient.get(`/products/${id}`);

            if (product) {
                const mapped = this._mapProduct(product);
                // Optional: add to local list so future lookups are instant
                // but we might not want to pollute the paginated list if it's strictly ordered
                return mapped;
            }
            return null;
        } catch (err) {
            console.error(`[NewKet] Error fetching product ${id}:`, err);
            return null;
        }
    },

    async addProduct(product) {
        const userId = localStorage.getItem('newketUserId');
        const productWithSupplier = {
            ...product,
            user_id: userId
        };

        const newProd = await window.ApiClient.post('/products', productWithSupplier);
        if (newProd) {
            const mappedProd = this._mapProduct(newProd);
            this.products.unshift(mappedProd); // Add to front (newest first)
            this._totalCount++;
            window.dispatchEvent(new CustomEvent('productsUpdated'));
            if (window.ActivityManager) ActivityManager.log(`Produit ajouté : ${product.name}`, 'stock');
        }
        return newProd;
    },

    async updateProduct(id, updatedData) {
        const updated = await window.ApiClient.put(`/products/${id}`, updatedData);
        if (updated) {
            const index = this.products.findIndex(p => p.id === id);
            if (index !== -1) {
                this.products[index] = this._mapProduct(updated);
                window.dispatchEvent(new CustomEvent('productsUpdated'));
                if (window.ActivityManager) ActivityManager.log(`Produit modifié : ${updated.name}`, 'stock');
            }
        }
        return updated;
    },

    async deleteProduct(id) {
        const result = await window.ApiClient.delete(`/products/${id}`);
        const success = result && result.success;
        if (success) {
            const product = this.products.find(p => p.id === id);
            this.products = this.products.filter(p => p.id !== id);
            this._totalCount--;
            window.dispatchEvent(new CustomEvent('productsUpdated'));
            if (product && window.ActivityManager) ActivityManager.log(`Produit supprimé : ${product.name}`, 'stock');
        }
        return success;
    },

    async deleteBulk(ids) {
        await window.ApiClient.post('/products/bulk-delete', { ids });
        this.products = this.products.filter(p => !ids.includes(p.id));
        this._totalCount -= ids.length;
        window.dispatchEvent(new CustomEvent('productsUpdated'));
        if (window.ActivityManager) ActivityManager.log(`${ids.length} produits supprimés par action groupée`, 'stock');
    },

    async updateCategoryBulk(ids, newCategory) {
        await window.ApiClient.post('/products/bulk-category', { ids, category: newCategory });
        this.products.forEach(p => {
            if (ids.includes(p.id)) p.category = newCategory;
        });
        window.dispatchEvent(new CustomEvent('productsUpdated'));
        if (window.ActivityManager) ActivityManager.log(`Catégorie mise à jour pour ${ids.length} produits`, 'stock');
    }
};

window.ProductManager = ProductManager;
