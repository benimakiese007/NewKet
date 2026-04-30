/**
 * NewKet UI Handler — V2
 * Manages specialized rendering for Home page and common UI states.
 */

const UI = {
    init() {
        this.renderHomeGrid();

        // Listen for data updates
        window.addEventListener('productsUpdated', () => {
            this.renderHomeGrid();
        });

        // favoritesUpdated listener removed - handled by FavoritesManager.updateUI() for better performance.


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
        if (!grid) return;

        // If no products yet, show skeletons
        if (!products || products.length === 0) {
            grid.innerHTML = window.buildSkeletonCardHTML(5);
            return;
        }

        // Filter products where pinned is true or high rating as proxy
        const pinned = products.filter(p => p.pinned === true || p.is_pinned === true).slice(0, 5);

        // Fallback: if none marked as pinned, use 5 highest rated
        const displayList = pinned.length > 0 ? pinned : [...products].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5);

        grid.innerHTML = displayList.map((p, idx) =>
            window.buildProductCardHTML(p, {
                animationClass: 'animate-fade-in',
                delay: `${idx * 0.05}s`,
                imageLoading: 'eager',
                prioritizeImage: true,
                prioritizeAvatar: true
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
        const recent = products.slice(0, 10);

        grid.innerHTML = recent.map((p, idx) =>
            window.buildProductCardHTML(p, {
                animationClass: 'animate-fade-in',
                delay: `${idx * 0.05}s`,
                imageLoading: idx < 4 ? 'eager' : 'lazy',
                prioritizeImage: idx < 4,
                prioritizeAvatar: idx < 2
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
        this.renderFilteredBatch(products, grid, ProductManager.getBatchSize?.() || 8, false);
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
            if (!append) container.innerHTML = window.buildSkeletonCardHTML(batchSize);
            return;
        }

        const sortBy = document.getElementById('sortAllProducts')?.value || 'recent';
        let filtered = [...products];

        // Apply sort
        if (sortBy === 'price_asc') filtered.sort((a, b) => a.price - b.price);
        else if (sortBy === 'price_desc') filtered.sort((a, b) => b.price - a.price);

        const currentFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
        if (currentFilter !== 'all') {
            filtered = filtered.filter(p => {
                if (currentFilter === 'Femme') return p.category === 'Femme' || p.category === 'Collections Femme';
                if (currentFilter === 'Homme') return p.category === 'Homme' || p.category === 'Style Homme';
                if (currentFilter === 'Promos') return p.isPromo === true;
                return p.category === currentFilter;
            });
        }

        const displayList = append 
            ? filtered.slice(container.children.length, container.children.length + batchSize)
            : filtered.slice(0, batchSize);

        if (displayList.length === 0 && !append) {
             // Handled by noMsg below usually
        }

        const html = displayList.map((p, idx) =>
            window.buildProductCardHTML(p, {
                animationClass: 'animate-fade-in',
                delay: `${idx * 0.05}s`,
                imageLoading: !append && idx < 4 ? 'eager' : 'lazy',
                prioritizeImage: !append && idx < 4,
                prioritizeAvatar: !append && idx < 2
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
            const hasMore = window.ProductManager && ProductManager.hasMore();
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
    const btn = document.getElementById('voirPlusBtn');
    const grid = document.getElementById('allProductGrid');
    if (!btn || !grid) return;

    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = `<iconify-icon icon="line-md:loading-twotone-loop" width="18"></iconify-icon> <span class="ml-2">Chargement...</span>`;

    try {
        await ProductManager.loadMore();
        // Since we want to APPEND, we call renderFilteredBatch with append=true
        // Using batch size from manager or default
        const batchSize = ProductManager.getBatchSize?.() || 8;
        UI.renderFilteredBatch(ProductManager.getProducts(), grid, batchSize, true);
    } catch (err) {
        console.error("Error loading more products:", err);
        if (window.showToast) showToast('Erreur lors du chargement', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

// Initialize: guard against DOMContentLoaded already fired (ES module behavior)
const uiBootstrap = () => {
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
