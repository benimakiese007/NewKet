/**
 * NewKet UI Helpers
 * Common utilities for UI rendering and interactions.
 */

/// Global Notification Queue (One by one system)
let _toastQueue = [];
let _isShowingToast = false;

/**
 * Shows a toast message to the user using a central queue system.
 */
function showToast(message, type = 'info', title = null, iconOverride = null) {
    _toastQueue.push({ message, type, title, iconOverride });
    if (!_isShowingToast) {
        _processToastQueue();
    }
}

async function _processToastQueue() {
    if (_toastQueue.length === 0) {
        _isShowingToast = false;
        return;
    }

    _isShowingToast = true;
    const { message, type, title } = _toastQueue.shift();
    
    const container = createToastContainer();
    const toast = document.createElement('div');
    toast.className = `nk-toast nk-toast-${type}`;
    
    // Safety check for escapeHTML
    const escape = (str) => (typeof window.escapeHTML === 'function') ? window.escapeHTML(str) : String(str).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    const safeMsg = escape(message);
    const safeTitle = title ? escape(title) : null;
    
    toast.innerHTML = `
        <div class="nk-toast-body">
            ${safeTitle ? `<div class="nk-toast-title">${safeTitle}</div>` : ''}
            <div class="nk-toast-content">${safeMsg}</div>
        </div>
        <button class="nk-toast-close" aria-label="Fermer">&times;</button>
    `;

    container.appendChild(toast);

    // Manual Close
    const closeBtn = toast.querySelector('.nk-toast-close');
    let autoCloseTimer;

    const dismiss = () => {
        clearTimeout(autoCloseTimer);
        toast.classList.add('exit');
        toast.addEventListener('animationend', () => {
            toast.remove();
            _processToastQueue();
        }, { once: true });
    };

    closeBtn.onclick = (e) => {
        e.stopPropagation();
        dismiss();
    };

    // Swipe to dismiss (Mobile - SWIPE UP)
    let touchStartY = 0;
    let isSwiping = false;

    toast.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
        isSwiping = true;
        toast.style.transition = 'none';
    }, { passive: true });

    toast.addEventListener('touchmove', (e) => {
        if (!isSwiping) return;
        const touchY = e.touches[0].clientY;
        const diffY = touchY - touchStartY;
        
        if (diffY < 0) { // Moving upwards
            toast.style.transform = `translateY(${diffY}px)`;
            toast.style.opacity = 1 + (diffY / 150);
        }
    }, { passive: true });

    toast.addEventListener('touchend', (e) => {
        if (!isSwiping) return;
        isSwiping = false;
        const touchY = e.changedTouches[0].clientY;
        const diffY = touchY - touchStartY;
        
        toast.style.transition = ''; // Restore transition
        
        if (diffY < -60) { // Threshold reached
            dismiss();
        } else {
            toast.style.transform = '';
            toast.style.opacity = '';
        }
    }, { passive: true });

    // Auto close after 3s
}

function createToastContainer() {
    let container = document.getElementById('toast-container');
    if (container) return container;
    
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
    return container;
}

/**
 * Returns the adjusted path for a given page/asset.
 * Falls back to absolute root-relative paths if ComponentLoader is not available.
 */
function resolvePath(path) {
    if (window.ComponentLoader) {
        return window.ComponentLoader.getAdjustedPath(path);
    }
    
    // Fallback logic (must be consistent with ComponentLoader.getAdjustedPath)
    const root = '/';
    if (!path || path === '#' || path === './') {
        return root + 'index.html';
    }

    if (path.startsWith('/') || path.startsWith('http') || path.startsWith('javascript:')) {
        return path;
    }

    let cleanPath = path.replace(/^\.\//, '').replace(/^\/+/, '');
    
    if (cleanPath === 'admin' || cleanPath === 'admin/') {
        cleanPath = 'pages/admin/index.html';
    }

    let query = '';
    if (cleanPath.includes('?')) {
        const parts = cleanPath.split('?');
        cleanPath = parts[0];
        query = '?' + parts[1];
    }

    if (cleanPath === 'index' || cleanPath === '404' || cleanPath === 'index.html' || cleanPath === '404.html') {
        if (!cleanPath.endsWith('.html')) cleanPath += '.html';
        return root + cleanPath + query;
    }

    if (cleanPath.startsWith('assets/')) {
        return root + 'src/' + cleanPath + query;
    }

    if (!cleanPath.startsWith('src/') && !cleanPath.startsWith('pages/')) {
        cleanPath = 'pages/' + cleanPath;
    }

    if (!cleanPath.startsWith('src/')) {
        cleanPath = 'src/' + cleanPath;
    }

    if (!cleanPath.includes('.') && !cleanPath.endsWith('/')) {
        cleanPath += '.html';
    }

    return root + cleanPath + query;
}
window.resolvePath = resolvePath;

/**
 * Debounce function to limit execution frequency.
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
window.debounce = debounce;

/**
 * SidebarManager
 * Handles sidebar collapse/expand states across all dashboards.
 */
const SidebarManager = {
    state: {
        isCollapsed: localStorage.getItem('newketSidebarCollapsed') === 'true',
        isMobile: window.innerWidth < 768
    },

    init(sidebarId, mainContentClass) {
        this.sidebarId = sidebarId;
        this.mainContentClass = mainContentClass;
        this.applyState();

        // Handle window resize
        const handleResize = debounce(() => {
            const wasMobile = this.state.isMobile;
            this.state.isMobile = window.innerWidth < 768;
            
            if (wasMobile !== this.state.isMobile) {
                this.applyState();
            }
        }, 150);

        window.addEventListener('resize', handleResize);
    },

    toggle() {
        this.state.isCollapsed = !this.state.isCollapsed;
        localStorage.setItem('newketSidebarCollapsed', this.state.isCollapsed);
        this.applyState();
    },

    applyState() {
        const sidebar = document.getElementById(this.sidebarId);
        if (!sidebar) return;

        if (this.state.isMobile) {
            sidebar.classList.remove('sidebar-collapsed');
            document.body.classList.remove('sidebar-is-collapsed');
        } else {
            if (this.state.isCollapsed) {
                sidebar.classList.add('sidebar-collapsed');
                document.body.classList.add('sidebar-is-collapsed');
            } else {
                sidebar.classList.remove('sidebar-collapsed');
                document.body.classList.remove('sidebar-is-collapsed');
            }
        }
    }
};
window.SidebarManager = SidebarManager;

/**
 * Génère les étoiles de notation.
 */
function buildStarsHTML(rating) {
    const fullStars = Math.floor(rating || 0);
    const emptyStars = 5 - fullStars;
    let html = '';
    for (let i = 0; i < fullStars; i++) {
        html += `<iconify-icon icon="solar:star-bold" width="14" style="color:#F59E0B"></iconify-icon>`;
    }
    for (let i = 0; i < emptyStars; i++) {
        html += `<iconify-icon icon="solar:star-linear" width="14" style="color:#D1D5DB"></iconify-icon>`;
    }
    return html;
}

/**
 * Builds HTML for a product card using the original CSS design.
 * Matches the design from the screenshot: white cards, badges, star ratings, Ajouter button.
 * @param {object} p - Product object.
 * @param {object} options - UI options (animationClass, delay).
 */
function buildProductCardHTML(p, options = {}) {
    const { animationClass = '', delay = '0s' } = options;
    const isFavorite = window.FavoritesManager ? FavoritesManager.isInFavorites(p.id) : false;

    // Handle image (could be comma separated) — optimize first image for thumbnails
    const images = (p.image || '').split(',');
    const rawImg = images[0].trim() || 'Images/default.png';
    const mainImg = window.getOptimizedImageUrl ? window.getOptimizedImageUrl(rawImg, { width: 400, quality: 80 }) : rawImg;
    const fallbackImg = '/src/assets/Images/default.png';

    // Format price
    const priceDisplay = window.CurrencyManager ? CurrencyManager.formatPrice(p.price) : `${(p.price || 0).toLocaleString()} FC`;
    const oldPrice = p.oldPrice || p.old_price;
    const oldPriceDisplay = oldPrice ? (window.CurrencyManager ? CurrencyManager.formatPrice(oldPrice) : `${oldPrice.toLocaleString()} FC`) : null;

    // Badge
    let badgeHTML = '';
    const isNew = p.isNew || p.is_new;
    const isPromo = p.isPromo || p.is_promo;

    if (isNew) {
        badgeHTML = `<span class="badge badge-new"><iconify-icon icon="solar:star-bold" width="10"></iconify-icon> NOUVEAU</span>`;
    } else if (isPromo) {
        badgeHTML = `<span class="badge badge-sale"><iconify-icon icon="solar:fire-bold" width="10"></iconify-icon> PROMO</span>`;
    }

    // Stars
    const starsHTML = buildStarsHTML(p.rating || 4.5);
    const reviewCount = p.reviews || 0;

    // ✅ LAZY LOADING: On utilise data-src + une couleur de fond en attendant
    //    L'IntersectionObserver (initLazyImages) switche data-src vers src
    //    uniquement quand la carte entre dans le viewport.
    return `
        <div class="product-card card-active-scale ${animationClass}" style="animation-delay: ${delay};" data-product-id="${p.id}" data-category="${p.category || ''}">
            <div class="product-image">
                ${badgeHTML}
                <button onclick="addToWishlist('${p.id}', event)" 
                    class="wishlist-btn btn-active-scale ${isFavorite ? 'active' : ''}" 
                    aria-label="${isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}"
                    title="${isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
                    <iconify-icon icon="${isFavorite ? 'solar:heart-bold' : 'solar:heart-linear'}" width="18" style="color: ${isFavorite ? '#ef4444' : '#6b7280'}"></iconify-icon>
                </button>
                <a href="${resolvePath('pages/product')}?id=${p.id}">
                    <img
                        data-src="${mainImg}"
                        src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E"
                        alt="${p.name}"
                        loading="lazy"
                        class="lazy-img"
                        style="background:#f3f4f6; transition: opacity 0.3s ease;"
                        onerror="this.src='${fallbackImg}'"
                    >
                </a>
            </div>
            <div class="product-info">
                <div class="product-cat">${p.category || ''}</div>
                <div class="product-vendor" style="display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
                    <div style="width: 18px; height: 18px; border-radius: 50%; background: #f3f4f6; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-center;">
                        ${(Array.isArray(p.users) ? p.users[0] : p.users)?.avatar 
                            ? `<img data-src="${(Array.isArray(p.users) ? p.users[0] : p.users).avatar}" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E" alt="Avatar Vendeur" class="lazy-img" style="width: 100%; height: 100%; object-cover">` 
                            : `<iconify-icon icon="solar:shop-bold" style="font-size: 10px; color: #9ca3af; margin: auto;"></iconify-icon>`
                        }
                    </div>
                    <span>Vendu par : ${ 
                        (Array.isArray(p.users) ? p.users[0] : p.users)?.company_name || 
                        (Array.isArray(p.users) ? p.users[0] : p.users)?.name || 
                        'NewKet Shop' 
                    }</span>
                </div>
                <h3 class="product-title">
                    <a href="${resolvePath('pages/product')}?id=${p.id}">${p.name}</a>
                </h3>
                <div class="product-rating">
                    ${starsHTML}
                    <span>(${reviewCount})</span>
                </div>
                <div class="product-price">
                    <span class="current-price" data-price-cdf="${p.price}">${priceDisplay}</span>
                    ${oldPriceDisplay ? `<span class="old-price">${oldPriceDisplay}</span>` : ''}
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-top: auto; padding-top: 2px;">
                    <button 
                        onclick="if(window.initCheckout) window.initCheckout('${p.id}', this)"
                        class="flex-1 btn-active-scale bg-green-600 hover:bg-green-700 text-white py-2 sm:py-2.5 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 sm:gap-2 shadow-sm hover:shadow-md"
                        style="border:none; cursor:pointer; min-width: 0;"
                        aria-label="Acheter ${p.name.replace(/"/g, '&quot;')}"
                        data-product-id="${p.id}">
                        <iconify-icon icon="solar:cart-large-bold" width="14" class="flex-shrink-0 sm:w-4"></iconify-icon>
                        <span class="truncate">Acheter</span>
                    </button>
                    <button onclick="if(navigator.share){ navigator.share({title:'${p.name.replace(/'/g, "\\'")} — NewKet', url: window.location.origin + resolvePath('pages/product') + '?id=${p.id}'}); } else { navigator.clipboard.writeText(window.location.origin + resolvePath('pages/product') + '?id=${p.id}'); if(window.showToast) showToast('Lien copié !', 'info'); }"
                        style="width:40px; height:40px; border-radius:10px; border:1px solid #e5e7eb; display:flex; align-items:center; justify-content:center; color:#6b7280; background:white; cursor:pointer; flex-shrink:0; transition: all 0.2s ease;"
                        onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='white'"
                        aria-label="Partager ce produit"
                        title="Partager">
                        <iconify-icon icon="solar:share-linear" width="16"></iconify-icon>
                    </button>
                </div>
            </div>
        </div>
    `;
}



/**
 * Builds Skeleton cards for loading states.
 */
function buildSkeletonCardHTML(count = 5) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="skeleton-card">
                <div class="skeleton skeleton-shimmer skeleton-image"></div>
                <div class="skeleton skeleton-shimmer skeleton-text" style="width: 30%"></div>
                <div class="skeleton skeleton-shimmer skeleton-text" style="width: 50%"></div>
                <div class="skeleton skeleton-shimmer skeleton-title"></div>
                <div class="skeleton skeleton-shimmer skeleton-text" style="width: 40%"></div>
                <div class="skeleton skeleton-shimmer skeleton-price"></div>
                <div class="skeleton skeleton-shimmer skeleton-button"></div>
            </div>
        `;
    }
    return html;
}

/**
 * Builds Skeleton for Dashboard Statistics Grid.
 */
function buildSkeletonDashboardStatsHTML(count = 4) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="skeleton-stat-card">
                <div class="skeleton" style="width: 40px; height: 40px; border-radius: 12px; margin-bottom: 1rem;"></div>
                <div class="skeleton skeleton-text" style="width: 60%; margin-bottom: 0.5rem;"></div>
                <div class="skeleton skeleton-title" style="width: 40%;"></div>
            </div>
        `;
    }
    return html;
}

/**
 * Builds Skeleton for Activity Feed.
 */
function buildSkeletonActivityHTML(count = 3) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="flex items-start gap-4 p-3">
                <div class="skeleton skeleton-avatar flex-shrink-0"></div>
                <div class="flex-1">
                    <div class="skeleton skeleton-text" style="width: 80%; margin-bottom: 0.5rem;"></div>
                    <div class="skeleton skeleton-text" style="width: 30%; height: 10px;"></div>
                </div>
            </div>
        `;
    }
    return html;
}

/**
 * Builds Skeleton for Notifications list.
 */
function buildSkeletonNotificationHTML(count = 4) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="glass-card p-5 animate-pulse flex gap-4 opacity-60">
                <style>
                    @keyframes shimmer {
                        0% { background-position: -200% 0; }
                        100% { background-position: 200% 0; }
                    }
                    .skeleton-shimmer {
                        background: linear-gradient(90deg, #f1f5f9 25%, #f8fafc 50%, #f1f5f9 75%);
                        background-size: 200% 100%;
                        animation: shimmer 1.5s infinite linear;
                        border-radius: 0.5rem;
                    }
                </style>
                <div class="w-12 h-12 rounded-2xl skeleton-shimmer flex-shrink-0"></div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-2">
                        <div class="h-4 w-32 skeleton-shimmer"></div>
                        <div class="h-3 w-16 skeleton-shimmer"></div>
                    </div>
                    <div class="h-3 w-full skeleton-shimmer mb-2"></div>
                    <div class="h-3 w-2/3 skeleton-shimmer"></div>
                </div>
            </div>
        `;
    }
    return html;
}

/**
 * Optimizes an image URL from Supabase storage (or passes it through).
 */
/**
 * Optimizes an image URL from Supabase storage (or passes it through).
 * Also handles comma-separated image strings by taking the first one.
 */
function getOptimizedImageUrl(url, opts = { width: 400, quality: 80 }) {
    if (!url) return '/src/assets/Images/default.png';
    
    // Handle comma-separated list of images
    const images = url.split(',');
    const firstImg = (images[0] || '').trim();
    
    if (!firstImg || firstImg === 'Images/default.png') {
        return '/src/assets/Images/default.png';
    }

    // If it's a local preview (Data URL) return it as is
    if (firstImg.startsWith('data:') || firstImg.startsWith('blob:')) {
        return firstImg;
    }

    // Handle relative local paths (Images/...)
    if (firstImg.startsWith('Images/')) {
        return '/src/assets/' + firstImg;
    }

    // Only transform Supabase storage URLs
    if (!firstImg.includes('supabase.co/storage')) return firstImg;
    
    const params = new URLSearchParams();
    if (opts.width) params.set('width', opts.width);
    if (opts.quality) params.set('quality', opts.quality);
    
    // Avoid duplicating params if already present
    if (firstImg.includes('width=') || firstImg.includes('quality=')) return firstImg;
    
    return `${firstImg}${firstImg.includes('?') ? '&' : '?'}${params.toString()}`;
}


/**
 * Load Leaflet dynamically
 */
async function loadLeaflet() {
    if (window.L) return;
    
    return new Promise((resolve, reject) => {
        if (!document.getElementById('leaflet-css')) {
            const link = document.createElement('link');
            link.id = 'leaflet-css';
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        }
        
        const existingScript = document.getElementById('leaflet-js');
        if (!existingScript) {
            const script = document.createElement('script');
            script.id = 'leaflet-js';
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        } else {
            existingScript.addEventListener('load', resolve);
            existingScript.addEventListener('error', reject);
        }
    });
}

/**
 * Shows a checkout modal to collect customer details before payment.
 * Returns a Promise that resolves to { phone, name, city, lat, lng } or null if cancelled.
 */
function showCheckoutModal(productName, productPrice) {
    return new Promise(async (resolve) => {
        // Ensure Leaflet is loaded
        try {
            await loadLeaflet();
        } catch (err) {
            console.error("Erreur chargement Leaflet", err);
        }

        const modalId = 'checkout-modal-' + Date.now();
        const priceStr = window.CurrencyManager ? window.CurrencyManager.formatPrice(productPrice) : `${productPrice.toLocaleString()} FC`;
        
        const modalHtml = `
            <div id="${modalId}" class="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 opacity-0 transition-opacity duration-300">
                <div class="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onclick="closeCheckoutModal('${modalId}', null)"></div>
                
                <div class="relative w-full max-w-md max-h-[95vh] sm:max-h-[90vh] flex flex-col bg-white rounded-3xl shadow-2xl overflow-hidden transform scale-95 transition-transform duration-300">
                    <!-- Header -->
                    <div class="px-5 py-3.5 sm:px-6 sm:py-5 border-b border-gray-100 flex items-center justify-between bg-white flex-shrink-0">
                        <div class="pr-4">
                            <h3 class="text-base sm:text-lg font-bold text-gray-900 leading-tight">Finaliser la commande</h3>
                            <p class="text-[11px] sm:text-sm text-gray-500 mt-0.5 truncate max-w-[180px] sm:max-w-[250px] font-medium">${productName}</p>
                        </div>
                        <button onclick="closeCheckoutModal('${modalId}', null)" class="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all flex-shrink-0 group">
                            <iconify-icon icon="solar:close-circle-bold" width="22" class="group-hover:rotate-90 transition-transform duration-300"></iconify-icon>
                        </button>
                    </div>

                    <!-- Body -->
                    <div class="px-5 py-4 sm:px-6 sm:py-5 space-y-4 overflow-y-auto flex-1">
                        <div class="bg-indigo-50/50 p-4 rounded-2xl flex items-center justify-between mb-2 border border-indigo-100/50">
                            <span class="text-sm font-semibold text-indigo-900">Total à payer</span>
                            <span class="text-xl font-black text-indigo-600">${priceStr}</span>
                        </div>

                        <div>
                            <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Informations de livraison</label>
                            
                            <div class="space-y-3">
                                <div class="relative group">
                                    <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                        <iconify-icon icon="solar:user-bold" width="18"></iconify-icon>
                                    </div>
                                    <input type="text" id="${modalId}-name" placeholder="Nom complet" required 
                                        class="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white outline-none transition-all placeholder:text-gray-400 font-medium">
                                </div>

                                <div class="relative group">
                                    <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                        <iconify-icon icon="solar:phone-bold" width="18"></iconify-icon>
                                    </div>
                                    <input type="tel" id="${modalId}-phone" placeholder="Numéro de tél. (ex: 070707...)" required 
                                        class="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white outline-none transition-all placeholder:text-gray-400 font-medium">
                                </div>

                                <div class="relative group">
                                    <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                        <iconify-icon icon="solar:letter-bold" width="18"></iconify-icon>
                                    </div>
                                    <input type="email" id="${modalId}-email" value="${localStorage.getItem('newketUserEmail') || ''}" placeholder="Adresse Email" required 
                                        class="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white outline-none transition-all placeholder:text-gray-400 font-medium">
                                </div>

                                <div class="relative group">
                                    <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                        <iconify-icon icon="solar:map-point-bold" width="18"></iconify-icon>
                                    </div>
                                    <input type="text" id="${modalId}-city" value="Kinshasa" placeholder="Ville" required 
                                        class="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white outline-none transition-all placeholder:text-gray-400 font-medium">
                                </div>
                            </div>
                            
                            <!-- Leaflet Map Setup -->
                            <div class="mt-4 pt-4 border-t border-gray-100">
                                <div class="flex items-center justify-between mb-2.5">
                                    <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider">Position de livraison</label>
                                    <div id="${modalId}-loc-badge" class="hidden px-2 py-0.5 bg-green-100 text-green-700 text-[9px] font-bold rounded-full uppercase tracking-tighter animate-pulse">Position capturée</div>
                                </div>
                                <p class="text-[10px] text-gray-400 mb-3 leading-snug">Touchez le bouton ou l'icône sur la carte pour une détection GPS précise.</p>
                                
                                <!-- Locate Me Button -->
                                <button type="button" id="${modalId}-locate-btn" onclick="window._locateMe && window._locateMe('${modalId}')"
                                    class="w-full mb-3 px-4 py-3 bg-gradient-to-br from-indigo-600 via-indigo-600 to-purple-600 text-white font-bold rounded-2xl text-sm hover:shadow-lg hover:shadow-indigo-500/30 transition-all flex items-center justify-center gap-3 active:scale-[0.97] border border-white/10 ring-1 ring-indigo-400/20">
                                    <iconify-icon icon="solar:map-arrow-square-bold" width="20"></iconify-icon>
                                    <span id="${modalId}-locate-text">Me localiser maintenant</span>
                                </button>
                                
                                <div id="${modalId}-map" class="w-full h-36 sm:h-44 rounded-2xl border border-gray-100 overflow-hidden z-10 shadow-sm block relative">
                                    <!-- Locate overlay on map corner -->
                                    <button type="button" id="${modalId}-map-locate-btn" onclick="window._locateMe && window._locateMe('${modalId}')"
                                        style="position:absolute; top:10px; right:10px; z-index:1000; width:40px; height:40px; background:white; border:none; border-radius:12px; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);"
                                        onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 16px rgba(99, 102, 241, 0.25)';"
                                        onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)';"
                                        title="Position GPS">
                                        <iconify-icon icon="solar:map-arrow-square-bold" width="22" style="color:#6366f1"></iconify-icon>
                                    </button>
                                </div>
                                
                                <!-- Location status text -->
                                <div id="${modalId}-loc-status" class="text-[10px] text-gray-500 mt-2.5 px-3 py-2 bg-gray-50 rounded-xl leading-tight flex items-center gap-2 min-h-[16px] break-words border border-gray-100">
                                    <iconify-icon icon="solar:info-circle-bold" width="14" class="text-gray-400"></iconify-icon>
                                    <span>Prêt pour la localisation</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="px-5 py-4 sm:px-6 sm:py-5 border-t border-gray-50 bg-gray-50 flex gap-3 flex-shrink-0">
                        <button onclick="closeCheckoutModal('${modalId}', null)" class="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm">
                            Annuler
                        </button>
                        <button onclick="submitCheckoutModal('${modalId}')" class="flex-1 px-4 py-3 bg-green-600 text-white font-bold rounded-xl text-sm hover:bg-green-700 transition-colors shadow-sm shadow-green-600/30 flex items-center justify-center gap-2">
                            <iconify-icon icon="solar:card-bold" width="18"></iconify-icon>
                            Payer
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modalEl = document.getElementById(modalId);
        
        // Init Leaflet map if loaded
        let marker = null;
        let selectedLat = null;
        let selectedLng = null;
        
        requestAnimationFrame(() => {
            modalEl.classList.remove('opacity-0');
            modalEl.querySelector('.transform').classList.remove('scale-95');
            
            // Allow modal transition to finish before init map (fixes grey boxes issue in Leaflet)
            setTimeout(() => {
                const mapContainer = document.getElementById(`${modalId}-map`);
                if (window.L && mapContainer) {
                    // Kinshasa default center: -4.4419, 15.2663
                    const map = L.map(mapContainer).setView([-4.4419, 15.2663], 12);
                    
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        maxZoom: 18,
                        attribution: '© OpenStreetMap'
                    }).addTo(map);

                    marker = L.marker([-4.4419, 15.2663], { draggable: true }).addTo(map);

                    // Realign map after render
                    map.invalidateSize();

                    marker.on('dragend', function(e) {
                        const position = marker.getLatLng();
                        selectedLat = position.lat;
                        selectedLng = position.lng;
                        // Update status text
                        const statusEl = document.getElementById(`${modalId}-loc-status`);
                        if (statusEl) {
                            statusEl.innerHTML = `<iconify-icon icon="solar:map-point-bold" width="12" style="color:#22c55e"></iconify-icon> <span style="color:#22c55e; font-weight:700;">Position ajustée manuellement</span>`;
                        }
                    });

                    // Store map reference for _locateMe
                    window._checkoutMapRef = map;
                    window._checkoutMarkerRef = marker;
                }
            }, 300);

            // ===== GEOLOCATION: "Me localiser" button logic =====
            window._locateMe = (id) => {
                if (id !== modalId) return;
                
                const locateBtn = document.getElementById(`${id}-locate-btn`);
                const mapLocateBtn = document.getElementById(`${id}-map-locate-btn`);
                const statusEl = document.getElementById(`${id}-loc-status`);
                const badgeEl = document.getElementById(`${id}-loc-badge`);

                // Check browser support
                if (!navigator.geolocation) {
                    if (statusEl) {
                        statusEl.innerHTML = `
                            <iconify-icon icon="solar:danger-triangle-bold" width="14" class="text-red-500"></iconify-icon>
                            <span class="text-red-600 font-medium">Géolocalisation non supportée par votre navigateur</span>
                        `;
                    }
                    showToast('Votre navigateur ne supporte pas la géolocalisation', 'warning');
                    return;
                }

                // Helper to update status UI
                const updateStatusUI = (msg, isError = false) => {
                    if (statusEl) {
                        statusEl.innerHTML = `
                            <iconify-icon icon="${isError ? 'solar:danger-circle-bold' : 'solar:info-circle-bold'}" width="14" class="${isError ? 'text-red-500' : 'text-indigo-500'}"></iconify-icon>
                            <span class="${isError ? 'text-red-600' : 'text-gray-700'} font-medium">${msg}</span>
                        `;
                        statusEl.classList.toggle('bg-red-50', isError);
                        statusEl.classList.toggle('border-red-100', isError);
                    }
                };

                // Show loading state
                updateStatusUI("Recherche de votre position GPS...");
                if (locateBtn) {
                    locateBtn.disabled = true;
                    locateBtn.innerHTML = `<iconify-icon icon="line-md:loading-twotone-loop" width="20"></iconify-icon> <span>Localisation...</span>`;
                }
                if (badgeEl) badgeEl.classList.add('hidden');

                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const { latitude, longitude, accuracy } = position.coords;
                        selectedLat = latitude;
                        selectedLng = longitude;

                        // Move map & marker
                        if (window._checkoutMapRef && window._checkoutMarkerRef) {
                            const newPos = [latitude, longitude];
                            window._checkoutMarkerRef.setLatLng(newPos);
                            window._checkoutMapRef.setView(newPos, 16, { animate: true });
                            window._checkoutMapRef.invalidateSize();
                        }

                        // Success UI feedback
                        updateStatusUI(`Position détectée (Précision: ±${Math.round(accuracy)}m).`);
                        if (badgeEl) badgeEl.classList.remove('hidden');

                        if (locateBtn) {
                            locateBtn.disabled = false;
                            locateBtn.innerHTML = `<iconify-icon icon="solar:check-read-linear" width="20"></iconify-icon> <span>Position trouvée !</span>`;
                            locateBtn.classList.replace('from-indigo-600', 'from-green-600');
                            
                            setTimeout(() => {
                                locateBtn.innerHTML = `<iconify-icon icon="solar:map-arrow-square-bold" width="20"></iconify-icon> <span>Mettre à jour la position</span>`;
                                locateBtn.classList.replace('from-green-600', 'from-indigo-600');
                            }, 3000);
                        }

                        showToast('Position GPS détectée !', 'success');
                    },
                    (error) => {
                        console.error("Geolocation error:", error);
                        let errorMsg = 'Impossible de vous localiser.';
                        if (error.code === 1) errorMsg = 'Permission refusée. Veuillez activer le GPS.';
                        else if (error.code === 2) errorMsg = 'Position non disponible.';
                        
                        updateStatusUI(errorMsg, true);
                        
                        if (locateBtn) {
                            locateBtn.disabled = false;
                            locateBtn.innerHTML = `<iconify-icon icon="solar:map-arrow-square-bold" width="20"></iconify-icon> <span>Réessayer</span>`;
                        }
                        showToast(errorMsg, 'warning');
                    },
                    {
                        enableHighAccuracy: true,
                        // No timeout per user request
                        maximumAge: 10000
                    }
                );
            };
        });


        // Global handlers for this specific modal instance
        window.closeCheckoutModal = (id, result) => {
            if (id !== modalId) return;
            modalEl.classList.add('opacity-0');
            modalEl.querySelector('.transform').classList.add('scale-95');
            setTimeout(() => {
                modalEl.remove();
                delete window.closeCheckoutModal;
                delete window.submitCheckoutModal;
                delete window._locateMe;
                delete window._checkoutMapRef;
                delete window._checkoutMarkerRef;
                resolve(result);
            }, 300);
        };

        window.submitCheckoutModal = (id) => {
            if (id !== modalId) return;
            const name = document.getElementById(`${id}-name`).value.trim();
            const phone = document.getElementById(`${id}-phone`).value.trim();
            const email = document.getElementById(`${id}-email`).value.trim();
            const city = document.getElementById(`${id}-city`).value.trim();

            if (!phone) {
                showToast("Le numéro de téléphone est obligatoire", "warning");
                return;
            }
            
            if (!email) {
                showToast("L'adresse email est obligatoire", "warning");
                return;
            }

            window.closeCheckoutModal(id, { 
                name: name || "Client Web", 
                phone, 
                email, 
                city: city || "Kinshasa",
                lat: selectedLat,
                lng: selectedLng
            });
        };
    });
}

/**
 * High-visibility announcement modal for admin broadcasts.
 * Anchored to the top-center, following the platform-wide notification pattern.
 */
window.showAnnouncementModal = (title, message, type = 'info', force = false) => {
    // Check if showing one already
    if (document.getElementById('nk-announcement-modal')) return;
    
    // Check if user has already dismissed this specific announcement in this session
    // (only applies to non-forced calls — broadcasts always shown)
    if (!force && sessionStorage.getItem(`dismissed_${title}`)) return;


    const modal = document.createElement('div');
    modal.id = 'nk-announcement-modal';
    // Positioned at the top center, full width on mobile, max-width on larger screens
    modal.className = 'fixed top-0 left-0 right-0 z-[9999] flex justify-center p-4 sm:p-6 pointer-events-none animate-fade-in-down';
    
    // UI mapping
    const configs = {
        'info': { icon: 'solar:bell-bing-bold', color: 'text-blue-600', bg: 'bg-blue-50' },
        'success': { icon: 'solar:check-circle-bold', color: 'text-green-600', bg: 'bg-green-50' },
        'warning': { icon: 'solar:danger-triangle-bold', color: 'text-amber-600', bg: 'bg-amber-50' },
        'danger': { icon: 'solar:fire-bold', color: 'text-red-600', bg: 'bg-red-50' }
    };
    const config = configs[type] || configs.info;

    modal.innerHTML = `
        <div class="bg-white/90 backdrop-blur-xl rounded-[2.5rem] overflow-hidden shadow-2xl max-w-lg w-full pointer-events-auto border border-white/20 transform transition-all duration-500 ease-out">
            <!-- Premium Accent Top Gradient -->
            <div class="h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

            <div class="p-8 sm:p-10">
                <div class="flex flex-col items-center text-center">
                    <div class="w-20 h-20 rounded-3xl ${config.bg} flex items-center justify-center mb-6 shadow-inner">
                        <iconify-icon icon="${config.icon}" class="${config.color}" style="font-size: 48px;"></iconify-icon>
                    </div>
                    
                    <h2 class="text-2xl sm:text-3xl font-black text-gray-900 mb-4 leading-tight">${title}</h2>
                    
                    <div class="text-gray-600 text-base sm:text-lg leading-relaxed mb-8 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                        ${message.replace(/\n/g, '<br>')}
                    </div>

                    <div class="w-full flex flex-col sm:flex-row gap-3">
                        <button onclick="window.dismissAnnouncement('${title}')" class="flex-1 px-8 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all active:scale-95">
                            Ne plus afficher
                        </button>
                        <button onclick="document.getElementById('nk-announcement-modal').remove()" class="flex-[2] px-8 py-4 bg-gray-900 text-white font-bold rounded-2xl hover:shadow-xl hover:shadow-gray-900/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                            Compris
                            <iconify-icon icon="solar:arrow-right-up-bold" width="18"></iconify-icon>
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Close Icon (Top Corner) -->
            <button onclick="document.getElementById('nk-announcement-modal').remove()" class="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-2xl bg-white/50 hover:bg-white text-gray-400 hover:text-gray-900 transition-all">
                <iconify-icon icon="solar:close-circle-bold" width="24"></iconify-icon>
            </button>
        </div>
    `;

    document.body.appendChild(modal);
    
    window.dismissAnnouncement = (title) => {
        sessionStorage.setItem(`dismissed_${title}`, 'true');
        document.getElementById('nk-announcement-modal')?.remove();
    };
};
window.showAnnouncementModal = showAnnouncementModal;

/**
 * Premium confirmation modal replacement for window.confirm()
 * @param {string} title Modal title
 * @param {string} message Modal body text
 * @param {function} onConfirm Callback when confirmed
 * @param {function} onCancel Optional callback when cancelled
 */
window.showConfirm = (title, message, onConfirm, onCancel = null) => {
    const modalId = 'nk-confirm-modal-' + Date.now();
    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 opacity-0 transition-opacity duration-300 pointer-events-none';
    
    modal.innerHTML = `
        <div class="absolute inset-0 bg-gray-950/40 backdrop-blur-sm" onclick="window.closeConfirm('${modalId}', false)"></div>
        <div class="relative bg-white/95 backdrop-blur-xl rounded-[2.5rem] shadow-2xl max-w-sm w-full border border-white/20 transform scale-95 transition-all duration-300 pointer-events-auto">
            <div class="p-8 text-center">
                <div class="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-6">
                    <iconify-icon icon="solar:question-square-bold" class="text-orange-500 text-3xl"></iconify-icon>
                </div>
                <h3 class="text-xl font-black text-gray-900 mb-2">${title}</h3>
                <p class="text-sm text-gray-500 font-medium leading-relaxed mb-8">${message}</p>
                
                <div class="flex gap-3">
                    <button onclick="window.closeConfirm('${modalId}', false)" class="flex-1 px-6 py-3.5 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all active:scale-95">
                        Annuler
                    </button>
                    <button onclick="window.closeConfirm('${modalId}', true)" class="flex-1 px-6 py-3.5 bg-gray-900 text-white font-bold rounded-2xl hover:shadow-xl hover:shadow-gray-900/20 transition-all active:scale-95">
                        Confirmer
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    
    // Animate in
    setTimeout(() => {
        modal.classList.remove('opacity-0', 'pointer-events-none');
        modal.querySelector('.transform').classList.remove('scale-95');
    }, 10);

    window.closeConfirm = (id, result) => {
        const modalEl = document.getElementById(id);
        if (!modalEl) return;
        
        modalEl.classList.add('opacity-0');
        modalEl.querySelector('.transform').classList.add('scale-95');
        
        setTimeout(() => {
            modalEl.remove();
            if (result && typeof onConfirm === 'function') onConfirm();
            else if (!result && typeof onCancel === 'function') onCancel();
        }, 300);
    };
};

/**
 * Initiates the checkout process via Flutterwave
 */
window.initCheckout = async (productId, btnElement) => {
    let originalHtml = '';
    try {
        originalHtml = btnElement.innerHTML;
        btnElement.innerHTML = '<iconify-icon icon="line-md:loading-twotone-loop" width="16"></iconify-icon>...';
        btnElement.disabled = true;
        
        const p = window.ProductManager.getProduct(productId) || await window.ProductManager.fetchProductById(productId);
        if(!p) {
            showToast('Produit introuvable', 'error');
            btnElement.innerHTML = originalHtml;
            btnElement.disabled = false;
            return;
        }

        // Show a quick modal to collect customer info (Phone & City & Email for Flutterwave)
        const customerInfo = await showCheckoutModal(p.name, p.price);
        if (!customerInfo) {
            btnElement.innerHTML = originalHtml;
            btnElement.disabled = false;
            return; // Cancelled
        }

        const { name: customerName, phone: customerPhone, city: customerCity, email: customerEmail, lat: customerLat, lng: customerLng } = customerInfo;

        // Vérifier que l'utilisateur est connecté avant de payer
        if (window.SupabaseAdapter) {
            const session = await window.SupabaseAdapter.getSession(3000);
            if (!session?.access_token) {
                showToast('Vous devez être connecté pour passer une commande.', 'warning');
                btnElement.innerHTML = originalHtml;
                btnElement.disabled = false;
                return;
            }
        }

        // Appeler le backend via ApiClient (injecte automatiquement le token JWT)
        const data = await window.ApiClient.post('/payments/initiate', {
            product_id: p.id,
            vendor_id: p.user_id,
            amount: p.price,
            customer_phone: customerPhone,
            customer_name: customerName,
            customer_city: customerCity,
            customer_email: customerEmail || 'client@newket.cd',
            customer_lat: customerLat,
            customer_lng: customerLng
        });
        
        if (!data.success) {
            showToast(data.error || "Erreur lors de l'initialisation du paiement", "error");
            btnElement.innerHTML = originalHtml;
            btnElement.disabled = false;
            return;
        }

        // Rediriger vers le lien de paiement Flutterwave généré par le backend
        if (data.payment_url) {
            window.location.href = data.payment_url;
        } else {
             showToast("Lien de paiement non reçu", "error");
             btnElement.innerHTML = originalHtml;
             btnElement.disabled = false;
        }

    } catch (err) {
        console.error('[NewKet] Checkout error:', err);
        showToast("Erreur lors de l'ouverture du paiement.", "error");
        btnElement.innerHTML = originalHtml;
        btnElement.disabled = false;
    }
};

/**
 * ✅ LAZY LOADING via IntersectionObserver
 * 
 * À appeler après chaque inject de cartes HTML dans le DOM.
 * uniquement quand ils entrent dans le viewport (économise 60%+ de bande passante).
 * 
 * Utilise le native loading="lazy" + IntersectionObserver comme double filet:
 * - loading="lazy" est natif et efficace sur la plupart des navigateurs.
 * - IntersectionObserver contrôle plus finement l'animation de fondu.
 */
let _lazyObserver = null;

function initLazyImages(root = document) {
    const lazyImages = root.querySelectorAll('img.lazy-img[data-src]');
    if (!lazyImages.length) return;

    // If browser supports IntersectionObserver, use it for the fade effect
    if ('IntersectionObserver' in window) {
        // Create or reuse a single observer for the page
        if (!_lazyObserver) {
            _lazyObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;

                    const img = entry.target;
                    const src = img.dataset.src;
                    if (!src) return;

                    // Swap the src
                    img.src = src;
                    img.style.opacity = '0';

                    img.onload = () => {
                        img.style.opacity = '1';
                        img.removeAttribute('data-src');
                    };
                    img.onerror = () => {
                        img.style.opacity = '1';
                        img.removeAttribute('data-src');
                    };

                    _lazyObserver.unobserve(img);
                });
            }, {
                rootMargin: '200px 0px',   // Commence à charger 200px avant l'entrée dans le viewport
                threshold: 0.01
            });
        }

        lazyImages.forEach(img => _lazyObserver.observe(img));
    } else {
        // Fallback: load all immediately (rare, old browsers)
        lazyImages.forEach(img => {
            if (img.dataset.src) {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
            }
        });
    }
}

window.showToast = showToast;
window.debounce = debounce;
window.buildProductCardHTML = buildProductCardHTML;
window.buildSkeletonCardHTML = buildSkeletonCardHTML;
window.buildSkeletonDashboardStatsHTML = buildSkeletonDashboardStatsHTML;
window.buildSkeletonActivityHTML = buildSkeletonActivityHTML;
window.buildSkeletonNotificationHTML = buildSkeletonNotificationHTML;
window.buildStarsHTML = buildStarsHTML;
window.getOptimizedImageUrl = getOptimizedImageUrl;
window.initLazyImages = initLazyImages;

