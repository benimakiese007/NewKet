/* NewKet EMarket Search Manager - Amazon Style Upgrade */
import { escapeHTML } from './sanitize.js';

const SearchManager = {
    debounceTimer: null,
    selectedCategory: 'all',
    maxRecentSearches: 5,
    initialized: false,
    overlayPortaled: false,
    searchActive: false,
    _suggestionsCache: new Map(),
    _suggestionsSeq: 0,

    init() {
        if (this.initialized) return;
        this.initialized = true;

        this.ensureOverlayPortal();

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
                    this.openSearchOverlay();
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
            if (!container) return;

            const isInsideSearchSurface =
                !!e.target.closest('.search-bar') ||
                !!e.target.closest('#searchSuggestions');

            const clickedOverlay = !!e.target.closest('#searchOverlay');
            const searchInputFocused = !!document.activeElement?.matches?.('.search-input, #searchInput, #mobileSearchInput');

            if (clickedOverlay || (!isInsideSearchSurface && !searchInputFocused)) {
                container.classList.remove('active');
                this.closeSearchOverlay();
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
        const mobileSelect = document.getElementById('mobileSearchCategorySelect');
        const nativeShell = document.getElementById('mobileSearchCategoryNativeShell');
        const customBtn = document.getElementById('searchCategoryBtn');
        const isAppleMobile = () => {
            const ua = navigator.userAgent || '';
            const touchMac = ua.includes('Macintosh') && navigator.maxTouchPoints > 1;
            return /iPhone|iPad|iPod/.test(ua) || touchMac;
        };
        const applyCategoryMode = () => {
            const useNativeMobile = isAppleMobile() && window.innerWidth < 640;
            document.documentElement.classList.toggle('ios-native-category', useNativeMobile);

            if (nativeShell) {
                nativeShell.style.display = useNativeMobile ? 'flex' : 'none';
            }

            if (customBtn) {
                customBtn.style.display = useNativeMobile ? 'none' : 'flex';
            }

            if (useNativeMobile && menuOpen) {
                closeMenu();
            }
        };
        const syncCategoryUI = () => {
            const nameDisplay = document.getElementById('selectedCategoryName');
            const activeOption = document.querySelector(`.category-option[data-value="${CSS.escape(this.selectedCategory)}"]`);

            if (nameDisplay && activeOption) {
                nameDisplay.textContent = activeOption.textContent.trim();
            }

            if (mobileSelect) {
                mobileSelect.value = this.selectedCategory;
            }
        };

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
            
            // Dim the page background
            this.openSearchOverlay();
            
            // Blur the search suggestions while category menu is open
            const suggestions = document.getElementById('searchSuggestions');
            if (suggestions) {
                suggestions.style.filter = 'blur(4px)';
                suggestions.style.opacity = '0.6';
                suggestions.style.pointerEvents = 'none';
                suggestions.style.transition = 'all 0.2s ease-in-out';
            }
        };

        const closeMenu = () => {
            const menu = getMenu();
            if (menu) { menu.classList.add('hidden'); menuOpen = false; }
            
            // Remove blur from search suggestions
            const suggestions = document.getElementById('searchSuggestions');
            if (suggestions) {
                suggestions.style.filter = '';
                suggestions.style.opacity = '';
                suggestions.style.pointerEvents = '';
            }
            
            // Close search overlay only if search input is not focused
            const searchInput = document.getElementById('searchInput');
            const mobileSearchInput = document.getElementById('mobileSearchInput');
            if ((!searchInput || document.activeElement !== searchInput) && 
                (!mobileSearchInput || document.activeElement !== mobileSearchInput)) {
                this.closeSearchOverlay();
            }
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
                syncCategoryUI();
                closeMenu();
                return;
            }

            // 3. Click anywhere else → close
            if (menuOpen) closeMenu();
        });

        // Keep positioned while open
        window.addEventListener('scroll', () => { if (menuOpen) positionMenu(); }, { passive: true });
        window.addEventListener('resize', () => { if (menuOpen) positionMenu(); }, { passive: true });
        window.addEventListener('resize', applyCategoryMode, { passive: true });

        if (mobileSelect && mobileSelect.dataset.bound !== 'true') {
            mobileSelect.addEventListener('change', () => {
                this.selectedCategory = mobileSelect.value || 'all';
                syncCategoryUI();
            });
            mobileSelect.dataset.bound = 'true';
        }

        applyCategoryMode();
        syncCategoryUI();
    },

    ensureOverlayPortal() {
        const overlay = document.getElementById('searchOverlay');
        if (!overlay || this.overlayPortaled) return;

        document.body.appendChild(overlay);
        this.overlayPortaled = true;
    },

    openSearchOverlay() {
        this.ensureOverlayPortal();
        this.searchActive = true;
        const overlay = document.getElementById('searchOverlay');
        const header = document.querySelector('.main-header');
        if (overlay) {
            document.body.classList.add('search-focused');
            if (header) {
                // Fix for iOS Safari backdrop-filter bleed bug: 
                // Measure after class is applied so any CSS transforms are reset.
                const headerRect = header.getBoundingClientRect();
                overlay.style.top = `${headerRect.bottom}px`;
            }
            overlay.classList.add('active');
        }
    },

    closeSearchOverlay() {
        this.searchActive = false;
        const overlay = document.getElementById('searchOverlay');
        if (overlay) {
            overlay.classList.remove('active');
            document.body.classList.remove('search-focused');
        }
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

    async showRecentAndPopular(container) {
        const recent = this.getRecentSearches();

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
                                <button onclick="event.stopPropagation(); SearchManager.removeRecentSearch('${escapeHTML(q)}')" class="rounded-xl">
                                    <iconify-icon icon="solar:close-circle-bold" width="14"></iconify-icon>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
        }

        // Fetch latest products — 1 per seller (user_id), max 4 displayed ("Récemment ajoutés")
        try {
            const popOptions = {
                limit: 20, // Fetch more to ensure we get 4 distinct sellers
                order: ['created_at', { ascending: false }],
                select: '*, users!supplier_email(seller_type)',
                eq: [['is_archived', false]]
            };
            
            // Apply category filter if selected
            if (this.selectedCategory !== 'all') {
                popOptions.eq.push(['category', this.selectedCategory]);
            }

            const allRecentProducts = await window.SupabaseAdapter.fetchWithFilters('products', popOptions);

            // Deduplicate: keep only the most recent product per seller, max 4
            const seenSellers = new Set();
            const recentProducts = (allRecentProducts || []).filter(p => {
                const sellerKey = p.user_id || p.id; // fallback to id if user_id missing
                if (seenSellers.has(sellerKey)) return false;
                seenSellers.add(sellerKey);
                return true;
            }).slice(0, 4);

            if (recentProducts.length > 0) {
                html += `
                    <div class="suggestion-section">
                        <div class="suggestion-section-title">Récemment ajoutés</div>
                        <div class="py-1">`;
                
                html += recentProducts.map(p => {
                    const mappedP = window.ProductManager && typeof window.ProductManager._mapProduct === 'function' ? window.ProductManager._mapProduct(p) : p;
                    const optImg = (window.getOptimizedImageUrl ? window.getOptimizedImageUrl(mappedP.image, { width: 120, quality: 70 }) : mappedP.image) || '';
                    const optImgSrcSet = window.buildResponsiveImageSrcSet ? window.buildResponsiveImageSrcSet(mappedP.image, [48, 72, 120], { quality: 70 }) : '';
                    const fallbackImg = 'https://res.cloudinary.com/dzhnphyp3/image/upload/c_limit,w_120,f_auto,q_auto/v1782572380/newket_assets/frontend/src/assets/Images/default.jpg';
                    const isCertified = mappedP.users?.seller_type === 'certified';
                    const certifiedBadge = isCertified ? `<iconify-icon icon="solar:verified-check-bold" class="inline-block align-text-bottom ml-1" style="color: #3b82f6 !important;" width="14" title="Vendeur Certifié"></iconify-icon>` : '';
                        
                    return `
                    <a href="${window.NewKetLinks?.buildProductPagePath ? window.NewKetLinks.buildProductPagePath({ productName: mappedP.name, productId: mappedP.id }) : ((window.ComponentLoader ? window.ComponentLoader.getAdjustedPath('pages/product') : '/product') + '?id=' + mappedP.id)}" class="suggestion-item">
                        <div class="suggestion-icon overflow-hidden rounded-md bg-gray-100 flex-shrink-0" style="width: 40px; height: 40px;">
                            <img src="${escapeHTML(optImg || fallbackImg)}"${optImgSrcSet ? ` srcset="${escapeHTML(optImgSrcSet)}" sizes="40px"` : ''} loading="lazy" decoding="async" class="w-full h-full object-cover" alt="${escapeHTML(mappedP.name)}" onerror="this.onerror=null; this.removeAttribute('srcset'); this.removeAttribute('sizes'); this.src='${fallbackImg}';">
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="suggestion-text truncate">${escapeHTML(mappedP.name)}</div>
                            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">${escapeHTML(mappedP.category)}</div>
                        </div>
                        <div class="text-xs font-black text-slate-900 flex items-center">
                            ${window.CurrencyManager ? CurrencyManager.formatPrice(mappedP.price) : mappedP.price + ' FC'}
                            ${certifiedBadge}
                        </div>
                    </a>`;
                }).join('');

                html += `</div></div>`;
            }
        } catch (e) {
            console.error('[NewKet] Failed to fetch popular products:', e);
        }

        container.innerHTML = html;
        container.classList.add('active');
    },

    executeSearch(query) {
        if (!query) return;
        this.saveRecentSearch(query);
        
        let path = window.ComponentLoader ? window.ComponentLoader.getAdjustedPath('pages/catalog') : '/catalog';
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
        }

        const nameDisplay = document.getElementById('selectedCategoryName');
        const mobileSelect = document.getElementById('mobileSearchCategorySelect');
        const activeOption = document.querySelector(`.category-option[data-value="${CSS.escape(this.selectedCategory)}"]`);
        if (nameDisplay && activeOption) {
            nameDisplay.textContent = activeOption.textContent.trim();
        }
        if (mobileSelect) {
            mobileSelect.value = this.selectedCategory;
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
            const cacheKey = `${this.selectedCategory}::${query.toLowerCase()}`;
            const cached = this._suggestionsCache.get(cacheKey);
            if (cached && Date.now() < cached.expiresAt) {
                container.innerHTML = cached.html;
                return;
            }

            const seq = ++this._suggestionsSeq;

            // Clean query for safe PostgREST embedding
            const safeQuery = query.replace(/"/g, '');

            // Live fetch from Supabase
            const searchOptions = {
                or: `name.ilike."%${safeQuery}%",category.ilike."%${safeQuery}%"`,
                limit: 6,
                select: '*, users!supplier_email(seller_type)',
                eq: [['is_archived', false]]
            };

            // Apply category filter if selected
            if (this.selectedCategory !== 'all') {
                searchOptions.eq.push(['category', this.selectedCategory]);
            }

            const filtered = await window.SupabaseAdapter.fetchWithFilters('products', searchOptions);

            // If a newer request started, ignore this result
            if (seq !== this._suggestionsSeq) return;

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
                    const mappedP = window.ProductManager && typeof window.ProductManager._mapProduct === 'function' ? window.ProductManager._mapProduct(p) : p;
                    const optImg = (window.getOptimizedImageUrl ? window.getOptimizedImageUrl(mappedP.image, { width: 120, quality: 70 }) : mappedP.image) || '';
                    const optImgSrcSet = window.buildResponsiveImageSrcSet ? window.buildResponsiveImageSrcSet(mappedP.image, [48, 72, 120], { quality: 70 }) : '';
                    const fallbackImg = 'https://res.cloudinary.com/dzhnphyp3/image/upload/c_limit,w_120,f_auto,q_auto/v1782572380/newket_assets/frontend/src/assets/Images/default.jpg';
                    const isCertified = mappedP.users?.seller_type === 'certified';
                    const certifiedBadge = isCertified ? `<iconify-icon icon="solar:verified-check-bold" class="inline-block align-text-bottom ml-1" style="color: #3b82f6 !important;" width="14" title="Vendeur Certifié"></iconify-icon>` : '';
                        
                    return `
                    <a href="${window.NewKetLinks?.buildProductPagePath ? window.NewKetLinks.buildProductPagePath({ productName: mappedP.name, productId: mappedP.id }) : ((window.ComponentLoader ? window.ComponentLoader.getAdjustedPath('pages/product') : '/product') + '?id=' + mappedP.id)}" class="suggestion-item">
                        <div class="suggestion-icon overflow-hidden rounded-md bg-gray-100 flex-shrink-0" style="width: 40px; height: 40px;">
                            <img src="${escapeHTML(optImg || fallbackImg)}"${optImgSrcSet ? ` srcset="${escapeHTML(optImgSrcSet)}" sizes="40px"` : ''} loading="lazy" decoding="async" class="w-full h-full object-cover" alt="${escapeHTML(mappedP.name)}" onerror="this.onerror=null; this.removeAttribute('srcset'); this.removeAttribute('sizes'); this.src='${fallbackImg}';">
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="suggestion-text truncate">${escapeHTML(mappedP.name)}</div>
                            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">${escapeHTML(mappedP.category)}</div>
                        </div>
                        <div class="text-xs font-black text-slate-900 flex items-center">
                            ${window.CurrencyManager ? CurrencyManager.formatPrice(mappedP.price) : mappedP.price + ' FC'}
                            ${certifiedBadge}
                        </div>
                    </a>`;
                }).join('');

                html += `</div></div>`;

                // Footer see all
                const catalogPath = window.ComponentLoader ? window.ComponentLoader.getAdjustedPath('pages/catalog') : '/catalog';
                const searchUrl = `${catalogPath}?q=${encodeURIComponent(query)}${this.selectedCategory !== 'all' ? '&category=' + encodeURIComponent(this.selectedCategory) : ''}`;
                
                html += `
                    <div class="p-3 bg-white border-t border-gray-100 mt-2">
                        <a href="${searchUrl}" class="flex items-center justify-center gap-2 w-full py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-900 hover:bg-slate-50 transition-all shadow-sm">
                            Voir les 10+ résultats
                            <iconify-icon icon="solar:alt-arrow-right-linear" width="14"></iconify-icon>
                        </a>
                    </div>`;

                container.innerHTML = html;
                this._suggestionsCache.set(cacheKey, { html, expiresAt: Date.now() + 30_000 }); // 30s
            }
        } catch (error) {
            console.error('[NewKet Search] Error fetching suggestions:', error);
            container.innerHTML = `<div class="p-8 text-center text-red-500 text-[10px] font-bold uppercase tracking-widest">Erreur réseau</div>`;
        }
    },
    toggleOverlay(show) {
        if (show) this.openSearchOverlay();
        else this.closeSearchOverlay();
    }
};

// Export to window
window.SearchManager = SearchManager;
export default SearchManager;
