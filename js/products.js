/* newket EMarket Product Manager */

const ProductManager = {
    products: [],

    async init() {
        if (!window.SupabaseAdapter) {
            console.error('[NewKet] SupabaseAdapter not found. Cannot initialize ProductManager.');
            return;
        }

        // --- FLASH CACHE (LOAD) ---
        // Reads from localStorage to display UI instantly before network finishes
        const localCache = localStorage.getItem('newket_products_cache');
        if (localCache) {
            try {
                const parsed = JSON.parse(localCache);
                if (parsed && parsed.length > 0) {
                    this.products = parsed;
                    window.dispatchEvent(new CustomEvent('productsUpdated'));
                }
            } catch (e) {
                console.warn('[NewKet] Error parsing local products cache', e);
            }
        }

        // Fetch fresh data in the background
        const data = await window.SupabaseAdapter.fetchWithFilters('products', {
            order: ['created_at', { ascending: false }],
            limit: 200
        });

        if (data && data.length > 0) {
            // Map snake_case from SQL to camelCase for JS UI compatibility
            this.products = data.map(p => ({
                ...p,
                isNew: p.is_new,
                isPromo: p.is_promo,
                oldPrice: p.old_price,
            }));

            // --- FLASH CACHE (SAVE) ---
            // Save top 50 products for next fast load
            try {
                localStorage.setItem('newket_products_cache', JSON.stringify(this.products.slice(0, 50)));
            } catch (e) {
                console.warn('[NewKet] Error saving local products cache', e);
            }
        } else {
            this.products = [];
        }
        window.dispatchEvent(new CustomEvent('productsUpdated'));
        console.log('[NewKet] ProductManager initialized. Products:', this.products.length);
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
            // Map back to camelCase for local state
            const mappedProd = {
                ...newProd,
                isNew: newProd.is_new,
                isPromo: newProd.is_promo,
                oldPrice: newProd.old_price
            };
            this.products.push(mappedProd);
            window.dispatchEvent(new CustomEvent('productsUpdated'));
            if (window.ActivityManager) ActivityManager.log(`Produit ajouté : ${product.name}`, 'stock');
        }
        return newProd;
    },

    async updateProduct(id, updatedData) {
        const updated = await window.SupabaseAdapter.update('products', id, updatedData);
        if (updated) {
            const index = this.products.findIndex(p => p.id === id);
            if (index !== -1) {
                // Map back to camelCase
                const mappedUpdated = {
                    ...updated,
                    isNew: updated.is_new,
                    isPromo: updated.is_promo,
                    oldPrice: updated.old_price
                };
                this.products[index] = mappedUpdated;
                window.dispatchEvent(new CustomEvent('productsUpdated'));
                if (window.ActivityManager) ActivityManager.log(`Produit modifié : ${updated.name}`, 'stock');
            }
        }
        return updated;
    },

    async deleteProduct(id) {
        const success = await window.SupabaseAdapter.delete('products', id);
        if (success) {
            const product = this.products.find(p => p.id === id);
            this.products = this.products.filter(p => p.id !== id);
            window.dispatchEvent(new CustomEvent('productsUpdated'));
            if (product && window.ActivityManager) ActivityManager.log(`Produit supprimé : ${product.name}`, 'stock');
        }
        return success;
    },

    async deleteBulk(ids) {
        for (const id of ids) {
            await window.SupabaseAdapter.delete('products', id);
        }
        this.products = this.products.filter(p => !ids.includes(p.id));
        window.dispatchEvent(new CustomEvent('productsUpdated'));
        if (window.ActivityManager) ActivityManager.log(`${ids.length} produits supprimés par action groupée`, 'stock');
    },

    async updateCategoryBulk(ids, newCategory) {
        for (const id of ids) {
            await window.SupabaseAdapter.update('products', id, { category: newCategory });
        }
        this.products.forEach(p => {
            if (ids.includes(p.id)) p.category = newCategory;
        });
        window.dispatchEvent(new CustomEvent('productsUpdated'));
        if (window.ActivityManager) ActivityManager.log(`Catégorie mise à jour pour ${ids.length} produits`, 'stock');
    }
};

window.ProductManager = ProductManager;
