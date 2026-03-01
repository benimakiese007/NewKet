/* newket EMarket Search Manager */

const SearchManager = {
    init() {
        const searchInputs = document.querySelectorAll('.search-input, #searchInput, #mobileSearchInput');
        const suggestionsContainers = {
            desktop: document.getElementById('searchSuggestions'),
            mobile: document.getElementById('mobileSearchSuggestions')
        };

        searchInputs.forEach(input => {
            const isMobile = input.id === 'mobileSearchInput' || input.closest('#mobileSearchContainer');
            const container = isMobile ? suggestionsContainers.mobile : suggestionsContainers.desktop;

            if (!container) return;

            input.addEventListener('input', (e) => {
                const query = e.target.value.trim().toLowerCase();
                this.updateSuggestions(query, container);
            });

            // Hide suggestions on blur (with delay for clicks)
            input.addEventListener('blur', () => {
                setTimeout(() => container.classList.add('hidden'), 200);
            });

            input.addEventListener('focus', (e) => {
                const query = e.target.value.trim().toLowerCase();
                if (query.length >= 2) container.classList.remove('hidden');
            });
        });
    },

    updateSuggestions(query, container) {
        if (!container) return;
        if (query.length < 2) {
            container.classList.add('hidden');
            return;
        }

        const products = window.ProductManager ? ProductManager.getProducts() : [];
        const filtered = products.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.category.toLowerCase().includes(query)
        ).slice(0, 6);

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="p-4 text-center text-gray-400 text-xs font-bold uppercase tracking-widest">
                    Aucun résultat pour "${query}"
                </div>`;
        } else {
            container.innerHTML = filtered.map(p => `
                <a href="product.html?id=${p.id}" class="flex items-center gap-4 p-3 hover:bg-gray-50 transition-colors group">
                    <div class="w-10 h-10 bg-gray-50 rounded-xl p-1.5 flex-shrink-0">
                        <img src="${(p.image || '').split(',')[0]}" class="w-full h-full object-contain mix-blend-multiply" alt="${p.name}">
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="text-xs font-black text-gray-900 truncate group-hover:text-black transition-colors">${p.name}</div>
                        <div class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">${p.category}</div>
                    </div>
                    <div class="text-xs font-black text-gray-900">
                        ${window.CurrencyManager ? CurrencyManager.formatPrice(p.price) : p.price + ' FC'}
                    </div>
                </a>
            `).join('') + `
                <div class="p-2 border-t border-gray-50 bg-gray-50/50">
                    <button onclick="window.location.href='catalog.html?search=${encodeURIComponent(query)}'" class="w-full py-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black transition-colors">
                        Voir tous les résultats
                    </button>
                </div>`;
        }
        container.classList.remove('hidden');
    }
};

window.SearchManager = SearchManager;

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
    SearchManager.init();
});
