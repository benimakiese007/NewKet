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
    autoCloseTimer = setTimeout(dismiss, 3000);
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
 * Returns the relative path to the project root.
 * Re-added because it was used in previous logic.
 */
function getRootPath() {
    const pathname = window.location.pathname;
    const parts = pathname.split('/').filter(p => p !== '');
    let depth = 0;
    
    const rIndex = parts.lastIndexOf('pages');
    if (rIndex !== -1) {
        depth = parts.length - rIndex - 1;
    } else {
        const srcIndex = parts.lastIndexOf('src');
        if (srcIndex !== -1 && !pathname.includes('index')) {
            depth = parts.length - srcIndex - 1;
        }
    }

    let prefix = '';
    for(let i=0; i<depth; i++) {
        prefix += '../';
    }
    
    return prefix;
}

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
    const fallbackImg = getRootPath() + 'assets/Images/default.png';

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
                <a href="${getRootPath()}pages/product?id=${p.id}">
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
                    <a href="${getRootPath()}pages/product?id=${p.id}">${p.name}</a>
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
                    <button onclick="if(navigator.share){ navigator.share({title:'${p.name.replace(/'/g, "\\'")} — NewKet', url: window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1) + '${getRootPath()}pages/product?id=${p.id}'}); } else { navigator.clipboard.writeText(window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1) + '${getRootPath()}pages/product?id=${p.id}'); if(window.showToast) showToast('Lien copié !', 'info'); }"
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
    if (!url) return getRootPath() + 'assets/Images/default.png';
    
    // Handle comma-separated list of images
    const images = url.split(',');
    const firstImg = (images[0] || '').trim();
    
    if (!firstImg || firstImg === 'Images/default.png') {
        return getRootPath() + 'assets/Images/default.png';
    }

    // If it's a local preview (Data URL) return it as is
    if (firstImg.startsWith('data:') || firstImg.startsWith('blob:')) {
        return firstImg;
    }

    // Handle relative local paths (Images/...)
    if (firstImg.startsWith('Images/')) {
        return getRootPath() + 'assets/' + firstImg;
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
 * Enregistre un clic WhatsApp (Lead) dans la base de données.
 */
async function recordLead(productId, vendorId, productName) {
    try {
        const client = window.SupabaseAdapter.getClient();
        if (!client) return;

        const { data: userData } = await client.auth.getUser();
        const user = userData?.user;

        await client.from('whatsapp_clicks').insert({
            product_id: productId,
            vendor_id: vendorId,
            user_id: user?.id || null,
            metadata: {
                product_name: productName,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent
            }
        });
        
        console.log('[NewKet] Click (Lead) recorded:', productId);
    } catch (err) {
        console.error('[NewKet] Failed to record lead:', err);
    }
}

/**
 * Shows a checkout modal to collect customer details before payment.
 * Returns a Promise that resolves to { phone, name, city } or null if cancelled.
 */
function showCheckoutModal(productName, productPrice) {
    return new Promise((resolve) => {
        const modalId = 'checkout-modal-' + Date.now();
        const priceStr = window.CurrencyManager ? window.CurrencyManager.formatPrice(productPrice) : `${productPrice.toLocaleString()} FC`;
        
        const modalHtml = `
            <div id="${modalId}" class="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 opacity-0 transition-opacity duration-300">
                <div class="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onclick="closeCheckoutModal('${modalId}', null)"></div>
                
                <div class="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden transform scale-95 transition-transform duration-300">
                    <!-- Header -->
                    <div class="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
                        <div class="pr-4">
                            <h3 class="text-lg font-bold text-gray-900">Finaliser la commande</h3>
                            <p class="text-sm text-gray-500 mt-1 truncate max-w-[200px] sm:max-w-[250px]">${productName}</p>
                        </div>
                        <button onclick="closeCheckoutModal('${modalId}', null)" class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors flex-shrink-0">
                            <iconify-icon icon="solar:close-circle-bold" width="20"></iconify-icon>
                        </button>
                    </div>

                    <!-- Body -->
                    <div class="px-6 py-5 space-y-4">
                        <div class="bg-indigo-50/50 p-4 rounded-2xl flex items-center justify-between mb-2 border border-indigo-100/50">
                            <span class="text-sm font-semibold text-indigo-900">Total à payer</span>
                            <span class="text-xl font-black text-indigo-600">${priceStr}</span>
                        </div>

                        <div>
                            <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Informations de livraison</label>
                            
                            <div class="space-y-3">
                                <div class="relative group">
                                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                        <iconify-icon icon="solar:user-bold" width="18"></iconify-icon>
                                    </div>
                                    <input type="text" id="${modalId}-name" placeholder="Nom complet" required 
                                        class="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white outline-none transition-all placeholder:text-gray-400 font-medium">
                                </div>

                                <div class="relative group">
                                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                        <iconify-icon icon="solar:phone-bold" width="18"></iconify-icon>
                                    </div>
                                    <input type="tel" id="${modalId}-phone" placeholder="Numéro de tél. (ex: 070707...)" required 
                                        class="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white outline-none transition-all placeholder:text-gray-400 font-medium">
                                </div>

                                <div class="relative group">
                                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                        <iconify-icon icon="solar:map-point-bold" width="18"></iconify-icon>
                                    </div>
                                    <input type="text" id="${modalId}-city" value="Kinshasa" placeholder="Ville" required 
                                        class="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white outline-none transition-all placeholder:text-gray-400 font-medium">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="px-6 py-5 border-t border-gray-50 bg-gray-50 flex gap-3">
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
        
        // Trigger animation
        requestAnimationFrame(() => {
            modalEl.classList.remove('opacity-0');
            modalEl.querySelector('.transform').classList.remove('scale-95');
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
                resolve(result);
            }, 300);
        };

        window.submitCheckoutModal = (id) => {
            if (id !== modalId) return;
            const name = document.getElementById(`${id}-name`).value.trim();
            const phone = document.getElementById(`${id}-phone`).value.trim();
            const city = document.getElementById(`${id}-city`).value.trim();

            if (!phone) {
                showToast("Le numéro de téléphone est obligatoire", "warning");
                return;
            }

            window.closeCheckoutModal(id, { name: name || "Client Web", phone, city: city || "Kinshasa" });
        };
    });
}

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

        const { name: customerName, phone: customerPhone, city: customerCity, email: customerEmail } = customerInfo;

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
            customer_email: customerEmail || 'client@newket.cd'
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
 * Cherche tous les éléments .lazy-img avec data-src et les charge
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
