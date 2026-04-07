/* newket EMarket Search Manager */
import { escapeHTML } from './sanitize.js';

const SearchManager = {
    debounceTimer: null,

    init() {
        if (this.initialized) return;
        this.initialized = true;

        // Use Event Delegation for robust binding
        document.addEventListener('input', (e) => {
            if (e.target.matches('.search-input, #searchInput, #mobileSearchInput')) {
                const query = e.target.value.trim();
                const container = document.getElementById('searchSuggestions');
                
                clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(() => {
                    this.updateSuggestions(query, container);
                }, 300); // 300ms debounce
            }
        });

        // Hide suggestions on blur (with delay for clicks)
        document.addEventListener('focusout', (e) => {
            if (e.target.matches('.search-input, #searchInput, #mobileSearchInput')) {
                const container = document.getElementById('searchSuggestions');
                if (container) {
                    setTimeout(() => container.classList.add('hidden'), 200);
                }
            }
        });

        document.addEventListener('focusin', (e) => {
            if (e.target.matches('.search-input, #searchInput, #mobileSearchInput')) {
                const query = e.target.value.trim();
                const container = document.getElementById('searchSuggestions');
                if (query.length >= 2 && container) container.classList.remove('hidden');
            }
        });

        document.addEventListener('click', (e) => {
            const btn = e.target.closest('#searchBtn');
            if (btn) {
                const input = document.getElementById('searchInput') || document.getElementById('mobileSearchInput');
                const query = input ? input.value.trim() : '';
                this.executeSearch(query);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (e.target.matches('.search-input, #searchInput, #mobileSearchInput')) {
                    const query = e.target.value.trim();
                    this.executeSearch(query);
                }
            }
        });

        // Initial sync from URL
        this.syncQueryFromURL();
    },

    executeSearch(query) {
        if (!query) return;
        const basePath = window.ComponentLoader ? window.ComponentLoader.getAdjustedPath('pages/catalog.html') : 'catalog.html';
        const searchPath = `${basePath}?q=${encodeURIComponent(query)}`;
        
        // If already on catalog/promo, we might want to just update the URL without reload, 
        // but for simplicity and consistency with current logic, we use location.href
        window.location.href = searchPath;
    },

    syncQueryFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const query = urlParams.get('q');
        if (query) {
            const inputs = document.querySelectorAll('.search-input, #searchInput, #mobileSearchInput');
            inputs.forEach(input => {
                input.value = query;
            });
        }
    },

    async updateSuggestions(query, container) {
        if (!container) return;
        if (query.length < 2) {
            container.classList.add('hidden');
            return;
        }

        // Show loading UI
        container.innerHTML = `
            <div class="p-6 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
                <iconify-icon icon="line-md:loading-loop" width="28" class="text-gray-900 dark:text-gray-100"></iconify-icon>
                <span class="text-[10px] font-bold uppercase tracking-widest">Recherche en cours...</span>
            </div>`;
        container.classList.remove('hidden');

        try {
            // Live fetch from Supabase via central Adapter
            const searchOptions = {
                or: `name.ilike.%${query}%,category.ilike.%${query}%`,
                limit: 5,
                select: 'id, name, category, price, image'
            };

            const filtered = await window.SupabaseAdapter.fetchWithFilters('products', searchOptions);

            if (!filtered || filtered.length === 0) {
                container.innerHTML = `
                    <div class="p-5 text-center text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest">
                        Aucun résultat pour "${escapeHTML(query)}"
                    </div>`;
            } else {
                container.innerHTML = filtered.map(p => {
                    const firstImg = (p.image || '').split(',')[0];
                    const optImg = firstImg.includes('supabase.co') && !firstImg.includes('?') 
                        ? `${firstImg}?width=100&quality=70` : firstImg;
                        
                    return `
                    <a href="product.html?id=${escapeHTML(p.id)}" class="flex items-center gap-4 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group">
                        <div class="w-10 h-10 bg-gray-50 dark:bg-gray-900 rounded-xl p-1.5 flex-shrink-0">
                            <img src="${escapeHTML(optImg)}" loading="lazy" class="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal" alt="${escapeHTML(p.name)}">
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-xs font-black text-gray-900 dark:text-gray-100 truncate group-hover:text-black dark:group-hover:text-white transition-colors">${escapeHTML(p.name)}</div>
                            <div class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">${escapeHTML(p.category)}</div>
                        </div>
                        <div class="text-xs font-black text-gray-900 dark:text-gray-100">
                            ${window.CurrencyManager ? CurrencyManager.formatPrice(p.price) : p.price + ' FC'}
                        </div>
                    </a>
                `}).join('') + `
                    <div class="p-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                        <button onclick="window.location.href=(window.ComponentLoader ? window.ComponentLoader.getAdjustedPath('pages/catalog.html') : 'catalog.html') + '?q=${encodeURIComponent(query)}'" class="w-full py-2 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                            Voir tous les résultats
                        </button>
                    </div>`;
            }
        } catch (error) {
            console.error('[NewKet Search] Error fetching suggestions:', error);
            container.innerHTML = `
                <div class="p-4 text-center text-red-500 text-[10px] font-bold uppercase tracking-widest">
                    Erreur réseau
                </div>`;
        }
    }
};

window.SearchManager = SearchManager;

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
    SearchManager.init();
});
