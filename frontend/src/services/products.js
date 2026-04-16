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
     * Uses SupabaseAdapter directly (same as catalog.html) for production compatibility.
     */
    async fetchFreshData() {
        try {
            let products = [];

            if (window.SupabaseAdapter && window.supabaseClient) {
                try {
                    // Try with join first - explicit relationship check
                    products = await window.SupabaseAdapter.fetchWithFilters('products', {
                        select: '*, users!supplier_email(company_name, name, shipping_time, avatar)',
                        order: ['created_at', { ascending: false }],
                        limit: PRODUCTS_PAGE_SIZE,
                        skipCache: true
                    });
                } catch (joinErr) {
                    products = await window.SupabaseAdapter.fetchWithFilters('products', {
                        select: '*',
                        order: ['created_at', { ascending: false }],
                        limit: PRODUCTS_PAGE_SIZE,
                        skipCache: true
                    });
                }
                this._totalCount = products.length;
                this._hasMore = products.length === PRODUCTS_PAGE_SIZE;
            }
            else if (window.ApiClient) {
                const result = await window.ApiClient.get(`/products?page=1&limit=${PRODUCTS_PAGE_SIZE}`);
                if (result && result.data) {
                    products = result.data;
                    this._totalCount = result.count;
                    this._hasMore = products.length < result.count;
                }
            }

            // Map and update state
            const mappedProducts = (products || []).map(p => this._mapProduct(p));
            this._currentPage = 1;
            this.products = mappedProducts;

            // Cache subset for instant next load
            if (this.products.length > 0) {
                localStorage.setItem('newket_products_cache', JSON.stringify(this.products.slice(0, 20)));
            }

            // Always dispatch to clear loading state
            window.dispatchEvent(new CustomEvent('productsUpdated'));
            
        } catch (err) {
            window.dispatchEvent(new CustomEvent('productsUpdated'));
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
            const offset = this._currentPage * PRODUCTS_PAGE_SIZE;
            let newProducts = [];

            // ── Priorité 1 : SupabaseAdapter ──
            if (window.SupabaseAdapter && window.supabaseClient) {
                newProducts = await window.SupabaseAdapter.fetchWithFilters('products', {
                    select: '*, users!supplier_email(company_name, name, shipping_time, avatar)',
                    order: ['created_at', { ascending: false }],
                    range: [offset, offset + PRODUCTS_PAGE_SIZE - 1],
                    skipCache: true
                });
                this._hasMore = newProducts.length === PRODUCTS_PAGE_SIZE;
            }
            // ── Fallback : ApiClient ──
            else if (window.ApiClient) {
                const nextPage = this._currentPage + 1;
                const result = await window.ApiClient.get(`/products?page=${nextPage}&limit=${PRODUCTS_PAGE_SIZE}`);
                if (result && result.data) {
                    newProducts = result.data;
                    this._hasMore = this.products.length + newProducts.length < this._totalCount;
                }
            }

            if (newProducts && newProducts.length > 0) {
                const mappedNew = newProducts.map(p => this._mapProduct(p));
                this.products = [...this.products, ...mappedNew];
                this._currentPage++;
                window.dispatchEvent(new CustomEvent('productsUpdated'));
            } else {
                this._hasMore = false;
                window.dispatchEvent(new CustomEvent('productsUpdated'));
            }
        } catch (err) {
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
        // Handle joined 'users' which can sometimes be returned as an array [] by PostgREST
        let userInfo = p.users;
        if (Array.isArray(userInfo)) {
            userInfo = userInfo[0] || null;
        }

        return {
            ...p,
            users: userInfo, // Standardize as an object or null
            isNew: p.is_new,
            isPromo: p.is_promo,
            oldPrice: p.old_price,
            // Keep the original comma-separated string for multi-image support
            image: p.image,
        };
    },

    getProducts() {
        return this.products;
    },

    getProduct(id) {
        return this.products.find(p => p.id === id);
    },

    /**
     * Increment the view counter for a product in the backend.
     */
    async recordView(id) {
        if (!id) return;
        if (!window.ApiClient) return;
        
        try {
            // Send to Express Backend (which increments Supabase)
            // We use a fire-and-forget style to not slow down the UI
            window.ApiClient.post(`/analytics/view/${id}`).catch(() => {});
        } catch (err) {
        }
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
            // Priority 1: Supabase (direct join)
            if (window.SupabaseAdapter && window.supabaseClient) {
                const product = await window.SupabaseAdapter.fetchWithFilters('products', {
                    select: '*, users!supplier_email(company_name, name, shipping_time, avatar)',
                    eq: [['id', id]],
                    single: true
                });
                if (product) return this._mapProduct(product);
            }

            // Fallback: ApiClient
            const product = await window.ApiClient.get(`/products/${id}`);
            if (product) return this._mapProduct(product);

            return null;
        } catch (err) {
            return null;
        }
    },

    async addProduct(product) {
        const userId = localStorage.getItem('newketUserId');
        
        // Support both array and existing string formats for images
        let imageData = product.image;
        if (Array.isArray(imageData)) {
            imageData = imageData.join(',');
        }

        const productWithSupplier = {
            ...product,
            image: imageData,
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
        // Support both array and existing string formats for images
        if (updatedData.image && Array.isArray(updatedData.image)) {
            updatedData.image = updatedData.image.join(',');
        }

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
