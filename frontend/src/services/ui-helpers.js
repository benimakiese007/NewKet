/**
 * NewKet UI Helpers
 * Common utilities for UI rendering and interactions.
 */

/**
 * Returns the relative path to the project root.
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
    
    // Auto-rewrite to clean URLs in production (strip .html)
    // Using MutationObserver or similar at runtime isn't efficient, 
    // so we handle it in component generation logic instead.
    
    return prefix;
}

/**
 * Shows a toast message to the user.
 */
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container') || createToastContainer();

    const toast = document.createElement('div');
    toast.className = 'flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl transition-all duration-500 translate-y-10 opacity-0 bg-white border border-gray-100 mb-3 max-w-sm w-full';

    const icons = {
        success: { icon: 'solar:check-circle-bold', color: 'text-green-500' },
        error: { icon: 'solar:danger-bold', color: 'text-red-500' },
        warning: { icon: 'solar:shield-warning-bold', color: 'text-amber-500' },
        info: { icon: 'solar:info-circle-bold', color: 'text-blue-500' }
    };

    const { icon, color } = icons[type] || icons.info;

    const safeMsg = (typeof window.escapeHTML === 'function') ? window.escapeHTML(message) : String(message).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    toast.innerHTML = `
        <div class="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
            <iconify-icon icon="${icon}" width="24" class="${color}"></iconify-icon>
        </div>
        <div class="flex-1">
            <p class="text-sm font-bold text-gray-900">${safeMsg}</p>
        </div>
    `;

    toastContainer.appendChild(toast);

    // Trigger animation
    setTimeout(() => {
        toast.classList.remove('translate-y-10', 'opacity-0');
    }, 10);

    // Remove after delay
    setTimeout(() => {
        toast.classList.add('opacity-0', '-translate-y-5');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed top-24 right-6 z-[100] flex flex-col items-end pointer-events-none w-full max-w-sm px-4 sm:px-0';
    document.body.appendChild(container);
    return container;
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

    // Format price
    const priceDisplay = window.CurrencyManager ? CurrencyManager.formatPrice(p.price) : `${(p.price || 0).toLocaleString()} FC`;
    const oldPriceDisplay = p.oldPrice ? (window.CurrencyManager ? CurrencyManager.formatPrice(p.oldPrice) : `${p.oldPrice.toLocaleString()} FC`) : null;

    // Badge
    let badgeHTML = '';
    if (p.isNew || p.is_new) {
        badgeHTML = `<span class="badge badge-new"><iconify-icon icon="solar:star-bold" width="10"></iconify-icon> NOUVEAU</span>`;
    } else if (p.isPromo || p.is_promo) {
        badgeHTML = `<span class="badge badge-sale"><iconify-icon icon="solar:fire-bold" width="10"></iconify-icon> PROMO</span>`;
    }

    // Stars
    const starsHTML = buildStarsHTML(p.rating || 4.5);
    const reviewCount = p.reviews || 0;

    return `
        <div class="product-card ${animationClass}" style="animation-delay: ${delay};" data-product-id="${p.id}" data-category="${p.category || ''}">
            <div class="product-image">
                ${badgeHTML}
                <button onclick="addToWishlist('${p.id}', event)" class="wishlist-btn ${isFavorite ? 'active' : ''}" title="${isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
                    <iconify-icon icon="${isFavorite ? 'solar:heart-bold' : 'solar:heart-linear'}" width="18" style="${isFavorite ? 'color:#ef4444' : 'color:#6b7280'}"></iconify-icon>
                </button>
                <a href="${getRootPath()}pages/product?id=${p.id}">
                    <img src="${mainImg}" alt="${p.name}" loading="lazy" onerror="this.src='${getRootPath()}assets/Images/default.png'">
                </a>
            </div>
            <div class="product-info">
                <div class="product-cat">${p.category || ''}</div>
                <div class="product-vendor" style="display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">
                    <div style="width: 18px; height: 18px; border-radius: 50%; background: #f3f4f6; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-center;">
                        ${p.users?.avatar 
                            ? `<img src="${p.users.avatar}" style="width: 100%; height: 100%; object-cover">` 
                            : `<iconify-icon icon="solar:shop-bold" style="font-size: 10px; color: #9ca3af; margin: auto;"></iconify-icon>`
                        }
                    </div>
                    <span>Vendu par : ${p.users?.company_name || p.users?.name || 'NewKet Shop'}</span>
                </div>
                <h3 class="product-title">
                    <a href="${getRootPath()}pages/product?id=${p.id}">${p.name}</a>
                </h3>
                <div class="product-rating">
                    ${starsHTML}
                    <span>(${reviewCount})</span>
                </div>
                <div class="product-price" style="flex-wrap: nowrap; align-items: baseline;">
                    <span class="current-price" data-price-cdf="${p.price}">${priceDisplay}</span>
                    ${oldPriceDisplay ? `<span class="old-price" style="font-size:0.9rem; color:#9ca3af; text-decoration:line-through; margin-left:0.5rem;">${oldPriceDisplay}</span>` : ''}
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-top: auto;">
                    <button 
                        onclick="if(window.contactSeller) window.contactSeller('${p.id}', this)"
                        class="flex-1 bg-gray-900 hover:bg-black text-white py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                        style="border:none; cursor:pointer;"
                        data-product-id="${p.id}">
                        <iconify-icon icon="solar:chat-round-call-bold" width="16"></iconify-icon>
                        Commander
                    </button>
                    <button onclick="if(navigator.share){ navigator.share({title:'${p.name.replace(/'/g, "\\'")} — NewKet', url: window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1) + '${getRootPath()}pages/product?id=${p.id}'}); } else { navigator.clipboard.writeText(window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1) + '${getRootPath()}pages/product?id=${p.id}'); if(window.showToast) showToast('Lien copié !', 'info'); }"
                        style="width:40px; height:40px; border-radius:10px; border:1px solid #e5e7eb; display:flex; align-items:center; justify-content:center; color:#6b7280; background:white; cursor:pointer; flex-shrink:0; transition: all 0.2s ease;"
                        onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='white'"
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
                <div class="skeleton skeleton-image"></div>
                <div class="skeleton skeleton-text" style="width: 30%"></div>
                <div class="skeleton skeleton-text" style="width: 50%"></div>
                <div class="skeleton skeleton-title"></div>
                <div class="skeleton skeleton-text" style="width: 40%"></div>
                <div class="skeleton skeleton-price"></div>
                <div class="skeleton skeleton-button"></div>
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
 * Handles WhatsApp redirection for product contact
 */
window.contactSeller = async (productId, btnElement) => {
    try {
        const originalHtml = btnElement.innerHTML;
        btnElement.innerHTML = '<iconify-icon icon="line-md:loading-twotone-loop" width="16"></iconify-icon>...';
        btnElement.disabled = true;
        
        const p = window.ProductManager.getProduct(productId) || await window.ProductManager.fetchProductById(productId);
        if(!p) {
            showToast('Produit introuvable', 'error');
            btnElement.innerHTML = originalHtml;
            btnElement.disabled = false;
            return;
        }

        const sellerInfo = await window.SupabaseAdapter.fetchWithFilters('profiles', {
            eq: [['id', p.user_id]], single: true
        });
        
        const phone = sellerInfo?.store_phone_whatsapp || sellerInfo?.phone;
        if (!phone) {
            showToast("Ce vendeur n'a pas de numéro WhatsApp lié.", 'error');
            btnElement.innerHTML = originalHtml;
            btnElement.disabled = false;
            return;
        }
        
        // Record lead asynchronously
        recordLead(p.id, p.user_id, p.name);

        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const productUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1) + getRootPath() + 'pages/product?id=' + p.id;
        const message = encodeURIComponent(`Bonjour, je suis intéressé par l'article *${p.name}*\nPrix: ${p.price} FC\n\nLien: ${productUrl}`);
        window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
        
        btnElement.innerHTML = originalHtml;
        btnElement.disabled = false;
    } catch (err) {
        console.error('[NewKet] Contact error:', err);
        showToast("Erreur lors de la redirection WhatsApp.", "error");
        btnElement.disabled = false;
    }
};

window.showToast = showToast;
window.debounce = debounce;
window.buildProductCardHTML = buildProductCardHTML;
window.buildSkeletonCardHTML = buildSkeletonCardHTML;
window.buildSkeletonDashboardStatsHTML = buildSkeletonDashboardStatsHTML;
window.buildSkeletonActivityHTML = buildSkeletonActivityHTML;
window.buildSkeletonNotificationHTML = buildSkeletonNotificationHTML;
window.buildStarsHTML = buildStarsHTML;
window.getOptimizedImageUrl = getOptimizedImageUrl;
