/**
 * NewKet UI Helpers
 * Common utilities for UI rendering and interactions.
 */

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

    toast.innerHTML = `
        <div class="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
            <iconify-icon icon="${icon}" width="24" class="${color}"></iconify-icon>
        </div>
        <div class="flex-1">
            <p class="text-sm font-bold text-gray-900">${message}</p>
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

    // Handle image (could be comma separated)
    const images = (p.image || '').split(',');
    const mainImg = images[0].trim() || 'Images/default.png';

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
                <a href="product.html?id=${p.id}">
                    <img src="${mainImg}" alt="${p.name}" loading="lazy" onerror="this.src='Images/default.png'">
                </a>
            </div>
            <div class="product-info">
                <div class="product-cat">${p.category || ''}</div>
                <h3 class="product-title">
                    <a href="product.html?id=${p.id}">${p.name}</a>
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
                        onclick="const prod = window.ProductManager ? ProductManager.getProduct('${p.id}') : null; if(prod && window.CartManager){ CartManager.addItem(prod); }"
                        style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; background:#111827; color:white; border:none; border-radius:12px; font-size:0.875rem; font-weight:700; padding:0.75rem 1rem; cursor:pointer; transition:background 0.2s ease; letter-spacing:0.01em;"
                        onmouseover="this.style.background='#000'" onmouseout="this.style.background='#111827'"
                        data-product-id="${p.id}">
                        <iconify-icon icon="solar:cart-large-minimalistic-bold" width="16"></iconify-icon>
                        Ajouter
                    </button>
                    <button onclick="if(navigator.share){ navigator.share({title:'${p.name.replace(/'/g, "\\'")} — NewKet', url: window.location.origin + '/product.html?id=${p.id}'}); } else { navigator.clipboard.writeText(window.location.origin + '/product.html?id=${p.id}'); if(window.showToast) showToast('Lien copié !', 'info'); }"
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
            <div class="product-card" style="animation: pulse 1.5s infinite;">
                <div class="product-image" style="background:#f3f4f6;"></div>
                <div class="product-info">
                    <div style="height:12px; background:#f3f4f6; border-radius:6px; width:40%; margin-bottom:10px;"></div>
                    <div style="height:18px; background:#f3f4f6; border-radius:6px; width:80%; margin-bottom:10px;"></div>
                    <div style="height:14px; background:#f3f4f6; border-radius:6px; width:60%; margin-bottom:16px;"></div>
                    <div style="height:24px; background:#f3f4f6; border-radius:6px; width:50%; margin-bottom:16px;"></div>
                    <div style="height:44px; background:#f3f4f6; border-radius:12px; width:100%;"></div>
                </div>
            </div>
        `;
    }
    return html;
}

window.showToast = showToast;
window.debounce = debounce;
window.buildProductCardHTML = buildProductCardHTML;
window.buildSkeletonCardHTML = buildSkeletonCardHTML;
window.buildStarsHTML = buildStarsHTML;
