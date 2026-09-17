/**
 * NewKet UI Handler — V2
 * Manages specialized rendering for Home page and common UI states.
 */

const UI = {
    init() {
        this.renderHomeGrid();

        // Avoid replacing the grid while the user explicitly requests another block.
        window.addEventListener('productsUpdated', () => {
            if (!window._isFetchingHome) {
                this.renderHomeGrid();
            }
        });

        window.addEventListener('productsError', () => {
            if (!window._isFetchingHome) {
                this.renderHomeGrid();
            }
        });

        if (!this._homeResizeBound) {
            let resizeTimer;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    this.renderAll(ProductManager.getProducts());
                }, 150);
            });
            this._homeResizeBound = true;
        }
        // Listen for currency changes
        window.addEventListener('currencyChanged', () => {
            this.renderHomeGrid();
        });
    },

    /**
     * Renders all sections on the home page.
     */
    renderHomeGrid() {
        if (!window.ProductManager) return;
        
        const allProducts = ProductManager.getProducts();
        console.log(`[NewKet UI] Rendering home grid. Product count: ${allProducts.length}`);

        // 1. Pinned Products Section
        this.renderPinned(allProducts);

        // 2. Recent Products Section
        this.renderRecent(allProducts);

        // 3. Main/All Products Section
        this.renderAll(allProducts);
    },

    renderPinned(products) {
        const grid = document.getElementById('pinnedProductGrid');
        const section = document.getElementById('pinnedSection');
        if (!grid) return;

        // If no products yet, show skeletons
        if (!products || products.length === 0) {

            if (window.ProductManager && window.ProductManager._error) {
                const retryHtml = \<div class="col-span-full py-12 text-center bg-gray-50 rounded-2xl border border-gray-100">
                    <iconify-icon icon="solar:wifi-router-minimalistic-broken" width="48" class="text-red-400 mb-3"></iconify-icon>
                    <p class="text-gray-800 font-semibold mb-1">Impossible de charger les produits</p>
                    <p class="text-gray-500 text-sm mb-4">Veuillez vérifier votre connexion réseau.</p>
                    <button onclick="window.ProductManager.fetchFreshData()" class="px-5 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-gray-800 transition-colors">
                        Réessayer
                    </button>
                </div>\;
                if (grid) grid.innerHTML = retryHtml;
                if (null) null.innerHTML = retryHtml;
                return;
            }

            if (section) section.classList.remove('hidden');
            grid.innerHTML = window.buildSkeletonCardHTML(12);
            return;
        }

        const pinned = products
            .filter(p => p.pinned === true)
            .sort((a, b) => {
                const aDate = new Date(a.created_at || 0).getTime();
                const bDate = new Date(b.created_at || 0).getTime();
                return bDate - aDate;
            })
            .slice(0, 12);

        if (pinned.length === 0) {
            if (section) section.classList.add('hidden');
            grid.innerHTML = '';
            return;
        }

        if (section) section.classList.remove('hidden');

        const isMobile = window.matchMedia('(max-width: 767px)').matches;
        const limit = isMobile ? 4 : 12;
        grid.innerHTML = pinned.slice(0, limit).map((p, idx) =>
            window.buildProductCardHTML(p, {
                animationClass: 'animate-fade-in',
                delay: `${idx * 0.05}s`,
                imageLoading: idx === 0 ? 'eager' : 'lazy',
                prioritizeImage: idx === 0,
                prioritizeAvatar: idx === 0
            })
        ).join('');
        // ✅ Activer le lazy loading sur les nouvelles images
        if (window.initLazyImages) window.initLazyImages(grid);
    },

    renderRecent(products) {
        const grid = document.getElementById('recentProductGrid');
        if (!grid) return;        if (!products || products.length === 0) {

            if (window.ProductManager && window.ProductManager._error) {
                const retryHtml = \<div class="col-span-full py-12 text-center bg-gray-50 rounded-2xl border border-gray-100">
                    <iconify-icon icon="solar:wifi-router-minimalistic-broken" width="48" class="text-red-400 mb-3"></iconify-icon>
                    <p class="text-gray-800 font-semibold mb-1">Impossible de charger les produits</p>
                    <p class="text-gray-500 text-sm mb-4">Veuillez vérifier votre connexion réseau.</p>
                    <button onclick="window.ProductManager.fetchFreshData()" class="px-5 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-gray-800 transition-colors">
                        Réessayer
                    </button>
                </div>\;
                if (grid) grid.innerHTML = retryHtml;
                if (null) null.innerHTML = retryHtml;
                return;
            }

            grid.innerHTML = window.buildSkeletonCardHTML(5);
            return;
        }

        // products are already sorted by created_at desc from manager
        const recentLimit = window.matchMedia('(max-width: 767px)').matches ? 6 : 10;
        const recent = products.slice(0, recentLimit);

        grid.innerHTML = recent.map((p, idx) =>
            window.buildProductCardHTML(p, {
                animationClass: 'animate-fade-in',
                delay: `${idx * 0.05}s`,
                imageLoading: idx === 0 ? 'eager' : 'lazy',
                prioritizeImage: idx === 0,
                prioritizeAvatar: idx === 0
            })
        ).join('');
        // ✅ Activer le lazy loading sur les nouvelles images
        if (window.initLazyImages) window.initLazyImages(grid);
    },

    renderAll(products) {
        const grid = document.getElementById('allProductGrid');
        if (!grid) return;

        if (!products || products.length === 0) {
            grid.innerHTML = window.buildSkeletonCardHTML(8);
            return;
        }

        // Always show exactly five complete rows, whatever the current screen width.
        this.renderFilteredBatch(products, grid, this.getHomeBatchSize(grid), false);
    },

    getHomeColumnCount(grid) {
        const columns = getComputedStyle(grid).gridTemplateColumns;
        return columns ? columns.trim().split(/\s+/).length : 1;
    },

    getHomeBatchSize(grid) {
        // Le client demande exactement 30 produits avant le bouton Voir plus.
        return 30;
    },

    matchesHomeFilter(product, filter) {
        if (!product) return false;
        if (filter === 'all') return true;
        if (filter === 'Promos') return product.isPromo === true;
        return product.category === filter;
    },

    async ensureHomeFilterBatch(category, grid, alreadyRenderedIds = new Set()) {
        if (!window.ProductManager || !grid) return;

        const batchSize = this.getHomeBatchSize(grid);
        while (
            ProductManager.getProducts()
                .filter(product => this.matchesHomeFilter(product, category))
                .filter(product => !alreadyRenderedIds.has(String(product.id))).length < batchSize
            && ProductManager.hasMore()
        ) {
            const beforeCount = ProductManager.getProducts().length;
            await ProductManager.loadMore();
            if (ProductManager.getProducts().length === beforeCount) break;
        }
    },

    /**
     * Renders or appends products to a container.
     * @param {Array} products - List of products.
     * @param {HTMLElement} container - Grid container.
     * @param {number} batchSize - How many to show total or append.
     * @param {boolean} append - If true, only append new products.
     */
    renderFilteredBatch(products, container, batchSize, append = false) {
        if (!products || products.length === 0) {
            if (!append) {

            if (window.ProductManager && window.ProductManager._error) {
                const retryHtml = \<div class="col-span-full py-12 text-center bg-gray-50 rounded-2xl border border-gray-100">
                    <iconify-icon icon="solar:wifi-router-minimalistic-broken" width="48" class="text-red-400 mb-3"></iconify-icon>
                    <p class="text-gray-800 font-semibold mb-1">Impossible de charger les produits</p>
                    <p class="text-gray-500 text-sm mb-4">Veuillez vérifier votre connexion réseau.</p>
                    <button onclick="window.ProductManager.fetchFreshData()" class="px-5 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-gray-800 transition-colors">
                        Réessayer
                    </button>
                </div>\;
                if (null) null.innerHTML = retryHtml;
                if (container) container.innerHTML = retryHtml;
                return;
            }

                const isLoading = window.ProductManager && window.ProductManager.loading;
                if (isLoading) {
                    container.innerHTML = window.buildSkeletonCardHTML(batchSize);
                } else {
                    container.innerHTML = `
                        <div class="col-span-full py-20 text-center">
                            <iconify-icon icon="solar:box-minimalistic-broken" width="64" class="text-gray-300 mb-4" style="color: #cbd5e1;"></iconify-icon>
                            <p class="text-gray-500 font-medium">Aucun produit trouvé</p>
                            <button onclick="location.reload()" class="mt-4 text-sm text-primary hover:underline rounded-xl">Réessayer</button>
                        </div>
                    `;
                }
            }
            return;
        }

        const sortBy = document.getElementById('sortAllProducts')?.value || 'recent';
        let filtered = [...products];

        // Apply sort
        if (sortBy === 'price_asc') {
            filtered.sort((a, b) => a.price - b.price);
        } else if (sortBy === 'price_desc') {
            filtered.sort((a, b) => b.price - a.price);
        } else {
            // Default to 'recent': Ensure strict chronological order (newest first)
            filtered.sort((a, b) => {
                const dateA = new Date(a.created_at || 0).getTime();
                const dateB = new Date(b.created_at || 0).getTime();
                return dateB - dateA;
            });
        }

        const currentFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
        if (currentFilter !== 'all') {
            filtered = filtered.filter(p => this.matchesHomeFilter(p, currentFilter));
        }

        let displayList;
        if (append) {
            // Collect IDs already rendered in the grid to avoid duplicates
            const renderedIds = new Set(
                [...container.querySelectorAll('[data-product-id]')].map(el => el.dataset.productId)
            );
            const notYetRendered = filtered.filter(p => !renderedIds.has(String(p.id)));
            displayList = notYetRendered.slice(0, batchSize);
        } else {
            displayList = filtered.slice(0, batchSize);
        }

        if (displayList.length === 0 && !append) {
             // Handled by noMsg below usually
        }

        const html = displayList.map((p, idx) =>
            window.buildProductCardHTML(p, {
                animationClass: 'animate-fade-in',
                delay: `${idx * 0.05}s`,
                imageLoading: !append && idx === 0 ? 'eager' : 'lazy',
                prioritizeImage: !append && idx === 0,
                prioritizeAvatar: !append && idx === 0
            })
        ).join('');

        if (append) {
            const temp = document.createElement('div');
            temp.innerHTML = html;
            while (temp.firstChild) {
                container.appendChild(temp.firstChild);
            }
        } else {
            container.innerHTML = html;
        }

        // ✅ Activate lazy loading on newly injected images
        if (window.initLazyImages) window.initLazyImages(container);

        // UI toggles
        const voirPlus = document.getElementById('voirPlusContainer');
        if (voirPlus) {
            const finalRenderedIds = new Set(
                [...container.querySelectorAll('[data-product-id]')].map(el => el.dataset.productId)
            );
            const notYetRenderedCount = filtered.filter(p => !finalRenderedIds.has(String(p.id))).length;
            const hasMore = (notYetRenderedCount > 0) || (window.ProductManager && ProductManager.hasMore());
            
            voirPlus.classList.toggle('hidden', !hasMore);
        }

        const noMsg = document.getElementById('noProductsMsg');
        if (noMsg) {
            noMsg.classList.toggle('hidden', filtered.length > 0);
        }

    }
};

window.NewKetPageRefresh = async function () {
    const hasHomeGrids =
        document.getElementById('pinnedProductGrid') ||
        document.getElementById('recentProductGrid') ||
        document.getElementById('allProductGrid');

    if (!hasHomeGrids) return;

    if (window.ProductManager?.fetchFreshData) {
        await window.ProductManager.fetchFreshData();
    }

    UI.renderHomeGrid();
};

/**
 * Global functions for home page filters
 */
window.filterAllProducts = async function (category) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === category);
        btn.classList.toggle('bg-gray-900', btn.dataset.filter === category);
        btn.classList.toggle('text-white', btn.dataset.filter === category);
        btn.classList.toggle('bg-gray-100', btn.dataset.filter !== category);
        btn.classList.toggle('text-gray-700', btn.dataset.filter !== category);
    });

    const grid = document.getElementById('allProductGrid');
    if (grid && !window._isFetchingHome) {
        window._isFetchingHome = true;
        try {
            UI.renderFilteredBatch(ProductManager.getProducts(), grid, UI.getHomeBatchSize(grid), false);
            await UI.ensureHomeFilterBatch(category, grid);
        } catch (err) {
            console.error("Error loading filtered products:", err);
            if (grid) grid.innerHTML = <div class="col-span-full py-12 text-center bg-gray-50 rounded-2xl border border-gray-100"><iconify-icon icon="solar:wifi-router-minimalistic-broken" width="48" class="text-red-400 mb-3"></iconify-icon><p class="text-gray-800 font-semibold mb-1">Impossible de filtrer les produits</p><button onclick="window.filterAllProducts('')" class="px-5 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-gray-800 transition-colors mt-2">Réessayer</button></div>;
        } finally {
            window._isFetchingHome = false;
        }
    }

    UI.renderAll(ProductManager.getProducts());
};

window.sortAndRenderAll = function () {
    UI.renderAll(ProductManager.getProducts());
};

window.showMoreProducts = async function () {
    const grid = document.getElementById('allProductGrid');
    if (!grid || window._isFetchingHome) return;

    window._isFetchingHome = true;
    const button = document.getElementById('voirPlusBtn');
    const buttonLabel = button?.querySelector('span');
    if (button) button.disabled = true;
    if (buttonLabel) buttonLabel.textContent = 'Chargement…';

    try {
        const currentFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
        const renderedIds = new Set(
            [...grid.querySelectorAll('[data-product-id]')].map(el => el.dataset.productId)
        );
        const batchSize = UI.getHomeBatchSize(grid);

        // Fetch only when locally loaded products cannot fill another five-line block.
        // With an active filter, several pages may be needed to find enough matching products.
        await UI.ensureHomeFilterBatch(currentFilter, grid, renderedIds);

        UI.renderFilteredBatch(ProductManager.getProducts(), grid, batchSize, true);
    } catch (err) {
        console.error("Error loading more products:", err);
        if (buttonLabel) {
            buttonLabel.textContent = 'Erreur réseau, réessayer';
            if (button) button.classList.add('border-red-500', 'text-red-500');
            setTimeout(() => {
                if (button) button.classList.remove('border-red-500', 'text-red-500');
                buttonLabel.textContent = 'Voir plus de produits';
            }, 4000);
        }
    } finally {
        window._isFetchingHome = false;
        if (button) button.disabled = false;
        if (buttonLabel) buttonLabel.textContent = 'Voir plus de produits';
    }
};

// Initialize: guard against DOMContentLoaded already fired (ES module behavior)
const uiBootstrap = () => {
    const hasHomeGrids =
        document.getElementById('pinnedProductGrid') ||
        document.getElementById('recentProductGrid') ||
        document.getElementById('allProductGrid');

    if (!hasHomeGrids) return;

    if (window.newketInitialized) {
        UI.init();
    } else {
        window.addEventListener('newketInitialized', () => UI.init());
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', uiBootstrap);
} else {
    uiBootstrap();
}

window.UI = UI;
