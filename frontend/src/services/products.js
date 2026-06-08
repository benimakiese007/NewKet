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
    _productByIdCache: new Map(),
    _viewedThisSession: new Set(),

    // Pagination state
    _currentPage: 1,
    _totalCount: 0,
    _hasMore: true,
    _loading: false,
    _error: false,
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
            window.dispatchEvent(new CustomEvent('productsUpdated'));
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
        this._error = false;
        try {
            let products = [];

            if (window.SupabaseAdapter && window.supabaseClient) {
                try {
                    const [fetchedProducts, totalCount] = await Promise.all([
                        window.SupabaseAdapter.fetchWithFilters('products', {
                            select: '*, users!supplier_email(company_name, name, shipping_time, avatar)',
                            order: ['created_at', { ascending: false }],
                            limit: PRODUCTS_PAGE_SIZE,
                            skipCache: true
                        }),
                        window.SupabaseAdapter.countRows('products', {
                            timeout: 7000
                        })
                    ]);
                    products = fetchedProducts;
                    this._totalCount = totalCount || products.length;
                    this._hasMore = products.length < this._totalCount;
                } catch (joinErr) {
                    const [fetchedProducts, totalCount] = await Promise.all([
                        window.SupabaseAdapter.fetchWithFilters('products', {
                            select: '*',
                            order: ['created_at', { ascending: false }],
                            limit: PRODUCTS_PAGE_SIZE,
                            skipCache: true
                        }),
                        window.SupabaseAdapter.countRows('products', {
                            timeout: 7000
                        })
                    ]);
                    products = fetchedProducts;
                    this._totalCount = totalCount || products.length;
                    this._hasMore = products.length < this._totalCount;
                }
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
            this._error = true;
            window.dispatchEvent(new CustomEvent('productsError', { detail: err }));
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
        this._error = false;

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
            this._error = true;
            window.dispatchEvent(new CustomEvent('productsError', { detail: err }));
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

    getTotalCount() {
        return Math.max(this._totalCount || 0, this.products.length || 0);
    },

    getProduct(id) {
        return this.products.find(p => p.id === id);
    },

    /**
     * Fetches a single product by ID from the network if not in cache.
     * @param {string} id - The product ID
     * @returns {Promise<Object|null>} The product object or null
     */
    async fetchProductById(id) {
        if (!id) return null;
        
        // 1. Check local cache
        const cached = this.getProduct(id);
        if (cached) return cached;

        // 2. Fetch from network
        try {
            if (window.SupabaseAdapter && window.supabaseClient) {
                // We use fetchWithFilters which handles the client call
                const results = await window.SupabaseAdapter.fetchWithFilters('products', {
                    select: '*, users!supplier_email(company_name, name, shipping_time, avatar)',
                    eq: { id: id }
                });
                
                if (results && results.length > 0) {
                    const mapped = this._mapProduct(results[0]);
                    // Add to cache to avoid refetching
                    this.products.push(mapped);
                    return mapped;
                }
            } else if (window.ApiClient) {
                const result = await window.ApiClient.get(`/products/${id}`);
                if (result && result.data) {
                    const mapped = this._mapProduct(result.data);
                    this.products.push(mapped);
                    return mapped;
                }
            }
        } catch (e) {
            console.error('[ProductManager] Error fetching product:', id, e);
        }
        return null;
    },

    _isValidProductId(value) {
        return typeof value === 'string'
            && (
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ||
                /^prod-[a-z0-9-]+$/i.test(value)
            );
    },

    /**
     * Increment the view counter for a product in the backend.
     */
    async recordView(id) {
        if (!id) return;
        if (!window.ApiClient) return;
        if (!this._isValidProductId(id)) return;

        // Dedupe per tab session to avoid spamming analytics when UI re-renders
        if (this._viewedThisSession.has(id)) return;
        this._viewedThisSession.add(id);
        
        try {
            // Send to Express Backend (which increments Supabase)
            // We use a fire-and-forget style to not slow down the UI
            window.ApiClient.post(
                `/analytics/view/${id}`,
                {},
                {
                    suppressNetworkError: true,
                    suppressErrorLogging: true,
                    suppressToast: true,
                    dedupe: false
                }
            ).catch(() => {});
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
        const cached = this._productByIdCache.get(id);
        if (cached) return cached;

        // 2. Fetch from network
        try {
            // Priority 1: Supabase (direct join)
            if (window.SupabaseAdapter && window.supabaseClient) {
                const product = await window.SupabaseAdapter.fetchWithFilters('products', {
                    select: '*, users!supplier_email(company_name, name, shipping_time, avatar)',
                    eq: [['id', id]],
                    single: true
                });
                if (product) {
                    const mapped = this._mapProduct(product);
                    this._productByIdCache.set(id, mapped);
                    return mapped;
                }
            }

            // Fallback: ApiClient
            const product = await window.ApiClient.get(`/products/${id}`, {
                cacheKey: `product:${id}`,
                cacheTtlMs: 60_000
            });
            if (product) {
                const mapped = this._mapProduct(product);
                this._productByIdCache.set(id, mapped);
                return mapped;
            }

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
            if (window.logVendorActivity) logVendorActivity(`Produit ajouté : ${product.name}`, 'stock');
            else if (window.ActivityManager) ActivityManager.log(`Produit ajouté : ${product.name}`, 'stock');
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
                if (window.logVendorActivity) logVendorActivity(`Produit modifié : ${updated.name}`, 'stock');
                else if (window.ActivityManager) ActivityManager.log(`Produit modifié : ${updated.name}`, 'stock');
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
            if (product && window.logVendorActivity) logVendorActivity(`Produit supprimé : ${product.name}`, 'stock');
            else if (product && window.ActivityManager) ActivityManager.log(`Produit supprimé : ${product.name}`, 'stock');
        }
        return success;
    },

    async deleteBulk(ids) {
        await window.ApiClient.post('/products/bulk-delete', { ids });
        this.products = this.products.filter(p => !ids.includes(p.id));
        this._totalCount -= ids.length;
        window.dispatchEvent(new CustomEvent('productsUpdated'));
        if (window.logVendorActivity) logVendorActivity(`${ids.length} produits supprimés par action groupée`, 'stock');
        else if (window.ActivityManager) ActivityManager.log(`${ids.length} produits supprimés par action groupée`, 'stock');
    },

    async updateCategoryBulk(ids, newCategory) {
        await window.ApiClient.post('/products/bulk-category', { ids, category: newCategory });
        this.products.forEach(p => {
            if (ids.includes(p.id)) p.category = newCategory;
        });
        window.dispatchEvent(new CustomEvent('productsUpdated'));
        if (window.logVendorActivity) logVendorActivity(`Catégorie mise à jour pour ${ids.length} produits`, 'stock');
        else if (window.ActivityManager) ActivityManager.log(`Catégorie mise à jour pour ${ids.length} produits`, 'stock');
    }
};

window.ProductManager = ProductManager;
