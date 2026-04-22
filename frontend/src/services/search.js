/* NewKet EMarket Search Manager - Amazon Style Upgrade */
import { escapeHTML } from './sanitize.js';

const SearchManager = {
    debounceTimer: null,
    selectedCategory: 'all',
    maxRecentSearches: 5,
    initialized: false,

    init() {
        if (this.initialized) return;
        this.initialized = true;

        // Initialize Category Selector
        this.initCategorySelector();

        // Use Event Delegation for robust binding
        document.addEventListener('input', (e) => {
            if (e.target.matches('.search-input, #searchInput, #mobileSearchInput')) {
                const query = e.target.value.trim();
                const container = document.getElementById('searchSuggestions');
                
                clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(() => {
                    this.updateSuggestions(query, container);
                }, 300);
            }
        });

        // Show recent searches on focus
        document.addEventListener('focusin', (e) => {
            if (e.target.matches('.search-input, #searchInput, #mobileSearchInput')) {
                const query = e.target.value.trim();
                const container = document.getElementById('searchSuggestions');
                if (container) {
                    this.toggleOverlay(true);
                    if (query.length < 2) {
                        this.showRecentAndPopular(container);
                    } else {
                        container.classList.add('active');
                    }
                }
            }
        });

        // Hide suggestions on click outside
        document.addEventListener('click', (e) => {
            const container = document.getElementById('searchSuggestions');
            const searchBar = e.target.closest('.search-bar');
            if (container && !searchBar) {
                container.classList.remove('active');
                this.toggleOverlay(false);
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

    initCategorySelector() {
        let menuOpen = false;

        const getMenu = () => document.getElementById('searchCategoryMenu');

        // ONE-TIME teleport: move menu to <body> to escape header stacking context
        const ensurePortal = () => {
            const menu = getMenu();
            if (!menu) return;
            if (menu.dataset.ported === '1') return; // already done
            menu.dataset.ported = '1';
            menu.style.setProperty('position', 'fixed', 'important');
            menu.style.setProperty('z-index', '99999', 'important');
            menu.style.setProperty('margin', '0', 'important');
            document.body.appendChild(menu);
        };

        const positionMenu = () => {
            const btn  = document.getElementById('searchCategoryBtn');
            const menu = getMenu();
            if (!btn || !menu) return;
            const r = btn.getBoundingClientRect();
            const menuWidth = Math.max(r.width, 180);
            const gutter = 8;
            const maxLeft = Math.max(gutter, window.innerWidth - menuWidth - gutter);
            const left = Math.min(Math.max(gutter, r.left), maxLeft);

            menu.style.setProperty('top', `${r.bottom + 6}px`, 'important');
            menu.style.setProperty('left', `${left}px`, 'important');
            menu.style.setProperty('right', 'auto', 'important');
            menu.style.setProperty('min-width', `${menuWidth}px`, 'important');
        };

        const openMenu = () => {
            ensurePortal();
            positionMenu();
            const menu = getMenu();
            if (menu) { menu.classList.remove('hidden'); menuOpen = true; }
        };

        const closeMenu = () => {
            const menu = getMenu();
            if (menu) { menu.classList.add('hidden'); menuOpen = false; }
        };

        // Single unified click handler
        document.addEventListener('click', (e) => {
            // 1. Click on the TOUT button
            if (e.target.closest('#searchCategoryBtn')) {
                menuOpen ? closeMenu() : openMenu();
                e.stopPropagation();
                return;
            }

            // 2. Click on a category option inside the dropdown
            const option = e.target.closest('.category-option');
            if (option) {
                this.selectedCategory = option.dataset.value;
                const nameDisplay = document.getElementById('selectedCategoryName');
                if (nameDisplay) nameDisplay.textContent = option.textContent.trim();
                closeMenu();
                return;
            }

            // 3. Click anywhere else → close
            if (menuOpen) closeMenu();
        });

        // Keep positioned while open
        window.addEventListener('scroll', () => { if (menuOpen) positionMenu(); }, { passive: true });
        window.addEventListener('resize', () => { if (menuOpen) positionMenu(); }, { passive: true });
    },

    getRecentSearches() {
        try {
            return JSON.parse(localStorage.getItem('nk_recent_searches') || '[]');
        } catch (e) { return []; }
    },

    saveRecentSearch(query) {
        if (!query || query.length < 2) return;
        let recent = this.getRecentSearches();
        recent = [query, ...recent.filter(q => q !== query)].slice(0, this.maxRecentSearches);
        localStorage.setItem('nk_recent_searches', JSON.stringify(recent));
    },

    removeRecentSearch(query) {
        let recent = this.getRecentSearches();
        recent = recent.filter(q => q !== query);
        localStorage.setItem('nk_recent_searches', JSON.stringify(recent));
        // Refresh display if active
        const container = document.getElementById('searchSuggestions');
        if (container && container.classList.contains('active')) {
            const input = document.getElementById('searchInput');
            if (input && input.value.trim().length < 2) {
                this.showRecentAndPopular(container);
            }
        }
    },

    showRecentAndPopular(container) {
        const recent = this.getRecentSearches();
        const popular = ['iPhone 15', 'Sac de luxe', 'Rolex', 'Chaussures']; // Example popular tags

        let html = '';

        if (recent.length > 0) {
            html += `
                <div class="suggestion-section">
                    <div class="suggestion-section-title">Recherches Récentes</div>
                    <div class="recent-searches-list">
                        ${recent.map(q => `
                            <div class="recent-search-chip" onclick="SearchManager.executeSearch('${escapeHTML(q)}')">
                                <iconify-icon icon="solar:history-linear" width="14"></iconify-icon>
                                <span>${escapeHTML(q)}</span>
                                <button onclick="event.stopPropagation(); SearchManager.removeRecentSearch('${escapeHTML(q)}')">
                                    <iconify-icon icon="solar:close-circle-bold" width="14"></iconify-icon>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
        }

        html += `
            <div class="suggestion-section">
                <div class="suggestion-section-title">Populaire en ce moment</div>
                <div class="py-2">
                    ${popular.map(q => `
                        <div class="suggestion-item" onclick="SearchManager.executeSearch('${escapeHTML(q)}')">
                            <div class="suggestion-icon">
                                <iconify-icon icon="solar:fire-bold" width="18" class="text-orange-500"></iconify-icon>
                            </div>
                            <div class="suggestion-text">${escapeHTML(q)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>`;

        container.innerHTML = html;
        container.classList.add('active');
    },

    executeSearch(query) {
        if (!query) return;
        this.saveRecentSearch(query);
        
        let path = window.ComponentLoader ? window.ComponentLoader.getAdjustedPath('pages/catalog') : 'src/pages/catalog.html';
        const params = new URLSearchParams();
        params.set('q', query);
        if (this.selectedCategory !== 'all') {
            params.set('category', this.selectedCategory);
        }
        
        window.location.href = `${path}?${params.toString()}`;
    },

    syncQueryFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const query = urlParams.get('q');
        const category = urlParams.get('category');
        
        if (query) {
            const inputs = document.querySelectorAll('.search-input, #searchInput, #mobileSearchInput');
            inputs.forEach(input => input.value = query);
        }
        
        if (category) {
            this.selectedCategory = category;
            const nameDisplay = document.getElementById('selectedCategoryName');
            if (nameDisplay) {
                // Find matching category button text
                const options = document.querySelectorAll('.category-option');
                options.forEach(opt => {
                    if (opt.dataset.value === category) {
                        nameDisplay.textContent = opt.textContent;
                    }
                });
            }
        }
    },

    async updateSuggestions(query, container) {
        if (!container) return;
        if (query.length < 2) {
            this.showRecentAndPopular(container);
            return;
        }

        container.innerHTML = `
            <div class="p-8 text-center text-gray-400 flex flex-col items-center justify-center gap-4">
                <iconify-icon icon="line-md:loading-loop" width="32" class="text-slate-900"></iconify-icon>
                <span class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Exploration du catalogue...</span>
            </div>`;
        container.classList.add('active');

        try {
            // Live fetch from Supabase
            const searchOptions = {
                or: `name.ilike.%${query}%,category.ilike.%${query}%`,
                limit: 6,
                select: 'id, name, category, price, image'
            };

            // Apply category filter if selected
            if (this.selectedCategory !== 'all') {
                searchOptions.category = `eq.${this.selectedCategory}`;
            }

            const filtered = await window.SupabaseAdapter.fetchWithFilters('products', searchOptions);

            if (!filtered || filtered.length === 0) {
                container.innerHTML = `
                    <div class="p-8 text-center bg-gray-50/50">
                        <iconify-icon icon="solar:magnifer-zoom-out-linear" width="40" class="text-slate-200 mb-3"></iconify-icon>
                        <div class="text-xs font-black text-slate-400 uppercase tracking-widest">Aucun résultat pour "${escapeHTML(query)}"</div>
                        <div class="text-[10px] font-medium text-slate-400 mt-1">Vérifiez l'orthographe ou essayez d'autres mots-clés.</div>
                    </div>`;
            } else {
                let html = `
                    <div class="suggestion-section">
                        <div class="suggestion-section-title">Produits suggérés</div>
                        <div class="py-1">`;
                
                html += filtered.map(p => {
                    const firstImg = (p.image || '').split(',')[0];
                    const optImg = firstImg.includes('supabase.co') && !firstImg.includes('?') 
                        ? `${firstImg}?width=100&quality=70` : firstImg;
                        
                    return `
                    <a href="${window.ComponentLoader ? window.ComponentLoader.getAdjustedPath('pages/product') : 'src/pages/product.html'}?id=${p.id}" class="suggestion-item">
                        <div class="suggestion-icon overflow-hidden">
                            <img src="${escapeHTML(optImg)}" class="w-full h-full object-cover" alt="">
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="suggestion-text truncate">${escapeHTML(p.name)}</div>
                            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">${escapeHTML(p.category)}</div>
                        </div>
                        <div class="text-xs font-black text-slate-900">
                            ${window.CurrencyManager ? CurrencyManager.formatPrice(p.price) : p.price + ' FC'}
                        </div>
                    </a>`;
                }).join('');

                html += `</div></div>`;

                // Footer see all
                const catalogPath = window.ComponentLoader ? window.ComponentLoader.getAdjustedPath('pages/catalog') : 'src/pages/catalog.html';
                const searchUrl = `${catalogPath}?q=${encodeURIComponent(query)}${this.selectedCategory !== 'all' ? '&category=' + encodeURIComponent(this.selectedCategory) : ''}`;
                
                html += `
                    <div class="p-3 bg-slate-50/80 border-t border-gray-100 mt-2">
                        <a href="${searchUrl}" class="flex items-center justify-center gap-2 w-full py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-900 hover:bg-slate-50 transition-all shadow-sm">
                            Voir les 10+ résultats
                            <iconify-icon icon="solar:alt-arrow-right-linear" width="14"></iconify-icon>
                        </a>
                    </div>`;

                container.innerHTML = html;
            }
        } catch (error) {
            console.error('[NewKet Search] Error fetching suggestions:', error);
            container.innerHTML = `<div class="p-8 text-center text-red-500 text-[10px] font-bold uppercase tracking-widest">Erreur réseau</div>`;
        }
    },
    toggleOverlay(show) {
        const overlay = document.getElementById('searchOverlay');
        if (overlay) {
            if (show) {
                overlay.classList.add('active');
                document.body.classList.add('search-focused');
            } else {
                overlay.classList.remove('active');
                document.body.classList.remove('search-focused');
            }
        }
    }
};

// Export to window
window.SearchManager = SearchManager;
export default SearchManager;
