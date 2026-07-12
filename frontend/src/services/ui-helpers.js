/**
 * NewKet UI Helpers
 * Common utilities for UI rendering and interactions.
 */

function mountModalOverlay(modal) {
    (document.documentElement || document.body).appendChild(modal);
}

/// Global Notification Queue (One by one system)
let _toastQueue = [];
let _isShowingToast = false;

/**
 * Shows a toast message to the user using a central queue system.
 */
export function showToast(message, type = 'info', title = null, iconOverride = null) {
    const normalizedType = (type === 'error') ? 'danger' : type;
    _toastQueue.push({ message, type: normalizedType, title, iconOverride });
    if (!_isShowingToast) {
        _processToastQueue();
    }
}

export function normalizeNotificationType(rawType) {
    if (!rawType) return 'info';
    if (rawType === 'broadcast') return 'info';
    if (rawType.startsWith('broadcast-modal:')) return rawType.split(':').slice(1).join(':') || 'info';
    if (rawType.startsWith('broadcast:')) return rawType.split(':')[1] || 'info';
    if (rawType === 'error') return 'danger';
    return rawType;
}

export function isPopupNotification(rawType) {
    return rawType === 'broadcast'
        || String(rawType || '').startsWith('broadcast:')
        || String(rawType || '').startsWith('broadcast-modal:');
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
        <button type="button" class="nk-toast-close" aria-label="Fermer">&times;</button>
    `;

    container.appendChild(toast);

    // Manual Close
    const closeBtn = toast.querySelector('.nk-toast-close');
    let autoCloseTimer;
    let isDismissing = false;
    let isDismissed = false;

    const dismiss = () => {
        if (isDismissing) return;
        isDismissing = true;
        clearTimeout(autoCloseTimer);
        toast.classList.add('exit');

        const finalizeDismiss = () => {
            if (isDismissed) return;
            isDismissed = true;
            toast.remove();
            _processToastQueue();
        };

        toast.addEventListener('animationend', finalizeDismiss, { once: true });
        window.setTimeout(finalizeDismiss, 450);
    };

    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dismiss();
    });

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
    autoCloseTimer = window.setTimeout(dismiss, 3000);
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

function _nkNormalizeForSlug(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[’']/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function buildShopSlug(shopName) {
    const base = _nkNormalizeForSlug(shopName);
    if (!base) return 'Shop_NewKet';
    return base;
}

function buildProductSlug(productName) {
    const base = _nkNormalizeForSlug(productName);
    if (!base) return 'Produit_NewKet';
    return `${base}_NewKet`;
}

async function copyTextToClipboard(text) {
    const value = String(text || '');
    if (!value) return false;
    try {
        await navigator.clipboard.writeText(value);
        return true;
    } catch {
        try {
            const ta = document.createElement('textarea');
            ta.value = value;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.top = '-1000px';
            ta.style.left = '-1000px';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            ta.remove();
            return !!ok;
        } catch {
            return false;
        }
    }
}

function buildShopShareUrl({ shopName, shopSlug } = {}) {
    const providedSlug = String(shopSlug || '').trim();
    const slug = providedSlug || buildShopSlug(shopName);
    const url = new URL(`/Boutique/${encodeURIComponent(slug)}/NewKet`, window.location.origin);
    return url.toString();
}

function buildProductShareUrl({ shopName, email, productName, productId } = {}) {
    const shopSlug = buildShopSlug(shopName);
    const productSlug = buildProductSlug(productName);
    const random = Math.floor(Math.random() * 100) + 1;
    const url = new URL(`/Boutique/${encodeURIComponent(shopSlug)}/${encodeURIComponent(productSlug)}/${random}/NewKet`, window.location.origin);
    // Keep id as a query param so product.html can always resolve to a real product record.
    if (productId) url.searchParams.set('id', productId);
    if (email) url.searchParams.set('email', email);
    return url.toString();
}

function buildProductPagePath({ shopName, shopSlug, productName, productId, email } = {}) {
    const resolvedShopSlug = String(shopSlug || '').trim() || buildShopSlug(shopName);
    const productSlug = buildProductSlug(productName);

    if (resolvedShopSlug && productSlug) {
        const random = Math.floor(Math.random() * 100) + 1;
        const url = new URL(`/Boutique/${encodeURIComponent(resolvedShopSlug)}/${encodeURIComponent(productSlug)}/${random}/NewKet`, window.location.origin);
        if (productId) url.searchParams.set('id', productId);
        if (email) url.searchParams.set('email', email);
        return `${url.pathname}${url.search}`;
    }

    const fallback = new URL(window.resolvePath('product'), window.location.origin);
    if (productId) fallback.searchParams.set('id', productId);
    if (email) fallback.searchParams.set('email', email);
    return `${fallback.pathname}${fallback.search}`;
}

window.NewKetLinks = {
    buildShopSlug,
    buildProductSlug,
    buildShopShareUrl,
    buildProductShareUrl,
    buildProductPagePath,
    copyTextToClipboard
};

document.addEventListener('click', async (event) => {
    const shareButton = event.target instanceof Element
        ? event.target.closest('button[aria-label="Partager ce produit"]')
        : null;
    if (!shareButton) return;

    const productCard = shareButton.closest('[data-product-share-url]');
    const productUrl = productCard?.getAttribute('data-product-share-url');
    if (!productUrl) return;

    event.preventDefault();
    event.stopPropagation();

    const productName = productCard?.getAttribute('data-product-name') || 'Produit NewKet';
    try {
        if (navigator.share) {
            await navigator.share({
                title: `${productName} - NewKet`,
                url: productUrl
            });
            return;
        }
    } catch {
        return;
    }

    const copied = await copyTextToClipboard(productUrl);
    if (copied && window.showToast) {
        showToast('Lien copie !', 'info');
    }
}, true);

/**
 * Debounce function to limit execution frequency.
 */
export function debounce(func, wait) {
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
 * Supports both Desktop (Collapse) and Mobile (Drawer) modes.
 */
export const SidebarManager = {
    state: {
        isCollapsed: localStorage.getItem('newketSidebarCollapsed') === 'true',
        isMobile: window.innerWidth < 1024,
        isDrawerOpen: false,
        initialized: false
    },

    init(sidebarId, mainContentClass, overlayId = null) {
        this.sidebarId = sidebarId;
        this.mainContentClass = mainContentClass;
        this.storageKey = `newketSidebarCollapsed:${sidebarId}`;
        // Auto-detect overlay if not provided
        this.overlayId = overlayId || (sidebarId.includes('admin') ? 'adminOverlay' : (sidebarId.includes('vendor') ? 'vendorSidebarOverlay' : 'sidebarOverlay'));

        // IMPORTANT: SidebarManager.init() can run seconds after initial module load
        // (e.g. after `newketInitialized`). Recompute responsive/collapsed state at
        // init-time to avoid applying the wrong mode after the first paint.
        this.state.isMobile = window.innerWidth < 1024;
        // Per-dashboard collapse state (with legacy fallback).
        const scoped = localStorage.getItem(this.storageKey);
        const legacy = localStorage.getItem('newketSidebarCollapsed');
        this.state.isCollapsed = (scoped ?? legacy) === 'true';
        // If only legacy is present, migrate it to the scoped key (do not delete legacy; other tabs may still read it).
        if (scoped === null && legacy !== null) {
            localStorage.setItem(this.storageKey, legacy);
        }
        this.syncSidebarWidth(sidebarId);
         
        // Prevent transition flash on init
        const sidebar = document.getElementById(this.sidebarId);
        if (sidebar) sidebar.classList.add('no-transition');
         
        this.applyState();

        // Restore transitions
        if (sidebar) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    sidebar.classList.remove('no-transition');
                });
            });
        }


        if (this.state.initialized) return;
        this.state.initialized = true;

        // Handle window resize
        const handleResize = debounce(() => {
            const wasMobile = this.state.isMobile;
            this.state.isMobile = window.innerWidth < 1024;
            
            if (wasMobile !== this.state.isMobile) {
                if (!this.state.isMobile) this.state.isDrawerOpen = false;
                this.syncSidebarWidth();
                this.applyState();
            }
        }, 150);

        window.addEventListener('resize', handleResize);

        // Click outside and keyboard listeners
        this.setupKeyboardListeners();
        this.setupGlobalClickHandlers();
    },

    setupKeyboardListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.state.isDrawerOpen) {
                this.close();
            }
        });
    },

    setupGlobalClickHandlers() {
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById(this.sidebarId);
            if (!sidebar) return;

            // 1. Handle clicks on the Overlay
            if (e.target && e.target.id === this.overlayId) {
                if (e.target.onclick || e.target.getAttribute('onclick')) return;
                this.close();
                return;
            }

            // Ensure e.target is an Element to safely use .closest()
            if (!e.target || typeof e.target.closest !== 'function') return;

                    // 2. Handle Toggle Button clicks (Hamburger/Burger/Collapse)
            const toggleBtn = e.target.closest('button');
            if (toggleBtn) {
                const hasToggleAttr = toggleBtn.getAttribute('data-toggle-sidebar');
                if (hasToggleAttr) {
                    // Only the capture listener calls toggle() — no onclick on these buttons.
                    // Stop propagation so no other listener fires toggle() again.
                    e.stopPropagation();
                    this.toggle();
                    return;
                } else if (toggleBtn.getAttribute('onclick')) {
                    // Let the onclick handler run normally (e.g. close button).
                    return;
                }
            }

            // 3. Handle Link Clicks & Outside Clicks (Mobile Only)
            if (this.state.isMobile && this.state.isDrawerOpen) {
                const link = e.target.closest('a') || e.target.closest('button');
                
                // If we clicked a link inside the sidebar, close it
                if (link && sidebar.contains(link) && !link.hasAttribute('data-no-close')) {
                    this.close();
                    return; // Return so we don't prevent the default link action or bubble phase
                }

                // If we clicked OUTSIDE the sidebar
                if (!sidebar.contains(e.target)) {
                    this.close();
                }
            }
        }, true);
    },

    toggle() {
        if (this.state.isMobile) {
            this.state.isDrawerOpen = !this.state.isDrawerOpen;
        } else {
            this.state.isCollapsed = !this.state.isCollapsed;
            localStorage.setItem(this.storageKey || 'newketSidebarCollapsed', String(this.state.isCollapsed));
        }
        this.syncSidebarWidth();
        this.applyState();
    },

    close() {
        if (this.state.isMobile && this.state.isDrawerOpen) {
            this.state.isDrawerOpen = false;
            this.applyState();
        }
    },

    closeMobile() {
        if (this.state.isMobile && this.state.isDrawerOpen) {
            this.state.isDrawerOpen = false;
            this.applyState();
        }
    },

    applyState() {
        const sidebar = document.getElementById(this.sidebarId);
        const overlay = document.getElementById(this.overlayId);
        if (!sidebar) return;

        // Hard-override stacking for mobile drawers (prevents overlay tinting the drawer on some devices)
        if (overlay) {
            overlay.style.zIndex = '9998';
            overlay.style.webkitBackdropFilter = 'none';
            overlay.style.backdropFilter = 'none';
        }
        sidebar.style.zIndex = '9999';

        if (this.state.isMobile) {
            // Mobile Drawer Logic
            if (this.state.isDrawerOpen) {
                // Reset "settled" mode (used to avoid iOS/Safari text blurriness after transforms)
                sidebar.classList.remove('drawer-settled');
                sidebar.classList.remove('-translate-x-full');
                sidebar.classList.add('translate-x-0'); // Ensure it is shown
                if (overlay) overlay.classList.remove('hidden');
                document.documentElement.classList.add('overflow-hidden');
                document.body.classList.add('overflow-hidden');

                // After the slide-in transition completes, remove transform to keep text crisp on mobile Safari.
                // (Transforms + large fixed panels can cause persistent subpixel blur on iOS.)
                window.clearTimeout(this._settleTimer);
                this._settleTimer = window.setTimeout(() => {
                    if (this.state.isMobile && this.state.isDrawerOpen) {
                        sidebar.classList.add('drawer-settled');
                    }
                }, 450);
            } else {
                window.clearTimeout(this._settleTimer);
                sidebar.classList.remove('drawer-settled');
                sidebar.classList.remove('translate-x-0'); // Ensure we don't have conflicting translate classes
                sidebar.classList.add('-translate-x-full');
                if (overlay) overlay.classList.add('hidden');
                document.documentElement.classList.remove('overflow-hidden');
                document.body.classList.remove('overflow-hidden');
            }
            // Ensure no collapse state on mobile
            sidebar.classList.remove('sidebar-collapsed');
            document.documentElement.classList.remove('sidebar-is-collapsed');
            document.body.classList.remove('sidebar-is-collapsed');
        } else {
            // Desktop Collapse Logic
            sidebar.classList.remove('-translate-x-full');
            sidebar.classList.remove('translate-x-0');
            if (overlay) overlay.classList.add('hidden');
            document.documentElement.classList.remove('overflow-hidden');
            document.body.classList.remove('overflow-hidden');

            if (this.state.isCollapsed) {
                sidebar.classList.add('sidebar-collapsed');
                document.documentElement.classList.add('sidebar-is-collapsed');
                document.body.classList.add('sidebar-is-collapsed');
            } else {
                sidebar.classList.remove('sidebar-collapsed');
                document.documentElement.classList.remove('sidebar-is-collapsed');
                document.body.classList.remove('sidebar-is-collapsed');
            }
        }
    }
    ,
    /**
     * Ensure the sidebar element's width reflects the collapsed state even when
     * page-level CSS uses ID selectors (higher specificity) for widths.
     */
    syncSidebarWidth(sidebarIdOverride = null) {
        const sidebarId = sidebarIdOverride || this.sidebarId;
        if (!sidebarId) return;
        const sidebar = document.getElementById(sidebarId);
        if (!sidebar) return;

        // Clear any previous inline override before re-applying.
        sidebar.style.removeProperty('width');

        if (!this.state.isMobile && this.state.isCollapsed) {
            // Inline style beats ID-based width rules, keeping collapse reliable.
            sidebar.style.setProperty('width', '80px', 'important');
        }
    }
};
window.SidebarManager = SidebarManager;

/**
 * Génère les étoiles de notation.
 */
export function buildStarsHTML(rating) {
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
export function buildProductCardHTML(p, options = {}) {
    const {
        animationClass = '',
        delay = '0s',
        imageLoading = 'lazy',
        prioritizeImage = false,
        prioritizeAvatar = false,
        wrapperClass = ''
    } = options;
    const isFavorite = window.FavoritesManager ? FavoritesManager.isInFavorites(p.id) : false;

    // Handle image (could be comma separated or array-backed) — use the first real token.
    const fallbackImg = 'https://res.cloudinary.com/dzhnphyp3/image/upload/c_limit,w_800,f_auto,q_auto/v1782572380/newket_assets/frontend/src/assets/Images/default.jpg';
    const primaryImageSource = Array.isArray(p.images) && p.images.length > 0
        ? p.images[0]
        : (p.image || p.image_url || p.imageUrl || p.product_image || p.thumbnail || p.cover_image || '');
    const resolvedPrimaryImage = window.resolveProductImageSource
        ? window.resolveProductImageSource(primaryImageSource || p)
        : '';
    const images = splitImageCandidates(primaryImageSource || resolvedPrimaryImage || '');
    let rawImg = (resolvedPrimaryImage || images[0] || fallbackImg);
    if (rawImg.toLowerCase() === '/images/placeholder.png') {
        rawImg = fallbackImg;
    }
    const mainImg = window.getOptimizedImageUrl ? window.getOptimizedImageUrl(rawImg, { width: 320, quality: 75 }) : rawImg;
    const mainImgSrcSet = window.buildResponsiveImageSrcSet
        ? buildResponsiveImageSrcSet(rawImg, prioritizeImage ? [320, 480, 640] : [240, 320, 480], { quality: 75 })
        : '';
    const mainImgSizes = prioritizeImage
        ? '(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 240px'
        : '(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 200px';
    // Format price
    const priceDisplay = window.CurrencyManager ? CurrencyManager.formatPrice(p.price) : `${(p.price || 0).toLocaleString()} FC`;
    const oldPrice = p.oldPrice || p.old_price;
    const oldPriceDisplay = oldPrice ? (window.CurrencyManager ? CurrencyManager.formatPrice(oldPrice) : `${oldPrice.toLocaleString()} FC`) : null;
    const discountPercent = oldPrice && Number(oldPrice) > Number(p.price)
        ? Math.round(((Number(oldPrice) - Number(p.price)) / Number(oldPrice)) * 100)
        : 0;
    const discountBadge = discountPercent > 0
        ? `<span class="promo-discount-badge" style="display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;background:#dcfce7;color:#166534;font-size:10px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;">-${discountPercent}%</span>`
        : '';
    const priceMetaHTML = discountBadge
        ? (oldPriceDisplay
            ? `<div class="flex items-center gap-2 flex-wrap">${oldPriceDisplay ? `<span class="old-price">${oldPriceDisplay}</span>` : ''}${discountBadge}</div>`
            : `<div class="mt-1">${discountBadge}</div>`)
        : (oldPriceDisplay ? `<span class="old-price">${oldPriceDisplay}</span>` : '');

    // Badge
    let badgeHTML = '';
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const createdAtTime = new Date(p.created_at || p.createdAt || 0).getTime();
    const isNew = Number.isFinite(createdAtTime)
        && createdAtTime > 0
        && Date.now() - createdAtTime <= THIRTY_DAYS_MS;

    if (isNew) {
        badgeHTML = `<span class="badge badge-new">Nouveau</span>`;
    }

    const stock = Number(p.stock ?? p.stock_quantity ?? p.quantity ?? 0);
    const isAvailable = Number.isFinite(stock) && stock > 0;
    const availabilityBadge = isAvailable
        ? `<span class="badge" style="background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;display:inline-flex;align-items:center;gap:4px;"><iconify-icon icon="solar:check-circle-bold" width="10"></iconify-icon> En stock</span>`
        : `<span class="badge" style="background:#f3f4f6;color:#4b5563;border:1px solid #e5e7eb;display:inline-flex;align-items:center;gap:4px;"><iconify-icon icon="solar:close-circle-bold" width="10"></iconify-icon> Indisponible</span>`;

    // Stars
    const starsHTML = buildStarsHTML(p.rating || 4.5);
    const reviewCount = p.reviews || 0;

    const productImgAttrs = prioritizeImage
        ? `src="${mainImg}"${mainImgSrcSet ? ` srcset="${mainImgSrcSet}" sizes="${mainImgSizes}"` : ''} loading="${imageLoading}" fetchpriority="high"`
        : `data-src="${mainImg}"${mainImgSrcSet ? ` data-srcset="${mainImgSrcSet}" data-sizes="${mainImgSizes}"` : ''} src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E" loading="${imageLoading}"`;
    const productImgClass = prioritizeImage ? '' : 'lazy-img';
    const avatar = (Array.isArray(p.users) ? p.users[0] : p.users)?.avatar;
    const avatarUrl = window.getOptimizedImageUrl ? window.getOptimizedImageUrl(avatar, { width: 72, quality: 70 }) : avatar;
    const avatarSrcSet = window.buildResponsiveImageSrcSet ? buildResponsiveImageSrcSet(avatar, [48, 72, 96], { quality: 70 }) : '';
    const avatarImgAttrs = prioritizeAvatar && avatarUrl
        ? `src="${avatarUrl}"${avatarSrcSet ? ` srcset="${avatarSrcSet}" sizes="36px"` : ''} loading="eager" fetchpriority="high"`
        : avatarUrl
            ? `data-src="${avatarUrl}"${avatarSrcSet ? ` data-srcset="${avatarSrcSet}" data-sizes="36px"` : ''} src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E" loading="lazy"`
            : '';
    const avatarImgClass = prioritizeAvatar ? '' : 'lazy-img';
    const vendor = Array.isArray(p.users) ? p.users[0] : p.users;
    const cartImage = window.resolveProductImageSource
        ? window.resolveProductImageSource(p)
        : (window.getOptimizedImageUrl ? window.getOptimizedImageUrl(p.images || p.image || p.image_url || p.product_image || p.thumbnail || '') : (Array.isArray(p.images) ? p.images[0] : p.image || p.image_url || p.product_image || p.thumbnail || ''));
    const productPagePath = window.NewKetLinks?.buildProductPagePath
        ? window.NewKetLinks.buildProductPagePath({
            shopName: vendor?.company_name || vendor?.name,
            shopSlug: vendor?.shop_slug,
            productName: p.name,
            productId: p.id,
            email: p.supplier_email
        })
        : `${resolvePath('pages/product')}?id=${p.id}`;
    const absoluteProductUrl = `${window.location.origin}${productPagePath}`;

    return `
        <div class="product-card card-active-scale ${animationClass} ${wrapperClass}" style="animation-delay: ${delay};" data-product-id="${p.id}" data-category="${p.category || ''}" data-product-share-url="${absoluteProductUrl}" data-product-name="${String(p.name || 'Produit NewKet').replace(/"/g, '&quot;')}">
            <div class="product-image">
                ${badgeHTML}
                <div style="position:absolute;left:12px;bottom:12px;display:flex;gap:6px;flex-wrap:wrap;pointer-events:none;">
                    ${availabilityBadge}
                </div>
                <button onclick="addToWishlist('${p.id}', event)" 
                    class="wishlist-btn btn-active-scale ${isFavorite ? 'active' : ''}" 
                    aria-label="${isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}"
                    title="${isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
                    <iconify-icon icon="${isFavorite ? 'solar:heart-bold' : 'solar:heart-linear'}" width="18" style="color: ${isFavorite ? '#ef4444' : '#6b7280'}"></iconify-icon>
                </button>
                <a href="${productPagePath}" onclick="if(window.setProductSwipeContext) window.setProductSwipeContext(this);">
                    <img
                        ${productImgAttrs}
                        alt="${p.name}"
                        decoding="async"
                        width="400"
                        height="400"
                        class="${productImgClass}"
                        style="transition: opacity 0.3s ease;"
                        onerror="this.src='${fallbackImg}'"
                    >
                </a>
            </div>
            <div class="product-info">
                <div class="product-cat">${p.category || ''}</div>
                <div class="product-vendor" style="display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
                    <div style="width: 18px; height: 18px; border-radius: 50%; background: #f3f4f6; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-center;">
                        ${avatar
                            ? `<img ${avatarImgAttrs} alt="Avatar Vendeur" decoding="async" width="36" height="36" class="${avatarImgClass}" style="width: 100%; height: 100%; object-fit: cover; aspect-ratio: 1 / 1;">` 
                            : `<iconify-icon icon="solar:shop-bold" style="font-size: 10px; color: #9ca3af; margin: auto;"></iconify-icon>`
                        }
                    </div>
                    <span>Vendu par : ${ 
                        vendor?.company_name || 
                        vendor?.name || 
                        'NewKet Shop' 
                    }</span>
                </div>
                <h3 class="product-title">
                    <a href="${productPagePath}" onclick="if(window.setProductSwipeContext) window.setProductSwipeContext(this);">${p.name}</a>
                </h3>
                <div class="product-rating">
                    ${starsHTML}
                    <span>(${reviewCount})</span>
                </div>
                <div class="product-price">
                    <span class="current-price" data-price-cdf="${p.price}">${priceDisplay}</span>
                    ${priceMetaHTML}
                </div>
                <div class="flex items-center gap-1 sm:gap-2 mt-auto pt-1 sm:pt-2">
                    <button 
                        onclick="if(window.CartManager) window.CartManager.add({id: '${p.id}', title: '${(p.name||'').replace(/'/g, `\\'`).replace(/\"/g, '&quot;')}', price: '${p.price}', image: '${String(cartImage || '').replace(/'/g, `\\'`).replace(/\"/g, '&quot;')}', vendor_id: '${p.user_id || vendor?.id || ''}', vendor: '${(vendor?.company_name || vendor?.name || 'NewKet').replace(/'/g, `\\'`).replace(/\"/g, '&quot;')}'})"
                        class="add-to-cart-btn flex-1 btn-active-scale ${isAvailable ? 'bg-slate-900 hover:bg-slate-800 text-white' : 'bg-gray-200 text-gray-500'} py-2 sm:py-2.5 px-1 sm:px-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 sm:gap-2 shadow-sm hover:shadow-md"
                        style="border:none; cursor:pointer;"
                        aria-label="Ajouter ${String(p.name).replace(/"/g, '&quot;')} au panier"
                        data-product-id="${p.id}" ${isAvailable ? '' : 'disabled'}>
                        <iconify-icon icon="solar:cart-plus-bold" width="14" class="flex-shrink-0 sm:w-4"></iconify-icon>
                        <span class="whitespace-nowrap sm:truncate tracking-tight">${isAvailable ? 'Ajouter' : 'Indisponible'}</span>
                    </button>
                    <button onclick="if(navigator.share){ navigator.share({title:'${p.name.replace(/'/g, "\\'")} — NewKet', url: window.location.origin + resolvePath('pages/product') + '?id=${p.id}'}); } else { navigator.clipboard.writeText(window.location.origin + resolvePath('pages/product') + '?id=${p.id}'); if(window.showToast) showToast('Lien copié !', 'info'); }"
                        class="w-8 h-8 sm:w-10 sm:h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 bg-white hover:bg-gray-50 flex-shrink-0 transition-all"
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
 * Stores a "selection context" in sessionStorage so product page can swipe within
 * the same list the user came from (catalog/collection/search/shop/favorites).
 * @param {HTMLElement} linkEl - The clicked <a> element.
 */
export function setProductSwipeContext(linkEl) {
    try {
        if (!linkEl || !linkEl.closest) return;
        const container =
            linkEl.closest('.product-grid')
            || linkEl.closest('[data-products-container]')
            || linkEl.closest('section')
            || document;

        const cards = Array.from(container.querySelectorAll('[data-product-id]'));
        const ids = cards
            .map(c => c && c.getAttribute && c.getAttribute('data-product-id'))
            .filter(Boolean);

        if (ids.length < 2) return;
        sessionStorage.setItem('newket_product_swipe_context', JSON.stringify({
            ids,
            capturedAt: Date.now(),
            href: window.location.href
        }));
    } catch (e) {
        // ignore
    }
}



/**
 * Builds Skeleton cards for loading states.
 */
export function buildSkeletonCardHTML(count = 5) {
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
export function buildSkeletonDashboardStatsHTML(count = 4) {
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
export function buildSkeletonActivityHTML(count = 3) {
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
export function buildSkeletonNotificationHTML(count = 4) {
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
                        animation: shimmer 3s infinite linear;
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
 * Builds Skeleton cards for shop directory pages.
 */
export function buildSkeletonShopCardHTML(count = 4) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="shop-card bg-white rounded-[2.5rem] p-8 border border-gray-100 flex flex-col items-center text-center gap-6 relative overflow-hidden">
                <div class="skeleton w-16 h-6 rounded-full self-start"></div>
                <div class="skeleton w-24 h-24 rounded-full"></div>
                <div class="w-full space-y-3 flex flex-col items-center">
                    <div class="skeleton h-6 w-3/4 rounded-xl"></div>
                    <div class="skeleton h-3 w-2/3 rounded-full"></div>
                    <div class="skeleton h-3 w-1/2 rounded-full"></div>
                </div>
                <div class="pt-6 border-t border-gray-50 w-full flex items-center justify-between">
                    <div class="space-y-2">
                        <div class="skeleton h-3 w-24 rounded-full"></div>
                        <div class="skeleton h-3 w-20 rounded-full"></div>
                    </div>
                    <div class="skeleton w-10 h-10 rounded-full"></div>
                </div>
            </div>
        `;
    }
    return html;
}

/**
 * Builds stacked Skeleton panels for feeds, lists, and dashboard cards.
 */
export function buildSkeletonPanelListHTML(count = 3, options = {}) {
    const {
        lines = 2,
        showAvatar = false,
        cardClass = 'glass-panel p-4',
        rowClass = 'flex items-start gap-4'
    } = options;
    let html = '';
    for (let i = 0; i < count; i++) {
        const lineHtml = Array.from({ length: lines }).map((_, index) => `
            <div class="skeleton skeleton-text" style="width: ${index === 0 ? '70%' : index === lines - 1 ? '35%' : '90%'}; height: ${index === 0 ? '14px' : '12px'}; margin-bottom: ${index === lines - 1 ? '0' : '0.6rem'};"></div>
        `).join('');
        html += `
            <div class="${cardClass}">
                <div class="${rowClass}">
                    ${showAvatar ? '<div class="skeleton skeleton-avatar flex-shrink-0"></div>' : ''}
                    <div class="flex-1 min-w-0">
                        ${lineHtml}
                    </div>
                </div>
            </div>
        `;
    }
    return html;
}

/**
 * Builds Skeleton table rows for admin tables.
 */
export function buildSkeletonTableRowsHTML(columnCount = 6, rowCount = 5) {
    let html = '';
    for (let row = 0; row < rowCount; row++) {
        html += '<tr>';
        for (let col = 0; col < columnCount; col++) {
            const width = col === 0 ? '70%' : col === columnCount - 1 ? '85%' : col % 2 === 0 ? '90%' : '60%';
            html += `
                <td class="p-4">
                    <div class="skeleton skeleton-text" style="width: ${width}; height: 14px; margin-bottom: 0;"></div>
                </td>
            `;
        }
        html += '</tr>';
    }
    return html;
}

/**
 * Builds Skeleton rows for the system-health incidents list.
 */
export function buildSkeletonIncidentListHTML(count = 4) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="p-4">
                <div class="flex items-start justify-between gap-3">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-3">
                            <div class="skeleton h-6 w-12 rounded-full"></div>
                            <div class="skeleton h-4 w-24 rounded-full"></div>
                        </div>
                        <div class="skeleton h-5 w-2/3 rounded-lg mb-3"></div>
                        <div class="skeleton h-4 w-full rounded-full mb-2"></div>
                        <div class="skeleton h-4 w-4/5 rounded-full mb-3"></div>
                        <div class="skeleton h-3 w-48 rounded-full"></div>
                    </div>
                    <div class="flex gap-2">
                        <div class="skeleton h-10 w-16 rounded-lg"></div>
                        <div class="skeleton h-10 w-20 rounded-lg"></div>
                    </div>
                </div>
            </div>
        `;
    }
    return html;
}

function buildSupabaseTransformedImageUrl(source) {
    const baseUrl = String(window.supabaseClient?.supabaseUrl || 'https://kuygjocnnlvjtoaquicq.supabase.co').replace(/\/+$/, '');
    const match = String(source || '').trim().match(
        /^(?:https?:\/\/[^/]+)?\/storage\/v1\/(?:object\/public|render\/image\/public)\/([^/]+)\/([^?#]+)(?:[?#].*)?$/i
    );

    let bucket = '';
    let objectPath = '';

    if (match) {
        bucket = match[1];
        objectPath = match[2];
    } else {
        const parts = String(source || '').trim().split('/');
        if (parts.length < 2) return source;
        bucket = parts.shift();
        objectPath = parts.join('/');
    }

    if (!bucket || !objectPath) return source;

    const encodedObjectPath = objectPath
        .split('/')
        .map(segment => encodeURIComponent(segment))
        .join('/');

    return `${baseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedObjectPath}`;
}

function isSupabaseImageSource(source) {
    const value = String(source || '').trim();
    return /^(?:https?:\/\/[^/]+\/storage\/v1\/(?:object\/public|render\/image\/public)\/|(?:product-images|vendor-covers|user-assets|vendor-docs|site-assets)\/)/i.test(value);
}

function extractPrimaryImageToken(source) {
    if (Array.isArray(source)) {
        source = String(source[0] || '').trim();
    }

    if (source && typeof source === 'object') {
        const objectCandidates = [
            source.url,
            source.src,
            source.image,
            source.image_url,
            source.imageUrl,
            source.primary,
            source.thumb,
            source.thumbnail,
            source.photo,
            source.picture,
            source.avatar,
            source.avatar_url,
            source.avatarUrl,
            source.profile_image,
            source.profileImage,
            source.logo,
            source.cover,
            source.cover_image,
            source.path
        ];

        for (const candidate of objectCandidates) {
            const resolved = extractPrimaryImageToken(candidate);
            if (resolved) return resolved;
        }

        return '';
    }

    let value = String(source || '').trim();
    if (!value) return '';

    let extractedValue = value;

    if (value.startsWith('[') || value.startsWith('{')) {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                extractedValue = String(parsed[0] || '').trim();
            } else if (parsed && typeof parsed === 'object') {
                extractedValue = String(parsed.url || parsed.image || parsed.src || parsed.thumb || parsed.primary || Object.values(parsed)[0] || '').trim();
            }
        } catch (e) {
            // Not JSON or malformed, continue to fallback
        }
    }

    // Handle Postgres array syntax like "{url1,url2}" and stray brackets/quotes.
    // Do not blindly split on commas because Cloudinary transformation URLs use commas too.
    let cleanedValue = extractedValue.replace(/^\{|\}$/g, '').replace(/^\[|\]$/g, '');
    let firstPart = splitImageCandidates(cleanedValue)[0] || '';
    
    // Clean wrapping quotes
    return firstPart.replace(/^"|"$/g, '').replace(/^'|'$/g, '').trim();
}

function parseImageVariantToken(token) {
    const value = String(token || '').trim();
    if (!value) return { thumb: '', full: '', primary: '' };

    if (value.includes('||')) {
        const [thumb, full] = value.split('||').map(part => part.trim()).filter(Boolean);
        const normalizedThumb = thumb ? (isSupabaseImageSource(thumb) ? buildSupabaseTransformedImageUrl(thumb) : thumb) : '';
        const normalizedFull = full ? (isSupabaseImageSource(full) ? buildSupabaseTransformedImageUrl(full) : full) : '';
        return {
            thumb: normalizedThumb,
            full: normalizedFull,
            primary: normalizedFull || normalizedThumb || value
        };
    }

    const normalized = isSupabaseImageSource(value) ? buildSupabaseTransformedImageUrl(value) : value;
    return { thumb: '', full: normalized, primary: normalized };
}

function isValidResponsiveImageBaseUrl(value) {
    const token = String(value || '').trim();
    if (!token) return false;
    if (token === '||') return false;

    // Reject strings that are just array/object delimiters or separators.
    const collapsed = token.replace(/[\[\]\{\}\|,;]+/g, '').trim();
    if (!collapsed) return false;

    return true;
}

function splitImageCandidates(value) {
    if (Array.isArray(value)) {
        return value.map((item) => String(item || '').trim()).filter(Boolean);
    }

    const raw = String(value || '').trim();
    if (!raw) return [];

    const multiTokenSplit = raw.split(/,(?=\s*(?:https?:\/\/|\/?(?:product-images|vendor-covers|user-assets|vendor-docs|site-assets)\/|Images\/))/i);
    if (multiTokenSplit.length > 1) {
        return multiTokenSplit.map((item) => item.trim()).filter(Boolean);
    }

    return [raw];
}

function isKnownPlaceholderImageUrl(value) {
    // Désactivé pour permettre l'affichage des images (loremflickr, placehold, etc.)
    return false;
}

function isOptimizableImageSource(value) {
    const token = String(value || '').trim();
    if (!token || token.startsWith('data:') || token.startsWith('blob:')) return false;
    if (isKnownPlaceholderImageUrl(token)) return false;

    try {
        const parsed = new URL(token, window.location.origin);
        if (parsed.origin === window.location.origin) return true;
        return /\.supabase\.co$/i.test(parsed.hostname);
    } catch {
        return token.startsWith('Images/')
            || token.startsWith('/Images/')
            || token.startsWith('product-images/')
            || token.startsWith('site-assets/')
            || token.startsWith('user-assets/');
    }
}

function appendImageQueryParam(url, key, value) {
    const raw = String(url || '').trim();
    if (!raw) return raw;

    // Leave non-network sources untouched.
    if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw;

    try {
        const parsed = new URL(raw, window.location.origin);
        parsed.searchParams.set(key, String(value));
        // Preserve relative-looking URLs as site-relative paths.
        if (/^(?:[a-zA-Z][a-zA-Z\d+\-.]*:)?\/\//.test(raw) || raw.startsWith('http')) {
            return parsed.toString();
        }
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
        const hashIndex = raw.indexOf('#');
        const queryIndex = raw.indexOf('?');
        const pathEnd = hashIndex >= 0 ? hashIndex : raw.length;
        const path = queryIndex >= 0 && queryIndex < pathEnd ? raw.slice(0, queryIndex) : raw.slice(0, pathEnd);
        const existingQuery = queryIndex >= 0 && queryIndex < pathEnd ? raw.slice(queryIndex + 1, pathEnd) : '';
        const hash = hashIndex >= 0 ? raw.slice(hashIndex) : '';
        const params = new URLSearchParams(existingQuery);
        params.set(key, String(value));
        const query = params.toString();
        return `${path}${query ? `?${query}` : ''}${hash}`;
    }
}

function selectResponsiveImageUrl(source, opts = {}) {
    const token = extractPrimaryImageToken(source);
    if (!token || token === 'https://res.cloudinary.com/dzhnphyp3/image/upload/c_limit,w_800,f_auto,q_auto/v1782572380/newket_assets/frontend/src/assets/Images/default.jpg') return 'https://res.cloudinary.com/dzhnphyp3/image/upload/c_limit,w_800,f_auto,q_auto/v1782572380/newket_assets/frontend/src/assets/Images/default.jpg';
    if (isKnownPlaceholderImageUrl(token)) return 'https://res.cloudinary.com/dzhnphyp3/image/upload/c_limit,w_800,f_auto,q_auto/v1782572380/newket_assets/frontend/src/assets/Images/default.jpg';

    if (token.startsWith('data:') || token.startsWith('blob:')) {
        return token;
    }

    if (token.startsWith('Images/')) {
        return '/' + token;
    }

    const parsed = parseImageVariantToken(token);
    if (parsed.thumb && parsed.full) {
        const requestedWidth = Number(opts.width) || 0;
        return requestedWidth >= 640 ? parsed.full : parsed.thumb;
    }

    return parsed.primary || token;
}

/**
 * Builds a responsive `srcset` attribute value for an image source.
 *
 * The original implementation returned an empty string for many cases, which
 * caused the browser to emit "Failed parsing 'srcset'" errors. The new logic
 * always returns a valid srcset when the image token can be resolved.
 *
 * @param {string|string[]} source - Image URL or array of URLs.
 * @param {number[]} widths - Desired widths for the srcset entries.
 * @param {object} opts - Additional options (currently unused).
 * @returns {string} A properly formatted srcset string or an empty string if
 *   the source cannot be processed.
 */
export function buildResponsiveImageSrcSet(source, widths = [240, 320, 480], opts = {}) {
    const resolvedUrl = selectResponsiveImageUrl(source, opts);
    // Guard clauses for invalid, placeholder, or non-network images.
    if (!resolvedUrl || resolvedUrl === 'https://res.cloudinary.com/dzhnphyp3/image/upload/c_limit,w_800,f_auto,q_auto/v1782572380/newket_assets/frontend/src/assets/Images/default.jpg') return '';
    if (resolvedUrl.startsWith('data:') || resolvedUrl.startsWith('blob:')) return '';
    if (isKnownPlaceholderImageUrl(resolvedUrl)) return '';
    if (!isOptimizableImageSource(resolvedUrl)) return '';
    if (!isValidResponsiveImageBaseUrl(resolvedUrl)) return '';

    // If the token already points to a full image path, generate srcset using
    // the provided widths. We assume a Supabase image URL where we can append
    // the `?w=` query parameter to request a specific width.
    const srcset = widths
        .map((w) => `${appendImageQueryParam(resolvedUrl.startsWith('Images/') ? `/${resolvedUrl}` : resolvedUrl, 'w', w)} ${w}w`)
        .join(', ');
    return srcset;
}

/**
 * Normalizes an image URL and applies Supabase image transformations when possible.
 */
export function getOptimizedImageUrl(url, opts = { width: 320, quality: 75 }) {
    if (!url) return 'https://res.cloudinary.com/dzhnphyp3/image/upload/c_limit,w_800,f_auto,q_auto/v1782572380/newket_assets/frontend/src/assets/Images/default.jpg';
    
    if (Array.isArray(url) && url.length === 0) {
        return 'https://res.cloudinary.com/dzhnphyp3/image/upload/c_limit,w_800,f_auto,q_auto/v1782572380/newket_assets/frontend/src/assets/Images/default.jpg';
    }

    const firstImg = extractPrimaryImageToken(url);
    if (!firstImg || firstImg === 'https://res.cloudinary.com/dzhnphyp3/image/upload/c_limit,w_800,f_auto,q_auto/v1782572380/newket_assets/frontend/src/assets/Images/default.jpg') {
        return 'https://res.cloudinary.com/dzhnphyp3/image/upload/c_limit,w_800,f_auto,q_auto/v1782572380/newket_assets/frontend/src/assets/Images/default.jpg';
    }

    const selectedVariant = selectResponsiveImageUrl(firstImg, opts);
    if (selectedVariant && selectedVariant !== firstImg) {
        return selectedVariant;
    }

    return selectedVariant;
}

/**
 * Resolves the best available product image from a product object or image token.
 * Supports multi-image products, legacy field names, and comma-separated strings.
 */
export function resolveProductImageSource(productOrImage, opts = {}) {
    const fallback = opts.fallback || 'https://res.cloudinary.com/dzhnphyp3/image/upload/c_limit,w_800,f_auto,q_auto/v1782572380/newket_assets/frontend/src/assets/Images/default.jpg';
    const candidates = Array.isArray(productOrImage)
        ? productOrImage
        : [
            productOrImage?.image,
            productOrImage?.images,
            productOrImage?.image_url,
            productOrImage?.imageUrl,
            productOrImage?.product_image,
            productOrImage?.thumbnail,
            productOrImage?.cover_image,
            productOrImage
        ];

    for (const candidate of candidates) {
        const normalized = getOptimizedImageUrl(candidate, opts);
        if (normalized && normalized !== fallback) {
            return normalized;
        }
    }

    return fallback;
}
window.resolveProductImageSource = resolveProductImageSource;


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
window.loadLeaflet = loadLeaflet;

function nkNormalizeCheckoutNameCandidate(raw) {
    return String(raw || '').replace(/\s+/g, ' ').trim();
}

function nkCheckoutNameLooksLikeRoleLabel(raw) {
    const v = nkNormalizeCheckoutNameCandidate(raw).toLowerCase();
    if (!v) return true;
    const banned = new Set([
        'admin',
        'administrator',
        'administrateur',
        'administration',
        'moderator',
        'modérateur',
        'support',
        'newket',
        'user',
        'utilisateur',
        'guest',
        'invité'
    ]);
    if (banned.has(v)) return true;
    // Very short labels are usually not a real full name
    if (v.length < 3) return true;
    return false;
}

function nkDeriveCheckoutNameFromEmail(email) {
    const e = String(email || '').trim().toLowerCase();
    if (!e.includes('@')) return '';
    const local = e.split('@')[0] || '';
    if (!local) return '';
    const cleaned = local.replace(/[._+-]+/g, ' ').trim();
    if (!cleaned) return '';
    return cleaned
        .split(/\s+/g)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function nkDigitsOnly(value) {
    return String(value || '').replace(/\D+/g, '');
}

function nkIsMeaningfulCheckoutPhone(raw) {
    const digits = nkDigitsOnly(raw);
    if (digits.length < 8) return false;
    // Ignore the default placeholder shipped in ConfigManager defaults
    if (digits === '243000000000') return false;
    return true;
}

function nkGetPlatformSupportPhoneForCheckout() {
    try {
        const fromManager = window.ConfigManager?.getConfig?.()?.supportPhone;
        if (nkIsMeaningfulCheckoutPhone(fromManager)) return String(fromManager).trim();

        const fromGlobal = window.newketConfig?.supportPhone;
        if (nkIsMeaningfulCheckoutPhone(fromGlobal)) return String(fromGlobal).trim();

        const saved = localStorage.getItem('newket_global_config');
        if (saved) {
            const parsed = JSON.parse(saved);
            const p = parsed?.supportPhone;
            if (nkIsMeaningfulCheckoutPhone(p)) return String(p).trim();
        }
    } catch (_) {}
    return '';
}

function nkNormalizeHomeLocation(location) {
    if (!location || typeof location !== 'object') return null;

    const lat = Number(location.lat);
    const lng = Number(location.lng);
    const city = String(location.city || '').trim();

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
        lat,
        lng,
        city,
        updated_at: location.updated_at || new Date().toISOString()
    };
}

function nkGetSavedHomeLocation() {
    try {
        const fromProfile = window.ProfileManager?.getHomeLocation?.();
        if (fromProfile) return nkNormalizeHomeLocation(fromProfile);
    } catch (_) {}

    try {
        const saved = localStorage.getItem('newketHomeLocation');
        if (!saved) return null;
        return nkNormalizeHomeLocation(JSON.parse(saved));
    } catch (_) {
        return null;
    }
}

/**
 * Shows a checkout modal to collect customer details before payment.
 * Returns a Promise that resolves to { phone, name, city, lat, lng, quantity } or null if cancelled.
 */
window.showCheckoutModal = showCheckoutModal;
export function showCheckoutModal(productName, productPrice, quantity = 1, stock = null, hideQuantity = false) {
    return new Promise(async (resolve) => {
        const escapeAttr = (value) =>
            String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

        const profile = window.ProfileManager?.getProfile?.() || {};
        const savedHomeLocation = nkGetSavedHomeLocation();
        const role =
            window.AuthManager?.role ||
            localStorage.getItem('newketRole') ||
            '';

        let prefillName = '';
        if (role === 'supplier') {
            prefillName = (
                profile.company_name ||
                profile.boutique_name ||
                localStorage.getItem('newketCompany') ||
                localStorage.getItem('newketBoutiqueName') ||
                ''
            ).trim();
        }
        if (!prefillName) {
            const profileName = nkNormalizeCheckoutNameCandidate(profile.name);
            const storedName = nkNormalizeCheckoutNameCandidate(localStorage.getItem('newketUserName'));
            prefillName = (!nkCheckoutNameLooksLikeRoleLabel(profileName) ? profileName : '') ||
                (!nkCheckoutNameLooksLikeRoleLabel(storedName) ? storedName : '') ||
                '';
        }

        let prefillPhone = (
            profile.phone ||
            profile.store_phone ||
            localStorage.getItem('newketUserPhone') ||
            ''
        ).trim();
        let prefillEmail = (profile.email || localStorage.getItem('newketUserEmail') || '').trim();
        const prefillCity = (
            savedHomeLocation?.city ||
            profile.city ||
            localStorage.getItem('newketUserCity') ||
            'Kinshasa'
        ).trim();
        const defaultMapCenter = savedHomeLocation
            ? [savedHomeLocation.lat, savedHomeLocation.lng]
            : [-4.4419, 15.2663];

        if (!prefillEmail && window.SupabaseAdapter?.getClient) {
            try {
                const user = window.getSupabaseUser ? await window.getSupabaseUser(3000) : null;
                prefillEmail = user?.email || '';
            } catch (_) {}
        }

        // Admins: if no personal phone is known yet, prefill from platform support phone (admin settings).
        if (role === 'admin' && !nkIsMeaningfulCheckoutPhone(prefillPhone)) {
            const support = nkGetPlatformSupportPhoneForCheckout();
            if (support) prefillPhone = support;
        }

        // Hydrate phone from DB if local cache is empty (common for admin accounts).
        if (!prefillPhone && window.SupabaseAdapter?.fetchWithFilters) {
            try {
                const user =
                    window.AuthManager?.user ||
                    (window.getSupabaseUser ? await window.getSupabaseUser(3000) : null) ||
                    null;
                const userId = user?.id || localStorage.getItem('newketUserId');
                    if (userId) {
                        const row = await window.SupabaseAdapter.fetchWithFilters('users', {
                            eq: [['id', userId]],
                            select: '*',
                            single: true,
                            skipCache: true
                        });
                    const resolved =
                        row?.store_phone ||
                        row?.phone ||
                        '';
                    prefillPhone = String(resolved || '').trim();
                    if (prefillPhone && window.ProfileManager?.saveProfile) {
                        window.ProfileManager.saveProfile({
                            phone: prefillPhone,
                            store_phone: row?.store_phone || prefillPhone
                        });
                    }
                }
            } catch (_) {}
        }

        if (role === 'admin' && !nkIsMeaningfulCheckoutPhone(prefillPhone)) {
            const support = nkGetPlatformSupportPhoneForCheckout();
            if (support) prefillPhone = support;
        }

        // Last fallback from auth metadata for lazy users.
        if (!prefillName && window.AuthManager?.user?.user_metadata) {
            const meta = window.AuthManager.user.user_metadata;
            if (role === 'supplier') {
                prefillName =
                    meta.company_name ||
                    meta.shop_name ||
                    meta.store_name ||
                    '';
            }
            if (!prefillName) {
                const metaFull = nkNormalizeCheckoutNameCandidate(meta.full_name);
                const metaName = nkNormalizeCheckoutNameCandidate(meta.name);
                prefillName =
                    (!nkCheckoutNameLooksLikeRoleLabel(metaFull) ? metaFull : '') ||
                    (!nkCheckoutNameLooksLikeRoleLabel(metaName) ? metaName : '') ||
                    '';
            }
        }

        if (!prefillPhone && window.AuthManager?.user?.user_metadata) {
            const meta = window.AuthManager.user.user_metadata;
            prefillPhone = (
                meta.phone ||
                meta.phone_number ||
                meta.tel ||
                meta.mobile ||
                meta.whatsapp ||
                ''
            ).trim();
        }

        // Email-derived fallback (admins often have "Administrateur" mistakenly stored as profile.name)
        if (!prefillName) {
            if (!prefillEmail && window.SupabaseAdapter?.getClient) {
                try {
                    const user = window.getSupabaseUser ? await window.getSupabaseUser(3000) : null;
                    prefillEmail = user?.email || prefillEmail;
                } catch (_) {}
            }
            prefillName = nkDeriveCheckoutNameFromEmail(prefillEmail);
        }

        // Ensure Leaflet is loaded
        try {
            await loadLeaflet();
        } catch (err) {
            console.error("Erreur chargement Leaflet", err);
        }

        const modalId = 'checkout-modal-' + Date.now();
        const unitPrice = Number(productPrice || 0) || 0;
        const requestedQuantity = Math.max(1, parseInt(quantity, 10) || 1);
        const stockLimit = Number.isFinite(Number(stock)) && Number(stock) > 0 ? Math.max(1, Math.floor(Number(stock))) : null;
        const initialQuantity = stockLimit ? Math.min(requestedQuantity, stockLimit) : requestedQuantity;
        const formatAmount = (value) => window.CurrencyManager ? window.CurrencyManager.formatPrice(value) : `${Number(value || 0).toLocaleString()} FC`;
        const priceStr = formatAmount(unitPrice * initialQuantity);

        // "Triche" display: keep header/nav stable while checkout modal is open (Catalog was clipping menus).
        try {
            document.body.classList.add('checkout-modal-open');
        } catch (_) {}
        
        const modalHtml = `
            <div id="${modalId}" class="nk-modal-overlay fixed inset-0 flex items-center justify-center p-4 sm:p-6 opacity-0 transition-opacity duration-300" style="z-index:20000;">
                <div class="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" style="z-index:20000;" onclick="closeCheckoutModal('${modalId}', null)"></div>
                
                <div class="relative w-full max-w-md max-h-[65vh] max-h-[65dvh] sm:max-h-[70vh] flex flex-col bg-white rounded-3xl shadow-2xl overflow-hidden transform scale-95 transition-transform duration-300" style="z-index:20001; max-height: 65dvh !important;">
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
                    <div class="px-5 py-4 sm:px-6 sm:py-5 space-y-4 overflow-y-auto overscroll-contain flex-1">
                        <div class="bg-indigo-50/50 p-4 rounded-2xl flex items-center justify-between mb-2 border border-indigo-100/50">
                            <span class="text-sm font-semibold text-indigo-900">Total à payer</span>
                            <div class="text-right">
                                <span id="${modalId}-total-amount" class="text-xl font-black text-indigo-600">${priceStr}</span>
                            </div>
                        </div>

                        ${hideQuantity ? '' : `
                        <div class="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                            <div class="flex items-center justify-between gap-3 mb-3">
                                <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider">Quantité</label>
                                <span id="${modalId}-stock-hint" class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">${stockLimit ? `Stock dispo: ${stockLimit}` : 'Quantité libre'}</span>
                            </div>
                            <div class="flex items-center gap-3">
                                <button type="button" id="${modalId}-qty-minus" class="-gray-200 text-gray-700 font-black text-2xl leading-none transition-colors flex items-center justify-center" aria-label="Réduire la quantité">−</button>
                                <input type="number" id="${modalId}-quantity" min="1" ${stockLimit ? `max="${stockLimit}"` : ''} value="${initialQuantity}" inputmode="numeric"
                                    class="flex-1 h-12 rounded-xl border border-gray-200 bg-gray-50 text-center text-base font-black text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                                <button type="button" id="${modalId}-qty-plus" class="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 font-black text-2xl leading-none hover:bg-gray-100 transition-colors flex items-center justify-center" aria-label="Augmenter la quantité">+</button>
                            </div>
                            <div id="${modalId}-qty-note" class="mt-3 text-[11px] text-gray-500 leading-snug">
                                La quantité modifie le total avant validation.
                            </div>
                        </div>
                        `}
                        <div>
                            <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Informations de livraison</label>
                            
                            <div class="space-y-3">
                                <div class="relative group">
                                    <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                        <iconify-icon icon="solar:user-bold" width="18"></iconify-icon>
                                    </div>
                                    <input type="text" id="${modalId}-name" placeholder="Nom complet" value="${escapeAttr(prefillName)}" required 
                                        class="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white outline-none transition-all placeholder:text-gray-400 font-medium">
                                </div>

                                <div class="relative group">
                                    <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                        <iconify-icon icon="solar:phone-bold" width="18"></iconify-icon>
                                    </div>
                                    <input type="tel" id="${modalId}-phone" placeholder="Numéro de tél. (ex: 070707...)" value="${escapeAttr(prefillPhone)}" required 
                                        class="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white outline-none transition-all placeholder:text-gray-400 font-medium">
                                </div>

                                <div class="relative group">
                                    <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                        <iconify-icon icon="solar:letter-bold" width="18"></iconify-icon>
                                    </div>
                                    <input type="email" id="${modalId}-email" value="${escapeAttr(prefillEmail)}" placeholder="Adresse Email" required 
                                        class="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white outline-none transition-all placeholder:text-gray-400 font-medium">
                                </div>

                                <div class="relative group">
                                    <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                        <iconify-icon icon="solar:map-point-bold" width="18"></iconify-icon>
                                    </div>
                                    <input type="text" id="${modalId}-city" value="${escapeAttr(prefillCity)}" placeholder="Ville" required 
                                        class="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white outline-none transition-all placeholder:text-gray-400 font-medium">
                                </div>
                            </div>
                            
                            <!-- Leaflet Map Setup -->
                            <div class="mt-4 pt-4 border-t border-gray-100">
                                <div class="flex items-center justify-between mb-2.5">
                                    <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider">Position de livraison</label>
                                    <div id="${modalId}-loc-badge" class="${savedHomeLocation ? '' : 'hidden '}px-2 py-0.5 bg-green-100 text-green-700 text-[9px] font-bold rounded-full uppercase tracking-tighter animate-pulse">Residence chargee</div>
                                </div>
                                <p class="text-[10px] text-gray-400 mb-3 leading-snug">La commande part de votre residence enregistree. Utilisez la geolocalisation seulement si vous voulez livrer ailleurs cette fois.</p>
                                
                                <!-- Locate Me Button -->
                                <button type="button" id="${modalId}-locate-btn" onclick="window._locateMe && window._locateMe('${modalId}')"
                                    class="w-full mb-3 px-4 py-3 bg-gradient-to-br from-indigo-600 via-indigo-600 to-purple-600 text-white font-bold rounded-2xl text-sm hover:shadow-lg hover:shadow-indigo-500/30 transition-all flex items-center justify-center gap-3 active:scale-[0.97] border border-white/10 ring-1 ring-indigo-400/20">
                                    <iconify-icon icon="solar:map-arrow-square-bold" width="20"></iconify-icon>
                                    <span id="${modalId}-locate-text">Utiliser ma position actuelle</span>
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
                                    <span>${savedHomeLocation ? 'Residence enregistree chargee dans la commande.' : 'Aucune residence enregistree. Localisez-vous ou deplacez le repere pour cette commande.'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="px-5 py-4 sm:px-6 sm:py-5 border-t border-gray-50 bg-gray-50 flex gap-3 flex-shrink-0">
                        <button data-track-action="checkout:cancel_click" onclick="closeCheckoutModal('${modalId}', null)" class="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm">
                            Annuler
                        </button>
                        <button data-track-action="checkout:pay_click" onclick="submitCheckoutModal('${modalId}')" class="flex-1 px-4 py-3 bg-green-600 text-white font-bold rounded-xl text-sm hover:bg-green-700 transition-colors shadow-sm shadow-green-600/30 flex items-center justify-center gap-2">
                            <iconify-icon icon="solar:card-bold" width="18"></iconify-icon>
                            Payer
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const mountedCheckoutModal = document.getElementById(modalId);
        if (mountedCheckoutModal) {
            mountedCheckoutModal.classList.add('nk-modal-overlay');
            document.documentElement.appendChild(mountedCheckoutModal);
        }
        
        const modalEl = document.getElementById(modalId);
        
        // Init Leaflet map if loaded
        let marker = null;
        let selectedLat = savedHomeLocation?.lat ?? null;
        let selectedLng = savedHomeLocation?.lng ?? null;
        const quantityInput = () => document.getElementById(`${modalId}-quantity`);
        const totalAmountEl = () => document.getElementById(`${modalId}-total-amount`);
        const qtyMinusBtn = () => document.getElementById(`${modalId}-qty-minus`);
        const qtyPlusBtn = () => document.getElementById(`${modalId}-qty-plus`);
        const stockHintEl = () => document.getElementById(`${modalId}-stock-hint`);
        const getClampedQuantity = () => {
            const raw = quantityInput()?.value;
            let q = Math.max(1, parseInt(raw, 10) || initialQuantity);
            if (stockLimit) q = Math.min(q, stockLimit);
            return q;
        };
        const syncQuantityUI = () => {
            const q = getClampedQuantity();
            const total = unitPrice * q;
            const input = quantityInput();
            if (input) input.value = String(q);
            if (totalAmountEl()) totalAmountEl().textContent = formatAmount(total);
            if (qtyMinusBtn()) qtyMinusBtn().disabled = q <= 1;
            if (qtyPlusBtn()) qtyPlusBtn().disabled = !!stockLimit && q >= stockLimit;
            if (stockHintEl()) {
                stockHintEl().textContent = stockLimit ? `Stock dispo: ${stockLimit}` : 'Quantité libre';
            }
            return q;
        };
        
        requestAnimationFrame(() => {
            modalEl.classList.remove('opacity-0');
            modalEl.querySelector('.transform').classList.remove('scale-95');
            
            // Allow modal transition to finish before init map (fixes grey boxes issue in Leaflet)
            setTimeout(() => {
                const mapContainer = document.getElementById(`${modalId}-map`);
                if (window.L && mapContainer) {
                    const defaultMapCenter = [-4.4419, 15.2663]; // Kinshasa by default
                    const initialZoom = savedHomeLocation ? 16 : 12;

                    // Fix for Leaflet Icon.Default.js removeChild NotFoundError
                    L.Icon.Default.imagePath = 'https://unpkg.com/leaflet@1.9.4/dist/images/';

                    const map = L.map(mapContainer).setView(defaultMapCenter, initialZoom);
                    
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        maxZoom: 18,
                        attribution: '© OpenStreetMap'
                    }).addTo(map);

                    marker = L.marker(defaultMapCenter, { draggable: true }).addTo(map);

                    // Realign map after render
                    map.invalidateSize();

                    marker.on('dragend', function(e) {
                        const position = marker.getLatLng();
                        selectedLat = position.lat;
                        selectedLng = position.lng;
                        // Update status text
                        const statusEl = document.getElementById(`${modalId}-loc-status`);
                        if (statusEl) {
                            statusEl.innerHTML = `<iconify-icon icon="solar:map-point-bold" width="12" style="color:#22c55e"></iconify-icon> <span style="color:#22c55e; font-weight:700;">Position ajustee manuellement pour cette commande</span>`;
                        }
                    });

                    // Store map reference for _locateMe
                    window._checkoutMapRef = map;
                    window._checkoutMarkerRef = marker;
                }
            }, 300);

            syncQuantityUI();
            quantityInput()?.addEventListener('input', syncQuantityUI);
            quantityInput()?.addEventListener('change', syncQuantityUI);
            qtyMinusBtn()?.addEventListener('click', () => {
                const input = quantityInput();
                if (!input) return;
                input.value = String(Math.max(1, getClampedQuantity() - 1));
                syncQuantityUI();
            });
            qtyPlusBtn()?.addEventListener('click', () => {
                const input = quantityInput();
                if (!input) return;
                const next = stockLimit ? Math.min(stockLimit, getClampedQuantity() + 1) : getClampedQuantity() + 1;
                input.value = String(next);
                syncQuantityUI();
            });

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
                try {
                    document.body.classList.remove('checkout-modal-open');
                } catch (_) {}
                resolve(result);
            }, 300);
        };

        window.submitCheckoutModal = async (id) => {
            if (id !== modalId) return;
            const name = document.getElementById(`${id}-name`).value.trim();
            const phone = document.getElementById(`${id}-phone`).value.trim();
            let email = document.getElementById(`${id}-email`).value.trim();
            const city = document.getElementById(`${id}-city`).value.trim();

            if (!phone) {
                showToast("Le numéro de téléphone est obligatoire", "warning");
                return;
            }
            
            if (!email) {
                // Best-effort fallback to authenticated email
                email = localStorage.getItem('newketUserEmail') || '';
                if (!email && window.SupabaseAdapter?.getClient) {
                    try {
                        const user = window.getSupabaseUser ? await window.getSupabaseUser(3000) : null;
                        email = user?.email || email;
                        if (email) localStorage.setItem('newketUserEmail', email);
                        if (user?.id) localStorage.setItem('newketUserId', user.id);
                    } catch (_) {}
                }

                if (!email) {
                    showToast("L'adresse email est obligatoire", "warning");
                    return;
                }
            }

            const quantityValue = syncQuantityUI();
            if (stockLimit && quantityValue > stockLimit) {
                showToast(`Quantite indisponible. Stock actuel: ${stockLimit}.`, "warning");
                return;
            }

            if (!Number.isFinite(selectedLat) || !Number.isFinite(selectedLng)) {
                showToast("Definissez d'abord la position de livraison sur la carte.", "warning");
                return;
            }

            // Persist checkout user inputs for next purchases.
            const checkoutRole =
                window.AuthManager?.role ||
                localStorage.getItem('newketRole') ||
                '';

            localStorage.setItem('newketUserPhone', phone || '');
            localStorage.setItem('newketUserEmail', email || '');
            localStorage.setItem('newketUserCity', city || '');

            const normalizedCheckoutName = nkNormalizeCheckoutNameCandidate(name);
            const safeCompanyName =
                checkoutRole === 'supplier' && !nkCheckoutNameLooksLikeRoleLabel(normalizedCheckoutName)
                    ? normalizedCheckoutName
                    : '';
            const safePersonName = (!nkCheckoutNameLooksLikeRoleLabel(normalizedCheckoutName)
                ? normalizedCheckoutName
                : nkDeriveCheckoutNameFromEmail(email));

            if (checkoutRole === 'supplier') {
                if (safeCompanyName) localStorage.setItem('newketCompany', safeCompanyName);
            } else if (safePersonName) {
                localStorage.setItem('newketUserName', safePersonName);
            }

            if (window.ProfileManager?.saveProfile) {
                const patch = {
                    phone: phone || undefined,
                    email: email || undefined,
                    city: city || undefined
                };
                if (checkoutRole === 'supplier') {
                    if (safeCompanyName) patch.company_name = safeCompanyName;
                } else if (safePersonName) {
                    patch.name = safePersonName;
                }
                window.ProfileManager.saveProfile(patch);
            }

            window.closeCheckoutModal(id, { 
                name: name || "Client Web", 
                phone, 
                email, 
                city: city || "Kinshasa",
                lat: selectedLat,
                lng: selectedLng,
                quantity: quantityValue
            });
        };
    });
}

/**
 * High-visibility announcement modal for admin broadcasts.
 * Anchored to the top-center, following the platform-wide notification pattern.
 */
window.showAnnouncementModal = (title, message, type = 'info', force = false, options = {}) => {
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
                        ${options && options.actionText && options.actionCallback ? `
                            <button id="nk-announcement-action-btn" class="flex-[2] px-8 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:shadow-xl hover:shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                                ${options.actionText}
                                <iconify-icon icon="solar:arrow-right-up-bold" width="18"></iconify-icon>
                            </button>
                            <button onclick="document.getElementById('nk-announcement-modal').remove()" class="flex-1 px-8 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all active:scale-95">
                                Fermer
                            </button>
                        ` : `
                            <button onclick="window.dismissAnnouncement('${title}')" class="flex-1 px-8 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all active:scale-95">
                                Ne plus afficher
                            </button>
                            <button onclick="document.getElementById('nk-announcement-modal').remove()" class="flex-[2] px-8 py-4 bg-gray-900 text-white font-bold rounded-2xl hover:shadow-xl hover:shadow-gray-900/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                                Compris
                                <iconify-icon icon="solar:arrow-right-up-bold" width="18"></iconify-icon>
                            </button>
                        `}
                    </div>
                </div>
            </div>
            
            <!-- Close Icon (Top Corner) -->
            <button onclick="document.getElementById('nk-announcement-modal').remove()" class="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-2xl bg-white/50 hover:bg-white text-gray-400 hover:text-gray-900 transition-all">
                <iconify-icon icon="solar:close-circle-bold" width="24"></iconify-icon>
            </button>
        </div>
    `;

    mountModalOverlay(modal);
    
    if (options && options.actionText && typeof options.actionCallback === 'function') {
        setTimeout(() => {
            const btn = document.getElementById('nk-announcement-action-btn');
            if (btn) {
                btn.addEventListener('click', () => {
                    options.actionCallback();
                    document.getElementById('nk-announcement-modal')?.remove();
                });
            }
        }, 50);
    }
    
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
    modal.className = 'nk-modal-overlay fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 opacity-0 transition-opacity duration-300 pointer-events-none';
    
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
                    <button onclick="window.closeConfirm('${modalId}', false)" class="flex-1 px-6 py-3.5 text-gray-600 font-bold transition-all active:scale-95">
                        Annuler
                    </button>
                    <button onclick="window.closeConfirm('${modalId}', true)" class="flex-1 px-6 py-3.5 bg-gray-900 text-white font-bold rounded-2xl hover:shadow-xl hover:shadow-gray-900/20 transition-all active:scale-95">
                        Confirmer
                    </button>
                </div>
            </div>
        </div>
    `;

    mountModalOverlay(modal);
    
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
 * Premium prompt replacement for window.prompt().
 * Returns a Promise<string|null>.
 */
window.showPromptModal = ({
    title = 'Saisie requise',
    message = '',
    label = 'Valeur',
    value = '',
    placeholder = '',
    type = 'text',
    inputMode = null,
    required = false,
    min = null,
    max = null,
    step = null,
    multiline = false,
    confirmText = 'Continuer',
    cancelText = 'Annuler'
} = {}) => {
    return new Promise((resolve) => {
        const modalId = 'nk-prompt-modal-' + Date.now();
        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'nk-modal-overlay fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 opacity-0 transition-opacity duration-300 pointer-events-none';

        const safeTitle = String(title || 'Saisie requise');
        const safeMessage = String(message || '');
        const safeLabel = String(label || 'Valeur');
        const safePlaceholder = String(placeholder || '');
        const initialValue = value === null || value === undefined ? '' : String(value);

        const fieldId = `${modalId}-field`;
        const isTextarea = Boolean(multiline);

        const fieldAttrs = [
            `id="${fieldId}"`,
            `placeholder="${safePlaceholder.replace(/"/g, '&quot;')}"`,
            required ? 'required' : '',
            !isTextarea ? `type="${String(type || 'text').replace(/"/g, '&quot;')}"` : '',
            inputMode ? `inputmode="${String(inputMode).replace(/"/g, '&quot;')}"` : '',
            min !== null && min !== undefined ? `min="${min}"` : '',
            max !== null && max !== undefined ? `max="${max}"` : '',
            step !== null && step !== undefined ? `step="${step}"` : '',
            'class="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:ring-4 focus:ring-gray-900/10 focus:border-gray-900 transition-all"'
        ].filter(Boolean).join(' ');

        modal.innerHTML = `
            <div class="absolute inset-0 bg-gray-950/40 backdrop-blur-sm" data-overlay="1"></div>
            <div class="relative bg-white/95 backdrop-blur-xl rounded-[2.5rem] shadow-2xl max-w-lg w-full border border-white/20 transform scale-95 transition-all duration-300 pointer-events-auto">
                <div class="p-8 sm:p-9">
                    <div class="flex items-start justify-between gap-4 mb-4">
                        <div class="min-w-0">
                            <p class="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">NewKet</p>
                            <h3 class="text-xl sm:text-2xl font-black text-gray-900 leading-tight">${safeTitle}</h3>
                        </div>
                        <button class="w-10 h-10 rounded-2xl bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-all flex items-center justify-center" data-close="1" aria-label="Fermer">
                            <iconify-icon icon="solar:close-circle-bold" width="22"></iconify-icon>
                        </button>
                    </div>

                    ${safeMessage ? `<p class="text-sm text-gray-500 font-medium leading-relaxed mb-5">${safeMessage}</p>` : ''}

                    <label class="block text-[11px] font-black uppercase tracking-widest text-gray-400">${safeLabel}</label>
                    ${isTextarea
                        ? `<textarea ${fieldAttrs} rows="4">${initialValue.replace(/</g, '&lt;')}</textarea>`
                        : `<input ${fieldAttrs} value="${initialValue.replace(/"/g, '&quot;')}">`
                    }
                    <p class="mt-2 text-[11px] font-bold text-red-600 hidden" id="${modalId}-error"></p>

                    <div class="mt-7 flex flex-col sm:flex-row gap-3">
                        <button class="flex-1 px-6 py-3.5 bg-gray-100 text-gray-700 font-black rounded-2xl hover:bg-gray-200 transition-all active:scale-95" data-cancel="1">
                            ${cancelText}
                        </button>
                        <button class="flex-[1.3] px-6 py-3.5 bg-gray-900 text-white font-black rounded-2xl hover:shadow-xl hover:shadow-gray-900/20 transition-all active:scale-95 flex items-center justify-center gap-2" data-confirm="1">
                            <span>${confirmText}</span>
                            <iconify-icon icon="solar:arrow-right-up-bold" width="18"></iconify-icon>
                        </button>
                    </div>
                </div>
            </div>
        `;

        const close = (result) => {
            const el = document.getElementById(modalId);
            if (!el) return;
            el.classList.add('opacity-0');
            const card = el.querySelector('.transform');
            if (card) card.classList.add('scale-95');
            setTimeout(() => {
                el.remove();
                resolve(result);
            }, 220);
        };

        mountModalOverlay(modal);

        // Animate in
        setTimeout(() => {
            modal.classList.remove('opacity-0', 'pointer-events-none');
            const card = modal.querySelector('.transform');
            if (card) card.classList.remove('scale-95');
        }, 10);

        const field = modal.querySelector(`#${fieldId}`);
        const errorEl = modal.querySelector(`#${modalId}-error`);
        const confirmBtn = modal.querySelector('[data-confirm="1"]');

        const validate = () => {
            if (!required) return true;
            const val = String(field?.value || '').trim();
            if (val) return true;
            if (errorEl) {
                errorEl.textContent = 'Veuillez renseigner ce champ.';
                errorEl.classList.remove('hidden');
            }
            return false;
        };

        const onConfirm = () => {
            if (!field) return close(null);
            if (!validate()) return;
            const raw = String(field.value ?? '');
            close(raw.trim());
        };

        modal.addEventListener('click', (e) => {
            const t = e.target;
            if (!(t instanceof Element)) return;
            if (t.matches('[data-overlay="1"]') || t.closest('[data-close="1"]') || t.closest('[data-cancel="1"]')) {
                close(null);
                return;
            }
            if (t.closest('[data-confirm="1"]')) {
                onConfirm();
            }
        });

        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                close(null);
            }
            if (e.key === 'Enter' && !isTextarea) {
                // Submit on enter for single-line fields
                e.preventDefault();
                onConfirm();
            }
        });

        if (field) {
            // Reset error on input
            field.addEventListener('input', () => {
                if (errorEl) errorEl.classList.add('hidden');
            });
            setTimeout(() => {
                field.focus();
                try { field.select?.(); } catch (_) {}
            }, 30);
        } else if (confirmBtn) {
            confirmBtn.focus();
        }
    });
};

  /**
   * Initiates the order creation flow.
   * Payment now happens only after the vendor sends a delivery quote and the client accepts it.
   */
  window.initCheckout = async (productId, btnElement, quantity = 1) => {
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

        const requestedQuantity = Math.max(1, parseInt(quantity, 10) || 1);
        const stock = Number(p.stock ?? p.stock_quantity ?? p.quantity ?? 0);
        if (Number.isFinite(stock) && stock > 0 && requestedQuantity > stock) {
            showToast(`Quantite indisponible. Stock actuel: ${stock}.`, 'warning');
            btnElement.innerHTML = originalHtml;
            btnElement.disabled = false;
            return;
        }

        try {
            window.BehaviorTracking?.track?.('checkout_start', {
                target: 'checkout:start',
                metadata: {
                    product_id: p.id || productId || null,
                    quantity: requestedQuantity,
                    price: Number(p.price || 0) || null,
                }
            });
        } catch (_) {}

        // Show a quick modal to collect customer info (Phone & City & Email for Netikash)
        const customerInfo = await showCheckoutModal(p.name, p.price, requestedQuantity, stock);
        if (!customerInfo) {
            btnElement.innerHTML = originalHtml;
            btnElement.disabled = false;
            return; // Cancelled
        }

        const {
            name: customerName,
            phone: customerPhone,
            city: customerCity,
            email: customerEmail,
            lat: customerLat,
            lng: customerLng
        } = customerInfo;

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

          const finalQuantity = Math.max(1, parseInt(customerInfo.quantity ?? requestedQuantity, 10) || requestedQuantity);

          const data = await window.ApiClient.post('/orders', {
              product_id: p.id,
              vendor_id: p.user_id,
              quantity: finalQuantity,
              customer_phone: customerPhone,
              customer_name: customerName,
              customer_city: customerCity,
              // Let backend default to authenticated email when empty.
              customer_email: customerEmail || null,
              customer_lat: customerLat,
              customer_lng: customerLng
          });

          if (!data?.success) {
              showToast(data.error || "Erreur lors de l'envoi de la demande", "error");
              btnElement.innerHTML = originalHtml;
              btnElement.disabled = false;
              return;
          }

          try {
              window.BehaviorTracking?.track?.('checkout_submit', {
                  target: 'checkout:submit',
                  metadata: {
                      product_id: p.id || productId || null,
                      quantity: finalQuantity,
                      vendor_id: p.vendor_id || p.user_id || null,
                  }
              });
          } catch (_) {}

          showToast("Demande envoyée au vendeur. Il doit maintenant proposer le devis de livraison.", "success");
          btnElement.innerHTML = originalHtml;
          btnElement.disabled = false;

      } catch (err) {
          console.error('[NewKet] Checkout error:', err);
        const msg = err?.message || '';
        const isBackendDown = /ERR_CONNECTION_REFUSED|Failed to fetch|NetworkError|Load failed/i.test(msg);
        showToast(
            isBackendDown
                ? "API indisponible (backend). Lance `npm run dev:backend` puis recharge la page."
                : "Erreur lors de l'envoi de la demande.",
            "error"
        );
          btnElement.innerHTML = originalHtml;
          btnElement.disabled = false;
      }
  };

  // Backward-compat: some pages still call `window.contactSeller(...)` for the "Commander" button.
  // Map it to the new checkout flow so ordering works everywhere (catalog/shop/favorites/dashboard).
  if (!window.contactSeller) {
      window.contactSeller = (productId, btnElement) => {
          const fromEvent =
              window.event?.target?.closest?.('button') ||
              window.event?.target?.closest?.('[role=\"button\"]') ||
              null;

          let resolvedBtn = btnElement || fromEvent;
          if (!resolvedBtn && productId) {
              const esc = (s) => {
                  try { return window.CSS?.escape ? window.CSS.escape(String(s)) : String(s).replace(/\"/g, '\\\"'); }
                  catch (_) { return String(s).replace(/\"/g, '\\\"'); }
              };
              resolvedBtn = document.querySelector(`button[data-product-id="${esc(productId)}"]`);
          }

          if (!window.initCheckout) {
              window.showToast?.('Checkout non initialisé.', 'error');
              return;
          }
          if (!resolvedBtn) {
              window.showToast?.("Impossible de lancer la commande (bouton introuvable).", 'error');
              return;
          }

          return window.initCheckout(productId, resolvedBtn);
      };
  }

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

export function initLazyImages(root = document) {
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

                    const srcset = img.dataset.srcset;
                    const sizes = img.dataset.sizes;
                    if (srcset) img.srcset = srcset;
                    if (sizes) img.sizes = sizes;

                    // Swap the src
                    img.src = src;
                    img.style.opacity = '0';

                    img.onload = () => {
                        img.style.opacity = '1';
                        img.removeAttribute('data-src');
                        img.removeAttribute('data-srcset');
                        img.removeAttribute('data-sizes');
                    };
                    img.onerror = () => {
                        img.style.opacity = '1';
                        img.removeAttribute('data-src');
                        img.removeAttribute('data-srcset');
                        img.removeAttribute('data-sizes');
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
                if (img.dataset.srcset) img.srcset = img.dataset.srcset;
                if (img.dataset.sizes) img.sizes = img.dataset.sizes;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                img.removeAttribute('data-srcset');
                img.removeAttribute('data-sizes');
            }
        });
    }
}

/**
 * Gets a consistent color based on a string (for avatars).
 */
export function getAvatarColor(name) {
    if (!name) return '#6366f1';
    const palette = [
        '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
        '#10b981', '#3b82f6', '#f97316', '#14b8a6',
        '#64748b', '#0ea5e9'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return palette[Math.abs(hash) % palette.length];
}

/**
 * Gets initials from a full name.
 */
export function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Renders an avatar with image fallback to initials.
 * Supports both complex (img + placeholder) and simple (single div) displays.
 */
export function renderAvatar(name, url, imgId, placeholderId) {
    const img = document.getElementById(imgId);
    const placeholder = document.getElementById(placeholderId);
    
    // If we have a dedicated placeholder element (like in Vendor/Admin dashboards)
    if (img && placeholder) {
        // Sanitize URL
        const isValidUrl = url && url !== 'null' && url !== 'undefined' && url !== '' && typeof url === 'string';
        
        if (isValidUrl) {
            img.src = url;
            img.classList.remove('hidden');
            placeholder.classList.add('hidden');
            
            img.onerror = () => {
                img.classList.add('hidden');
                placeholder.classList.remove('hidden');
                // Ensure placeholder parent has a color if img fails
                const parent = placeholder.parentElement;
                if (parent) {
                    parent.style.backgroundColor = getAvatarColor(name);
                    parent.classList.remove('bg-black'); // Remove default black if present
                }
            };
        } else {
            img.classList.add('hidden');
            placeholder.classList.remove('hidden');
            const parent = placeholder.parentElement;
            if (parent) {
                parent.style.backgroundColor = getAvatarColor(name);
                parent.classList.remove('bg-black');
            }
        }
    }
    
    // If we have a simple display element (like in Customer dashboard or Mini-profile)
    const simpleDisplay = document.getElementById('userAvatarDisplay');
    if (simpleDisplay) {
        const innerImg = simpleDisplay.querySelector('img');
        const innerPlaceholder = simpleDisplay.querySelector('span');
        const initials = getInitials(name);
        const hasDedicatedAvatar = Boolean(innerImg && innerPlaceholder);
        const isValidUrl = url && url !== 'null' && url !== 'undefined' && url !== '' && typeof url === 'string';

        // Keep the customer dashboard avatar visually aligned with the index header:
        // neutral circular badge instead of role-colored backgrounds.
        simpleDisplay.style.background = 'rgba(15, 23, 42, 0.92)';
        simpleDisplay.style.color = '#fff';

        if (hasDedicatedAvatar) {
            innerPlaceholder.textContent = initials;

            if (isValidUrl) {
                innerImg.src = url;
                innerImg.classList.remove('hidden');
                innerPlaceholder.classList.add('hidden');
                innerImg.onerror = () => {
                    innerImg.classList.add('hidden');
                    innerPlaceholder.classList.remove('hidden');
                };
            } else {
                innerImg.classList.add('hidden');
                innerPlaceholder.classList.remove('hidden');
            }
        } else {
            simpleDisplay.textContent = initials;
        }
    }
}

/**
 * ThemeManager
 * Gère le mode clair/sombre de l'application via TailwindCSS (class 'dark' sur html)
 * et sauvegarde la préférence dans le localStorage.
 */
export const ThemeManager = {
    _boundToggleHandler: false,
    getPageThemeDefault() {
        return document.documentElement.dataset.themeDefault || document.body?.dataset.themeDefault || 'system';
    },

    init() {
        // Dark mode removed: force light theme and clear any stored preference.
        try { document.documentElement.classList.remove('dark'); } catch {}
        try { localStorage.removeItem('newket_theme'); } catch {}
    },
    
    toggle() {
        // noop (dark mode removed)
        this.init();
    },
    
    updateUI() {
        // noop (dark mode removed)
    },

    bindToggleEvents() {
        // noop (dark mode removed)
    },

    // Alias pour components-loader.js
    _syncToggleUI() {
        this.updateUI();
    }
};

// Initialisation immédiate pour éviter le FOUC au maximum
ThemeManager.init();

window.showToast = showToast;
window.normalizeNotificationType = normalizeNotificationType;
window.isPopupNotification = isPopupNotification;
window.debounce = debounce;
window.buildProductCardHTML = buildProductCardHTML;
window.setProductSwipeContext = setProductSwipeContext;
window.buildSkeletonCardHTML = buildSkeletonCardHTML;
window.buildSkeletonDashboardStatsHTML = buildSkeletonDashboardStatsHTML;
window.buildSkeletonActivityHTML = buildSkeletonActivityHTML;
window.buildSkeletonNotificationHTML = buildSkeletonNotificationHTML;
window.buildSkeletonShopCardHTML = buildSkeletonShopCardHTML;
window.buildSkeletonPanelListHTML = buildSkeletonPanelListHTML;
window.buildSkeletonTableRowsHTML = buildSkeletonTableRowsHTML;
window.buildSkeletonIncidentListHTML = buildSkeletonIncidentListHTML;
window.buildStarsHTML = buildStarsHTML;
window.getOptimizedImageUrl = getOptimizedImageUrl;
window.buildResponsiveImageSrcSet = buildResponsiveImageSrcSet;
window.initLazyImages = initLazyImages;
window.getAvatarColor = getAvatarColor;
window.getInitials = getInitials;
window.renderAvatar = renderAvatar;
window.SidebarManager = SidebarManager;
window.ThemeManager = ThemeManager;

/**
 * Logout-specific confirmation notification.
 * Appears from the top, like an announcement but with actions.
 */
window.showLogoutConfirm = () => {
    return new Promise((resolve) => {
        const modalId = 'logout-confirm-' + Date.now();
        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'nk-modal-overlay fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 pointer-events-none transition-opacity duration-400 opacity-0';
        
        modal.innerHTML = `
            <div class="absolute inset-0 bg-gray-900/40 backdrop-blur-[4px] pointer-events-auto transition-opacity duration-500 opacity-0" id="${modalId}-backdrop" onclick="window._closeLogoutConfirm('${modalId}', false)"></div>
            <div class="relative bg-white/95 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl max-w-sm w-full pointer-events-auto border border-white/60 transform scale-95 translate-y-4 opacity-0 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] overflow-hidden" id="${modalId}-content">
                <div class="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-red-400 to-rose-600 rounded-full blur-[3rem] opacity-20 pointer-events-none"></div>
                <div class="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-tr from-orange-400 to-amber-500 rounded-full blur-[3rem] opacity-20 pointer-events-none"></div>

                <div class="p-8 relative z-10 text-center flex flex-col items-center">
                    <div class="w-20 h-20 rounded-[1.5rem] bg-gradient-to-br from-red-50 to-orange-50 border border-red-100/50 flex items-center justify-center shadow-inner mb-6 relative group transition-transform duration-500 hover:scale-110">
                        <div class="absolute inset-0 bg-red-500 rounded-[1.5rem] blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                        <iconify-icon icon="solar:logout-3-bold" class="text-red-500 text-4xl relative z-10 drop-shadow-sm group-hover:scale-110 transition-transform duration-500"></iconify-icon>
                    </div>
                    
                    <h3 class="text-2xl font-black text-gray-900 leading-tight mb-2 tracking-tight">Déconnexion</h3>
                    <p class="text-[11px] text-red-500 font-bold uppercase tracking-[0.2em] mb-4 bg-red-50 px-3 py-1 rounded-full border border-red-100">Session NewKet</p>
                    
                    <p class="text-[14px] text-gray-500 font-medium leading-relaxed mb-8">
                        Êtes-vous sûr de vouloir fermer votre session ? Vous devrez vous reconnecter pour accéder à votre compte.
                    </p>
                    
                    <div class="flex flex-col gap-3 w-full">
                        <button onclick="window._closeLogoutConfirm('${modalId}', true)" class="w-full px-5 py-4 bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold rounded-[1.25rem] shadow-[0_8px_16px_-4px_rgba(239,68,68,0.3)] hover:shadow-[0_16px_24px_-4px_rgba(239,68,68,0.5)] hover:-translate-y-1 transition-all duration-300 active:scale-[0.98] text-[15px] flex items-center justify-center gap-2 group relative overflow-hidden">
                            <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-[800ms] ease-in-out skew-x-12"></div>
                            <span class="relative z-10 transition-transform duration-300 group-hover:translate-x-1">Oui, me déconnecter</span>
                            <iconify-icon icon="solar:logout-3-bold" width="18" class="relative z-10 transition-transform duration-300 group-hover:translate-x-2 group-hover:rotate-6"></iconify-icon>
                        </button>
                        <button onclick="window._closeLogoutConfirm('${modalId}', false)" class="w-full px-5 py-4 bg-white hover:bg-gray-50 text-gray-700 font-bold rounded-[1.25rem] transition-all duration-300 active:scale-[0.98] text-[15px] border-2 border-gray-100 hover:border-gray-200 hover:-translate-y-1 hover:shadow-md flex items-center justify-center">
                            Rester connecté
                        </button>
                    </div>
                </div>
            </div>
        `;

        mountModalOverlay(modal);

        // Animate in
        requestAnimationFrame(() => {
            modal.classList.remove('opacity-0');
            const backdrop = document.getElementById(`${modalId}-backdrop`);
            const content = document.getElementById(`${modalId}-content`);
            if (backdrop) backdrop.classList.remove('opacity-0');
            if (content) {
                content.classList.remove('scale-95', 'translate-y-4', 'opacity-0');
            }
        });

        window._closeLogoutConfirm = (id, result) => {
            const el = document.getElementById(id);
            if (!el) return;
            const backdrop = document.getElementById(`${id}-backdrop`);
            const content = document.getElementById(`${id}-content`);
            
            if (backdrop) backdrop.classList.add('opacity-0');
            if (content) {
                content.style.transitionTimingFunction = 'cubic-bezier(0.4, 0, 0.2, 1)';
                content.style.transitionDuration = '400ms';
                content.classList.add('scale-95', 'translate-y-4', 'opacity-0');
            }
            el.classList.add('opacity-0');
            
            setTimeout(() => {
                el.remove();
                delete window._closeLogoutConfirm;
                resolve(result);
            }, 400); // Wait for transition
        };
    });
};

/**
 * Shows an inline message (error or success) below a specific button.
 * It automatically handles creating the message element if it doesn't exist,
 * and clears it when the user modifies inputs in the same form/container.
 * 
 * @param {HTMLElement} buttonElement - The button that triggered the action
 * @param {string} message - The message to display
 * @param {string} type - 'error' or 'success'
 */
export function showInlineFeedback(buttonElement, message, type = 'error') {
    if (!buttonElement) return;

    // Remove any existing inline feedback to prevent duplicates
    clearInlineFeedback(buttonElement);

    // Create the message container
    const msgContainer = document.createElement('div');
    msgContainer.className = 'nk-inline-feedback text-xs font-semibold mt-2 text-center w-full break-words';
    
    // Set colors based on type
    if (type === 'error') {
        msgContainer.classList.add('text-red-600');
    } else {
        msgContainer.classList.add('text-emerald-600');
    }

    msgContainer.textContent = message;
    
    // Insert after the button
    buttonElement.parentNode.insertBefore(msgContainer, buttonElement.nextSibling);

    // Add listener to inputs in the closest parent (e.g., form or card) to clear the message
    const parent = buttonElement.closest('form') || buttonElement.closest('.card') || buttonElement.parentElement;
    if (parent) {
        const inputs = parent.querySelectorAll('input, textarea, select');
        const clearMsg = () => {
            clearInlineFeedback(buttonElement);
            inputs.forEach(input => input.removeEventListener('input', clearMsg));
            inputs.forEach(input => input.removeEventListener('change', clearMsg));
        };
        inputs.forEach(input => {
            input.addEventListener('input', clearMsg);
            input.addEventListener('change', clearMsg);
        });
    }
}

/**
 * Clears the inline feedback below a specific button.
 */
export function clearInlineFeedback(buttonElement) {
    if (!buttonElement) return;
    const nextEl = buttonElement.nextElementSibling;
    if (nextEl && nextEl.classList.contains('nk-inline-feedback')) {
        nextEl.remove();
    }
}

// Make them available globally
window.showInlineFeedback = showInlineFeedback;
window.clearInlineFeedback = clearInlineFeedback;
