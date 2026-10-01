/* newket EMarket Product Manager — V2.1 (Paginated + Image Optimization) */

const PRODUCTS_PAGE_SIZE = 30; // 30 ÷ 5 = 6 rows (desktop), 30 ÷ 3 = 10 rows (tablet), 30 ÷ 2 = 15 rows (mobile)
const PRODUCTS_ADMIN_MAX = 1000; // Max products to fetch in admin (no pagination limit)

// The home page and catalogue are browsing surfaces. Re-rendering their grids for
// every product mutation (stock, rating, review count, etc.) creates visible
// layout shifts on mobile and does not scale with a busy marketplace.
const isProductFeedPage = () => {
    const path = String(window.location.pathname || '/').toLowerCase().replace(/\/+$/, '') || '/';
    return path === '/'
        || /(?:^|\/)index(?:\.html)?$/.test(path)
        || /(?:^|\/)catalog(?:\.html)?$/.test(path);
};

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
    _archivedProducts: [],
    _productByIdCache: new Map(),
    _viewedThisSession: new Set(),

    // Pagination state
    _currentPage: 1,
    _totalCount: 0,
    _totalCountKnown: false,
    _hasMore: true,
    _loading: false,
    loading: false,
    _initialFetchDone: false,
    _error: false,
    _realtimeChannel: null,
    _isVisualSearch: false,

    // ========== QUICK CACHE (localStorage, par produit) ==========
    // TTL : 10 minutes — assez long pour une session normale, assez court pour
    // que les changements de prix/stock soient visibles rapidement.
    _QUICK_CACHE_TTL: 10 * 60 * 1000,

    /**
     * Sauvegarde un produit mappé dans localStorage pour un accès instantané.
     * @param {Object} p - Produit déjà mappé via _mapProduct
     */
    _cacheProduct(p) {
        if (!p || !p.id) return;
        try {
            localStorage.setItem(`nk_p_${p.id}`, JSON.stringify({ d: p, t: Date.now() }));
        } catch (e) { /* localStorage plein ou désactivé */ }
    },

    /**
     * Lit un produit depuis le cache localStorage.
     * Retourne null si inexistant ou expiré.
     * @param {string} id - ID du produit
     * @returns {Object|null}
     */
    _getProductFromQuickCache(id) {
        if (!id) return null;
        try {
            const raw = localStorage.getItem(`nk_p_${id}`);
            if (!raw) return null;
            const entry = JSON.parse(raw);
            if (!entry || !entry.d || !entry.t) return null;
            if (Date.now() - entry.t > this._QUICK_CACHE_TTL) {
                localStorage.removeItem(`nk_p_${id}`);
                return null;
            }
            // Invalider si pas de données vendeur pour forcer la jointure Supabase
            if (!entry.d.users) {
                localStorage.removeItem(`nk_p_${id}`);
                return null;
            }
            return entry.d;
        } catch (e) { return null; }
    },


    /**
     * Reads the localStorage cache and fires 'productsUpdated' immediately —
     * BEFORE auth resolves. Called at script-load time so the home page
     * shows cached images instantly on every navigation back to "/".
     * Idempotent: safe to call multiple times (no-op if products already loaded).
     */
    initFromCache() {
        // Skip if products are already loaded (e.g. called twice)
        if (this.products.length > 0) return;
        try {
            const raw = localStorage.getItem('newket_products_cache');
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed) && parsed.length > 0) {
                this.products = parsed;
                // Notify UI immediately — no auth needed to display cached products
                window.dispatchEvent(new CustomEvent('productsUpdated'));
            }
        } catch (e) { /* cache corrupt or unavailable — silent fail */ }
    },

    async init() {
        if (!window.SupabaseAdapter) {
            console.error('[NewKet] SupabaseAdapter not found. Cannot initialize ProductManager.');
            return;
        }

        this.loading = true;

        // --- FLASH CACHE (LOAD) ---
        // initFromCache() already ran at script-load time and pre-populated
        // this.products. Only re-read cache here if products are still empty
        // (e.g. first ever visit where initFromCache had no data yet).
        if (this.products.length === 0) {
            const localCache = localStorage.getItem('newket_products_cache');
            if (localCache) {
                try {
                    const parsed = JSON.parse(localCache);
                    if (parsed && Array.isArray(parsed) && parsed.length > 0) {
                        this.products = parsed;
                        window.dispatchEvent(new CustomEvent('productsUpdated'));
                    }
                } catch (e) {}
            }
        }

        // Reset pagination and load first page from network
        this._currentPage = 1;
        this._totalCountKnown = false;
        this._hasMore = true;
        this.fetchFreshData().finally(() => {
            this.loading = false;
            this._initialFetchDone = true;
            window.dispatchEvent(new CustomEvent('productsUpdated'));
        });

        // Keep the browse feed stable. It refreshes through the normal page
        // lifecycle/pull-to-refresh instead of reacting to every DB mutation.
        if (!isProductFeedPage()) {
            this._setupRealtime();
        } else {
            console.info('[ProductManager] Product Realtime disabled on browse feed.');
        }

        return Promise.resolve();
    },

    /**
     * Set up Supabase Realtime subscription for all product changes (INSERT, UPDATE, DELETE).
     */
    _setupRealtime() {
        if (this._realtimeChannel) return; // Already subscribed

        const client = window.SupabaseAdapter ? window.SupabaseAdapter.getClient() : null;
        if (!client) return;

        this._realtimeChannel = client
            .channel('public:products:manager')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'products' }, (payload) => {
                this._handleNewProductRealtime(payload.new);
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, (payload) => {
                this._handleUpdatedProductRealtime(payload.new);
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'products' }, (payload) => {
                this._handleDeletedProductRealtime(payload.old);
            })
            .subscribe((status) => {
                console.log('[ProductManager] Realtime status:', status);
            });
    },

    /**
     * Handles a new product arriving via Supabase Realtime.
     */
    _handleNewProductRealtime(rawProduct) {
        const product = this._mapProduct(rawProduct);
        if (this.products.some(p => p.id === product.id)) return;
        this.products.unshift(product);
        this._totalCount++;
        window.dispatchEvent(new CustomEvent('productsUpdated'));
    },

    /**
     * Handles a product update arriving via Supabase Realtime (price, stock, name…).
     */
    _handleUpdatedProductRealtime(rawProduct) {
        const updated = this._mapProduct(rawProduct);
        
        if (updated.is_archived) {
            // Remove from public products if it was there
            const wasInProducts = this.products.some(p => p.id === updated.id);
            if (wasInProducts) {
                this.products = this.products.filter(p => p.id !== updated.id);
                this._totalCount = Math.max(0, this._totalCount - 1);
            }
            
            // Add to archived products if it wasn't there
            const isAlreadyArchived = this._archivedProducts.some(p => p.id === updated.id);
            if (!isAlreadyArchived) {
                this._archivedProducts.push(updated);
                window.dispatchEvent(new CustomEvent('archivedProductsUpdated'));
            } else {
                // Update it in archived products
                const archIdx = this._archivedProducts.findIndex(p => p.id === updated.id);
                if (archIdx !== -1) this._archivedProducts[archIdx] = updated;
                window.dispatchEvent(new CustomEvent('archivedProductsUpdated'));
            }
            
            if (wasInProducts) window.dispatchEvent(new CustomEvent('productsUpdated'));
            return;
        }

        // It is NOT archived (either newly restored or just updated)
        // Remove from archived products if it was there
        const archIdx = this._archivedProducts.findIndex(p => p.id === updated.id);
        if (archIdx !== -1) {
            this._archivedProducts.splice(archIdx, 1);
            window.dispatchEvent(new CustomEvent('archivedProductsUpdated'));
        }

        // Update or add to public products
        const idx = this.products.findIndex(p => p.id === updated.id);
        if (idx !== -1) {
            this.products[idx] = updated;
        } else {
            // It was restored, we add it to the top
            this.products.unshift(updated);
            this._totalCount++;
        }
        window.dispatchEvent(new CustomEvent('productsUpdated'));
    },

    /**
     * Handles a product deletion arriving via Supabase Realtime.
     */
    _handleDeletedProductRealtime(oldProduct) {
        this.products = this.products.filter(p => p.id !== oldProduct.id);
        this._totalCount = Math.max(0, this._totalCount - 1);
        window.dispatchEvent(new CustomEvent('productsUpdated'));
    },

    /**
     * Fetches the first page of products, replacing any cached/stale state.
     * Uses SupabaseAdapter directly (same as catalog.html) for production compatibility.
     */
    async fetchFreshData() {
        this._error = false;
        try {
            let products = [];

            // 🧠 GOOGLE LENS : Intercepter le chargement initial si une recherche visuelle vient d'être faite
            const urlParams = new URLSearchParams(window.location.search);
            this._isVisualSearch = urlParams.get('lens') === 'true';
            if (this._isVisualSearch) {
                const cachedResults = sessionStorage.getItem('lensResults');
                if (cachedResults) {
                    try {
                        const parsedResults = JSON.parse(cachedResults);
                        const mappedResults = Array.isArray(parsedResults)
                            ? parsedResults.map(p => this._mapProduct(p))
                            : [];
                        
                        this.products = mappedResults;
                        this._currentPage = 1;
                        this._totalCount = mappedResults.length;
                        this._totalCountKnown = true;
                        this._hasMore = false; // Tout tient sur une page pour une recherche d'image
                        this.loading = false;
                        
                        // Les résultats Lens sont déjà disponibles en session : ne laissez
                        // jamais les skeletons attendre une requête Supabase inutile.
                        window.dispatchEvent(new CustomEvent('productsUpdated'));
                        setTimeout(() => window.dispatchEvent(new CustomEvent('productsUpdated')), 0);
                        return; // 🛑 On arrête ici, on n'appelle pas Supabase !
                    } catch (e) {
                        console.error('[GoogleLens] Erreur lecture des résultats:', e);
                    }
                }
            }

            if (window.SupabaseAdapter && window.supabaseClient) {
                try {
                    const fetchedProducts = await window.SupabaseAdapter.fetchWithFilters('products', {
                        select: '*, users!supplier_email(company_name, name, avatar, seller_type, shop_slug)',
                        eq: [['is_archived', false]],
                        order: ['created_at', { ascending: false }],
                        limit: PRODUCTS_PAGE_SIZE,
                        suppressToast: true
                    });
                    products = fetchedProducts || [];
                    this._totalCount = products.length;
                    this._totalCountKnown = false;
                    this._hasMore = products.length === PRODUCTS_PAGE_SIZE;

                    // Non-blocking count
                    window.SupabaseAdapter.countRows('products', { timeout: 7000 })
                        .then(count => {
                            if (typeof count === 'number') {
                                this._totalCount = count;
                                this._totalCountKnown = true;
                                this._hasMore = this.products.length < this._totalCount;
                                window.dispatchEvent(new CustomEvent('productsUpdated'));
                            }
                        })
                        .catch(() => {});
                } catch (joinErr) {
                    const fetchedProducts = await window.SupabaseAdapter.fetchWithFilters('products', {
                        select: '*',
                        eq: [['is_archived', false]],
                        order: ['created_at', { ascending: false }],
                        limit: PRODUCTS_PAGE_SIZE,
                        suppressToast: true
                    });
                    products = fetchedProducts || [];
                    this._totalCount = products.length;
                    this._totalCountKnown = false;
                    this._hasMore = products.length === PRODUCTS_PAGE_SIZE;

                    window.SupabaseAdapter.countRows('products', { timeout: 7000 })
                        .then(count => {
                            if (typeof count === 'number') {
                                this._totalCount = count;
                                this._totalCountKnown = true;
                                this._hasMore = this.products.length < this._totalCount;
                                window.dispatchEvent(new CustomEvent('productsUpdated'));
                            }
                        })
                        .catch(() => {});
                }
            }
            else if (window.ApiClient) {
                const result = await window.ApiClient.get(`/products?page=1&limit=${PRODUCTS_PAGE_SIZE}`);
                if (result && result.data) {
                    products = result.data;
                    this._totalCount = result.count || products.length;
                    this._totalCountKnown = typeof result.count === 'number';
                    this._hasMore = typeof result.count === 'number'
                        ? products.length < result.count
                        : products.length === PRODUCTS_PAGE_SIZE;
                }
            }

            // Map and update state
            const mappedProducts = (products || []).map(p => this._mapProduct(p));
            this._currentPage = 1;
            
            // Merge with existing products to avoid overwriting vendor products fetched concurrently
            const newIds = new Set(mappedProducts.map(p => p.id));
            const existingToKeep = this.products.filter(p => !newIds.has(p.id));
            this.products = [...mappedProducts, ...existingToKeep];

            // Ensure pinned products are always fetched, even if older than the first page
            try {
                if (window.SupabaseAdapter && window.supabaseClient) {
                    const pinned = await window.SupabaseAdapter.fetchWithFilters('products', {
                        select: '*, users!supplier_email(company_name, name, avatar, seller_type, shop_slug)',
                        order: ['created_at', { ascending: false }],
                        eq: [['pinned', true], ['is_archived', false]],
                        suppressToast: true
                    });
                    if (pinned && pinned.length > 0) {
                        const mappedPinned = pinned.map(p => this._mapProduct(p));
                        const existingIds = new Set(this.products.map(p => p.id));
                        const newPinned = mappedPinned.filter(p => !existingIds.has(p.id));
                        if (newPinned.length > 0) {
                            this.products = [...this.products, ...newPinned];
                        }
                    }
                }
            } catch (err) {
                console.warn('[ProductManager] Failed to merge pinned products:', err);
            }

            // Cache subset for instant next load
            // Ensure pinned products are prioritized in the cache so the sponsored section doesn't flash skeletons
            if (this.products.length > 0) {
                const pinnedForCache = this.products.filter(p => p.pinned);
                const regularForCache = this.products.filter(p => !p.pinned);
                const cacheSubset = [...pinnedForCache, ...regularForCache].slice(0, 30);
                localStorage.setItem('newket_products_cache', JSON.stringify(cacheSubset));
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
            let moreResultsExist = null;

            // ── Priorité 1 : SupabaseAdapter ──
            if (window.SupabaseAdapter && window.supabaseClient) {
                newProducts = await window.SupabaseAdapter.fetchWithFilters('products', {
                    select: '*, users!supplier_email(company_name, name, avatar, seller_type, shop_slug)',
                    eq: [['is_archived', false]],
                    order: ['created_at', { ascending: false }],
                    range: [offset, offset + PRODUCTS_PAGE_SIZE - 1]
                });
                if (this._totalCountKnown && this._totalCount > 0) {
                    this._hasMore = (this.products.length + newProducts.length) < this._totalCount;
                } else if (newProducts.length === PRODUCTS_PAGE_SIZE) {
                    const probe = await window.SupabaseAdapter.fetchWithFilters('products', {
                        select: 'id',
                        eq: [['is_archived', false]],
                        order: ['created_at', { ascending: false }],
                        range: [offset + PRODUCTS_PAGE_SIZE, offset + PRODUCTS_PAGE_SIZE]
                    });
                    moreResultsExist = Array.isArray(probe) && probe.length > 0;
                    this._hasMore = moreResultsExist;
                } else {
                    this._hasMore = false;
                }
            }
            // ── Fallback : ApiClient ──
            else if (window.ApiClient) {
                const nextPage = this._currentPage + 1;
                const result = await window.ApiClient.get(`/products?page=${nextPage}&limit=${PRODUCTS_PAGE_SIZE}`);
                if (result && result.data) {
                    newProducts = result.data;
                    if (typeof result.count === 'number') {
                        this._totalCount = result.count;
                        this._totalCountKnown = true;
                        this._hasMore = (this.products.length + newProducts.length) < this._totalCount;
                    } else {
                        this._hasMore = newProducts.length === PRODUCTS_PAGE_SIZE;
                    }
                }
            }

            if (newProducts && newProducts.length > 0) {
                const mappedNew = newProducts.map(p => this._mapProduct(p));
                this.products = [...this.products, ...mappedNew];
                this._currentPage++;

                if (this._totalCountKnown) {
                    this._hasMore = this.products.length < this._totalCount;
                } else if (moreResultsExist !== null) {
                    this._hasMore = moreResultsExist;
                } else if (newProducts.length < PRODUCTS_PAGE_SIZE) {
                    this._hasMore = false;
                }

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

    isVisualSearch() {
        return this._isVisualSearch === true;
    },

    /**
     * Fetches ALL products from the database without any pagination limit.
     * Intended for admin pages only (Gestion du Catalogue).
     * Replaces this.products with the full list and dispatches productsUpdated.
     */
    async fetchAll() {
        this._error = false;
        try {
            let products = [];

            if (window.SupabaseAdapter && window.supabaseClient) {
                try {
                    const [fetchedProducts, totalCount] = await Promise.all([
                        window.SupabaseAdapter.fetchWithFilters('products', {
                            select: '*, users!supplier_email(company_name, name, avatar, seller_type, shop_slug)',
                            order: ['created_at', { ascending: false }],
                            limit: PRODUCTS_ADMIN_MAX,
                            skipCache: true
                        }),
                        window.SupabaseAdapter.countRows('products', { timeout: 10000 })
                    ]);
                    products = fetchedProducts;
                    this._totalCount = totalCount || products.length;
                } catch (joinErr) {
                    const [fetchedProducts, totalCount] = await Promise.all([
                        window.SupabaseAdapter.fetchWithFilters('products', {
                            select: '*',
                            order: ['created_at', { ascending: false }],
                            limit: PRODUCTS_ADMIN_MAX,
                            skipCache: true
                        }),
                        window.SupabaseAdapter.countRows('products', { timeout: 10000 })
                    ]);
                    products = fetchedProducts;
                    this._totalCount = totalCount || products.length;
                }
            } else if (window.ApiClient) {
                const result = await window.ApiClient.get(`/products?page=1&limit=${PRODUCTS_ADMIN_MAX}`);
                if (result && result.data) {
                    products = result.data;
                    this._totalCount = result.count || products.length;
                }
            }

            const mappedProducts = (products || []).map(p => this._mapProduct(p));
            this._currentPage = 1;
            this._hasMore = false; // Admin loaded everything
            this.products = mappedProducts;

            window.dispatchEvent(new CustomEvent('productsUpdated'));
        } catch (err) {
            this._error = true;
            window.dispatchEvent(new CustomEvent('productsError', { detail: err }));
            window.dispatchEvent(new CustomEvent('productsUpdated'));
        }
    },

    /**
     * Fetches all pinned/sponsored products, regardless of age.
     * Merges them into the global products list so they are accessible to the UI.
     */
    async fetchPinnedProducts() {
        if (!window.SupabaseAdapter || !window.supabaseClient) return [];
        try {
            let products = [];
            
            if (window.SupabaseAdapter && window.supabaseClient) {
                products = await window.SupabaseAdapter.fetchWithFilters('products', {
                    select: '*, users!supplier_email(company_name, name, avatar, seller_type, shop_slug)',
                    order: ['created_at', { ascending: false }],
                    eq: [['pinned', true]],
                    skipCache: true
                });
            }

            if (!products || products.length === 0) return [];

            const mapped = products.map(p => this._mapProduct(p));

            const existingIds = new Set(this.products.map(p => p.id));
            const newProds = mapped.filter(p => !existingIds.has(p.id));
            if (newProds.length > 0) {
                this.products = [...this.products, ...newProds];
                window.dispatchEvent(new CustomEvent('productsUpdated'));
            }

            return mapped;
        } catch (err) {
            console.warn('[ProductManager] Failed to fetch pinned products:', err);
            return [];
        }
    },

    /**
     * Fetches all products belonging to a specific vendor.
     * Merges them into the global products list so they are accessible to the UI.
     */
    async fetchVendorProducts(userId, email) {
        if (!window.SupabaseAdapter || !window.supabaseClient) return [];
        if (!userId && !email) return [];
        try {
            let products = [];
            
            if (window.SupabaseAdapter && window.supabaseClient) {
                let byEmail = [];
                if (email) {
                    byEmail = await window.SupabaseAdapter.fetchWithFilters('products', {
                        select: '*, users!supplier_email(company_name, name, avatar, seller_type, shop_slug)',
                        order: ['created_at', { ascending: false }],
                        eq: [['supplier_email', email], ['is_archived', false]],
                        skipCache: true,
                        suppressErrorLogging: true
                    });
                }

                let byUser = [];
                if (userId && userId !== 'null' && userId !== 'undefined') {
                    byUser = await window.SupabaseAdapter.fetchWithFilters('products', {
                        select: '*, users!supplier_email(company_name, name, avatar, seller_type, shop_slug)',
                        order: ['created_at', { ascending: false }],
                        eq: [['user_id', userId], ['is_archived', false]],
                        skipCache: true,
                        suppressErrorLogging: true
                    });
                }

                const allProducts = [...(byEmail || []), ...(byUser || [])];
                const seen = new Set();
                products = allProducts.filter(p => {
                    if (seen.has(p.id)) return false;
                    seen.add(p.id);
                    return true;
                });
            }

            if (!products || products.length === 0) {
                // Toujours signaler que le fetch est terminé, même avec 0 résultats,
                // pour que le skeleton loading s'arrête et affiche l'état vide.
                window.dispatchEvent(new CustomEvent('productsUpdated'));
                return [];
            }

            const mapped = products.map(p => this._mapProduct(p));

            // Remove old version of this vendor's products from the local array
            this.products = this.products.filter(p => {
                if (email && p.supplier_email === email) return false;
                if (userId && p.user_id === userId) return false;
                return true;
            });

            if (mapped.length > 0) {
                this.products = [...this.products, ...mapped];
            }
            window.dispatchEvent(new CustomEvent('productsUpdated'));

            return mapped;
        } catch (err) {
            console.warn('[ProductManager] Failed to fetch vendor products:', err);
            return [];
        }
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
        
        let isPromo = p.is_promo;
        let oldPrice = p.old_price;
        let price = p.price;
        
        // Apply expiration logic
        if (isPromo && p.promo_expires_at && new Date(p.promo_expires_at) < new Date()) {
            price = oldPrice || price;
            isPromo = false;
            oldPrice = null;
        }

        const mapped = {
            ...p,
            users: userInfo, // Standardize as an object or null
            price: price,
            isNew: p.is_new,
            isPromo: isPromo,
            oldPrice: oldPrice,
            // Keep the original comma-separated string for multi-image support
            image: p.image,
        };

        // Mise en cache silencieuse — tout produit affiché (home/catalogue)
        // sera disponible instantanément sur la page détail.
        this._cacheProduct(mapped);

        return mapped;
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

    _isValidProductId(value) {
        return typeof value === 'string'
            && (
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ||
                /^prod-[a-z0-9-]+$/i.test(value)
            );
    },

    /**
     * Increment the view counter for a product in the backend (fire-and-forget).
     */
    async recordView(id) {
        if (!id) return;
        if (!window.ApiClient) return;
        if (!this._isValidProductId(id)) return;
        if (this._viewedThisSession.has(id)) return;
        this._viewedThisSession.add(id);
        try {
            window.ApiClient.post(`/analytics/view/${id}`, {}, {
                suppressNetworkError: true,
                suppressErrorLogging: true,
                suppressToast: true,
                dedupe: false
            }).catch(() => {});
        } catch (err) {}
    },

    /**
     * Fetches a single product by ID.
     * Priority:
     *   0. localStorage quick-cache (< 10 min) → instantané, zéro réseau
     *   1. Mémoire vive (this.products)         → instantané
     *   2. _productByIdCache (Map interne)      → instantané
     *   3. Supabase direct avec jointure        → ~500ms–1s
     *   4. ApiClient fallback                   → ~500ms–1s
     */
    async fetchProductById(id) {
        if (!id) return null;

        // 0. Quick-cache localStorage (chargement instantané)
        const quickCached = this._getProductFromQuickCache(id);
        if (quickCached) return quickCached;

        // 1. Mémoire vive
        const local = this.getProduct(id);
        if (local) return local;

        // 2. Map interne
        const memCached = this._productByIdCache.get(id);
        if (memCached) return memCached;

        // 3. Réseau — Supabase avec jointure vendeur
        try {
            if (window.SupabaseAdapter && window.supabaseClient) {
                const product = await window.SupabaseAdapter.fetchWithFilters('products', {
                    select: '*, users!supplier_email(company_name, name, avatar, seller_type, shop_slug), product_variants(*)',
                    eq: [['id', id]],
                    single: true
                });
                if (product) {
                    const mapped = this._mapProduct(product); // _cacheProduct appelé dans _mapProduct
                    this._productByIdCache.set(id, mapped);
                    return mapped;
                }
            }

            // 4. Fallback ApiClient
            if (window.ApiClient) {
                const product = await window.ApiClient.get(`/products/${id}`, {
                    cacheKey: `product:${id}`,
                    cacheTtlMs: 60_000
                });
                if (product) {
                    const mapped = this._mapProduct(product);
                    this._productByIdCache.set(id, mapped);
                    return mapped;
                }
            }
        } catch (err) {
            console.error('[ProductManager] Error fetching product:', id, err);
        }

        return null;
    },

    async addProduct(product) {
        const userId = localStorage.getItem('newketUserId');
        
        let imageData = product.image;
        if (Array.isArray(imageData)) {
            imageData = imageData.join(',');
        }

        const productWithSupplier = {
            ...product,
            image: imageData,
            user_id: userId
        };

        let newProd = null;
        if (window.SupabaseAdapter && window.supabaseClient) {
            try {
                const inserted = await window.SupabaseAdapter.insert('products', productWithSupplier);
                if (inserted) {
                    newProd = await window.SupabaseAdapter.fetchWithFilters('products', {
                        select: '*, users!supplier_email(company_name, name, avatar, seller_type, shop_slug)',
                        eq: [['id', inserted.id]],
                        single: true
                    }) || inserted;
                }
            } catch (err) {
                console.error('[ProductManager] Error inserting product via Supabase:', err);
            }
        } else {
            newProd = await window.ApiClient.post('/products', productWithSupplier);
        }

        if (newProd) {
            const mappedProd = this._mapProduct(newProd);
            this.products.unshift(mappedProd);
            this._totalCount++;
            window.dispatchEvent(new CustomEvent('productsUpdated'));
            if (window.logVendorActivity) logVendorActivity(`Produit ajouté : ${product.name}`, 'stock');
            else if (window.ActivityManager) ActivityManager.log(`Produit ajouté : ${product.name}`, 'stock');
        }
        return newProd;
    },

    async updateProduct(id, updatedData) {
        if (updatedData.image && Array.isArray(updatedData.image)) {
            updatedData.image = updatedData.image.join(',');
        }

        let updated = null;
        if (window.SupabaseAdapter && window.supabaseClient) {
            try {
                const { ok, error } = await window.SupabaseAdapter.update('products', id, updatedData, { returnMeta: true });
                if (ok) {
                    updated = await window.SupabaseAdapter.fetchWithFilters('products', {
                        select: '*, users!supplier_email(company_name, name, avatar, seller_type, shop_slug)',
                        eq: [['id', id]],
                        single: true
                    });
                } else {
                    console.error('[ProductManager] Supabase update failed:', error);
                }
            } catch (err) {
                console.error('[ProductManager] Error updating product via Supabase:', err);
            }
        } else {
            updated = await window.ApiClient.put(`/products/${id}`, updatedData);
        }

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
        let success = false;
        if (window.SupabaseAdapter && window.supabaseClient) {
            try {
                const { ok, error } = await window.SupabaseAdapter.delete('products', id, { returnMeta: true });
                success = ok;
                if (!ok) console.error('[ProductManager] Supabase delete failed:', error);
            } catch (err) {
                console.error('[ProductManager] Error deleting product via Supabase:', err);
            }
        } else {
            const result = await window.ApiClient.delete(`/products/${id}`);
            success = result && result.success;
        }

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
        if (window.SupabaseAdapter && window.supabaseClient) {
            try {
                for (const id of ids) {
                    await window.SupabaseAdapter.delete('products', id);
                }
            } catch (err) {
                console.error('[ProductManager] Error in deleteBulk via Supabase:', err);
            }
        } else {
            await window.ApiClient.post('/products/bulk-delete', { ids });
        }
        
        this.products = this.products.filter(p => !ids.includes(p.id));
        this._totalCount -= ids.length;
        window.dispatchEvent(new CustomEvent('productsUpdated'));
        if (window.logVendorActivity) logVendorActivity(`${ids.length} produits supprimés par action groupée`, 'stock');
        else if (window.ActivityManager) ActivityManager.log(`${ids.length} produits supprimés par action groupée`, 'stock');
    },

    async archiveProduct(id) {
        let success = false;
        if (window.SupabaseAdapter && window.supabaseClient) {
            try {
                const { ok } = await window.SupabaseAdapter.update('products', id, { is_archived: true }, { returnMeta: true });
                success = ok;
            } catch (err) {
                console.error('[ProductManager] Error in archiveProduct via Supabase:', err);
            }
        } else {
            const result = await window.ApiClient.patch(`/products/${id}/archive`, {});
            success = result && result.success;
        }
        
        if (success) {
            const product = this.products.find(p => p.id === id);
            if (product) {
                product.is_archived = true;
                this._archivedProducts.push(product);
                this.products = this.products.filter(p => p.id !== id);
                this._totalCount--;
                window.dispatchEvent(new CustomEvent('productsUpdated'));
                window.dispatchEvent(new CustomEvent('archivedProductsUpdated'));
                if (window.ActivityManager) ActivityManager.log(`Produit archivé : ${product.name}`, 'stock');
            }
        }
        return success;
    },

    async restoreProduct(id) {
        let success = false;
        if (window.SupabaseAdapter && window.supabaseClient) {
            try {
                const { ok } = await window.SupabaseAdapter.update('products', id, { is_archived: false }, { returnMeta: true });
                success = ok;
            } catch (err) {
                console.error('[ProductManager] Error in restoreProduct via Supabase:', err);
            }
        } else {
            const result = await window.ApiClient.patch(`/products/${id}/restore`, {});
            success = result && result.success;
        }

        if (success) {
            const product = this._archivedProducts.find(p => p.id === id);
            if (product) {
                product.is_archived = false;
                this.products.unshift(product);
                this._archivedProducts = this._archivedProducts.filter(p => p.id !== id);
                this._totalCount++;
                window.dispatchEvent(new CustomEvent('productsUpdated'));
                window.dispatchEvent(new CustomEvent('archivedProductsUpdated'));
                if (window.ActivityManager) ActivityManager.log(`Produit restauré : ${product.name}`, 'stock');
            }
        }
        return success;
    },

    async fetchVendorArchived() {
        try {
            if (!window.ApiClient) return [];
            const result = await window.ApiClient.get('/products/vendor/archived');
            if (result && result.data) {
                this._archivedProducts = (result.data || []).map(p => this._mapProduct(p));
                window.dispatchEvent(new CustomEvent('archivedProductsUpdated'));
                return this._archivedProducts;
            }
        } catch (err) {
            console.warn('[ProductManager] Failed to fetch archived products:', err);
        }
        return [];
    },

    getArchivedProducts() {
        return this._archivedProducts;
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

// Auto-prime cache on home/catalog pages: call initFromCache() right after
// the module is evaluated so products are ready when ui.js's DOMContentLoaded
// listener fires. This guarantees zero skeleton flash on return navigation.
if (isProductFeedPage()) {
    ProductManager.initFromCache();
}
