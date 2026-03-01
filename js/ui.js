/**
 * NewKet UI Handler — V2
 * Manages specialized rendering for Home page and common UI states.
 */

const UI = {
    init() {
        console.log('[NewKet UI] Handler initializing...');
        this.renderHomeGrid();

        // Listen for data updates
        window.addEventListener('productsUpdated', () => {
            console.log('[NewKet UI] Data updated, re-rendering...');
            this.renderHomeGrid();
        });

        // Listen for favorites changes
        window.addEventListener('favoritesUpdated', () => {
            this.renderHomeGrid();
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
        if (!allProducts || allProducts.length === 0) return;

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

        // Filter products where pinned is true or high rating as proxy
        const pinned = products.filter(p => p.pinned === true || p.is_pinned === true).slice(0, 5);

        // Fallback: if none marked as pinned, use 5 highest rated
        const displayList = pinned.length > 0 ? pinned : [...products].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5);

        grid.innerHTML = displayList.map((p, idx) =>
            window.buildProductCardHTML(p, { animationClass: 'animate-fade-in', delay: `${idx * 0.1}s` })
        ).join('');
    },

    renderRecent(products) {
        const grid = document.getElementById('recentProductGrid');
        if (!grid) return;

        // products are already sorted by created_at desc from manager
        const recent = products.slice(0, 10);

        grid.innerHTML = recent.map((p, idx) =>
            window.buildProductCardHTML(p, { animationClass: 'animate-fade-in', delay: `${idx * 0.05}s` })
        ).join('');
    },

    renderAll(products) {
        const grid = document.getElementById('allProductGrid');
        if (!grid) return;

        // Initial render of products for the main grid (can be further filtered by the user)
        // We only render the first batch here
        const initialBatchSize = 8;
        this.renderFilteredBatch(products, grid, initialBatchSize);
    },

    renderFilteredBatch(products, container, batchSize) {
        // This is the default render, used by the home page filter system
        const sortBy = document.getElementById('sortAllProducts')?.value || 'recent';
        let filtered = [...products];

        // Apply sort
        if (sortBy === 'price_asc') filtered.sort((a, b) => a.price - b.price);
        else if (sortBy === 'price_desc') filtered.sort((a, b) => b.price - a.price);
        // 'recent' is default

        const currentFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
        if (currentFilter !== 'all') {
            filtered = filtered.filter(p => p.category === currentFilter);
        }

        const displayList = filtered.slice(0, batchSize);
        container.innerHTML = displayList.map((p, idx) =>
            window.buildProductCardHTML(p, { animationClass: 'animate-fade-in', delay: `${idx * 0.05}s` })
        ).join('');

        // Handle "Voir Plus" button
        const voirPlus = document.getElementById('voirPlusContainer');
        if (voirPlus) {
            if (filtered.length > batchSize) voirPlus.classList.remove('hidden');
            else voirPlus.classList.add('hidden');
        }

        // Handle "No products" msg
        const noMsg = document.getElementById('noProductsMsg');
        if (noMsg) {
            if (filtered.length === 0) noMsg.classList.remove('hidden');
            else noMsg.classList.add('hidden');
        }
    }
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

window.showMoreProducts = function () {
    const grid = document.getElementById('allProductGrid');
    if (grid) {
        UI.renderFilteredBatch(ProductManager.getProducts(), grid, 24);
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for App to initialize data managers
    window.addEventListener('newketInitialized', () => {
        UI.init();
    });
});

window.UI = UI;
