/**
 * NewKet UI Handler — V2
 * Manages specialized rendering for Home page and common UI states.
 */

const UI = {
    init() {
        this.renderHomeGrid();

        // Listen for data updates — skip if a scroll-triggered loadMore is in progress
        window.addEventListener('productsUpdated', () => {
            if (!window._isFetchingHome) {
                this.renderHomeGrid();
            }
        });

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
        if (!grid) return;

        if (!products || products.length === 0) {
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

        // Initial render: always clear if called directly (e.g. on filter change)
        const batchSize = window.matchMedia('(max-width: 767px)').matches
            ? Math.min(ProductManager.getBatchSize?.() || 8, 6)
            : (ProductManager.getBatchSize?.() || 8);
        this.renderFilteredBatch(products, grid, batchSize, false);
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
            filtered = filtered.filter(p => {
                if (currentFilter === 'Femme') return p.category === 'Femme' || p.category === 'Collections Femme';
                if (currentFilter === 'Homme') return p.category === 'Homme' || p.category === 'Style Homme';
                if (currentFilter === 'Promos') return p.isPromo === true;
                return p.category === currentFilter;
            });
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
            
            voirPlus.classList.add('hidden'); // Hide the old button

            let sentinel = document.getElementById('homeLoadMoreSentinel');
            if (hasMore) {
                if (!sentinel) {
                    sentinel = document.createElement('div');
                    sentinel.id = 'homeLoadMoreSentinel';
                    sentinel.className = 'w-full flex justify-center py-8 mt-4';
                    sentinel.innerHTML = `<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 border-t-transparent"></div>`;
                    voirPlus.parentNode.insertBefore(sentinel, voirPlus);
                    
                    if (!window.homeObserver) {
                        window.homeObserver = new IntersectionObserver((entries) => {
                            if (entries[0].isIntersecting) {
                                window.showMoreProducts();
                            }
                        }, { rootMargin: '300px' });
                    }
                    window.homeObserver.observe(sentinel);
                }
            } else {
                if (sentinel) {
                    if (window.homeObserver) window.homeObserver.unobserve(sentinel);
                    sentinel.remove();
                }
            }
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
window.filterAllProducts = function (category) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === category);
        btn.classList.toggle('bg-gray-900', btn.dataset.filter === category);
        btn.classList.toggle('text-white', btn.dataset.filter === category);
        btn.classList.toggle('bg-gray-100', btn.dataset.filter !== category);
        btn.classList.toggle('text-gray-700', btn.dataset.filter !== category);
    });
    UI.renderAll(ProductManager.getProducts());
};

window.sortAndRenderAll = function () {
    UI.renderAll(ProductManager.getProducts());
};

window.showMoreProducts = async function () {
    const grid = document.getElementById('allProductGrid');
    if (!grid || window._isFetchingHome) return;

    window._isFetchingHome = true;

    try {
        const batchSize = ProductManager.getBatchSize?.() || 8;

        const currentFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
        let filtered = [...ProductManager.getProducts()];
        if (currentFilter !== 'all') {
            filtered = filtered.filter(p => {
                if (currentFilter === 'Femme') return p.category === 'Femme' || p.category === 'Collections Femme';
                if (currentFilter === 'Homme') return p.category === 'Homme' || p.category === 'Style Homme';
                if (currentFilter === 'Promos') return p.isPromo === true;
                return p.category === currentFilter;
            });
        }

        // Collect IDs already rendered
        const renderedIds = new Set(
            [...grid.querySelectorAll('[data-product-id]')].map(el => el.dataset.productId)
        );
        const notYetRendered = filtered.filter(p => !renderedIds.has(String(p.id)));

        // If we have no more local items and Supabase has more pages, fetch them
        if (notYetRendered.length === 0 && ProductManager.hasMore()) {
            await ProductManager.loadMore();
            // Re-compute after fresh data (productsUpdated is blocked by _isFetchingHome)
            let freshFiltered = [...ProductManager.getProducts()];
            if (currentFilter !== 'all') {
                freshFiltered = freshFiltered.filter(p => {
                    if (currentFilter === 'Femme') return p.category === 'Femme' || p.category === 'Collections Femme';
                    if (currentFilter === 'Homme') return p.category === 'Homme' || p.category === 'Style Homme';
                    if (currentFilter === 'Promos') return p.isPromo === true;
                    return p.category === currentFilter;
                });
            }
            const freshNotRendered = freshFiltered.filter(p => !renderedIds.has(String(p.id)));
            UI.renderFilteredBatch(freshNotRendered, grid, batchSize, true);
        } else {
            UI.renderFilteredBatch(notYetRendered, grid, batchSize, true);
        }
    } catch (err) {
        console.error("Error loading more products:", err);
        if (window.showToast) showToast('Erreur lors du chargement', 'error');
    } finally {
        window._isFetchingHome = false;
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
