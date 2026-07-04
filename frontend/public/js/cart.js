/**
 * NewKet Cart Manager
 * Handles the state of the shopping cart using LocalStorage
 */

class CartManager {
    constructor() {
        this.STORAGE_KEY = 'newket_cart';
        this.cart = this.loadCart();
        this.initialized = false;
        this.lastClickEvent = null;
        
        // Listen for storage changes from other tabs
        window.addEventListener('storage', (e) => {
            if (e.key === this.STORAGE_KEY) {
                this.cart = this.loadCart();
                this.updateUI();
            }
        });

        // Track last click/touch for animations
        document.addEventListener('click', (e) => {
            this.lastClickEvent = e;
        }, true);

        // Also track touchstart for mobile fly animation
        document.addEventListener('touchstart', (e) => {
            this._lastTouch = e.touches[0];
        }, { passive: true, capture: true });
        document.addEventListener('touchend', (e) => {
            if (this._lastTouch && !this.lastClickEvent) {
                // Fabricate a click-like event from the last touch
                this.lastClickEvent = { clientX: this._lastTouch.clientX, clientY: this._lastTouch.clientY };
            }
        }, { passive: true, capture: true });
    }

    init() {
        if (this.initialized) return;
        this.updateUI();
        this.initialized = true;
        console.log('[CartManager] Initialized with', this.cart.length, 'items');
    }

    loadCart() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Failed to load cart from localStorage', e);
            return [];
        }
    }

    saveCart() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.cart));
            this.updateUI();
        } catch (e) {
            console.error('Failed to save cart to localStorage', e);
        }
    }

    /**
     * Add an item to the cart
     * @param {Object} product - The product object to add { id, title, price, image, vendor, etc. }
     * @param {number} quantity - Quantity to add
     */
    add(product, quantity = 1) {
        if (!product || !product.id) return;

        const existingItem = this.cart.find(item => item.id === product.id);
        
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            this.cart.push({
                ...product,
                quantity: quantity
            });
        }
        
        this.saveCart();

        // Update lastClickEvent from touch if no click event
        if (!this.lastClickEvent && this._lastTouch) {
            this.lastClickEvent = { clientX: this._lastTouch.clientX, clientY: this._lastTouch.clientY };
        }

        // Trigger fly-to-cart animation
        this.animateFlyToCart(product.image, this.lastClickEvent);
        // Reset after use so it doesn't repeat on next add
        setTimeout(() => { this.lastClickEvent = null; this._lastTouch = null; }, 700);
    }

    animateFlyToCart(imageUrl, clickEvent) {
        if (!clickEvent) return;
        
        const cartSelectors = '[title="Panier"], [aria-label="Panier"], [aria-label="Mon panier"], [aria-label="Voir le panier"], .cart-badge';
        const cartButtons = Array.from(document.querySelectorAll(cartSelectors));
        // Sort by whether they are visible (width/height > 0) and prefer elements that are more likely to be the actual icon
        const visibleCartBtn = cartButtons.find(btn => {
            const rect = btn.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && window.getComputedStyle(btn).display !== 'none' && window.getComputedStyle(btn).visibility !== 'hidden';
        }) || cartButtons[0];
        if (!visibleCartBtn) return;
        
        const cartRect = visibleCartBtn.getBoundingClientRect();
        const startX = clickEvent.clientX;
        const startY = clickEvent.clientY;
        const endX = cartRect.left + cartRect.width / 2;
        const endY = cartRect.top + cartRect.height / 2;
        
        const flyEl = document.createElement('div');
        flyEl.style.position = 'fixed';
        flyEl.style.left = startX + 'px';
        flyEl.style.top = startY + 'px';
        flyEl.style.width = '50px';
        flyEl.style.height = '50px';
        flyEl.style.borderRadius = '50%';
        flyEl.style.backgroundImage = imageUrl ? `url(${imageUrl})` : 'none';
        flyEl.style.backgroundSize = 'cover';
        flyEl.style.backgroundPosition = 'center';
        flyEl.style.backgroundColor = '#013220';
        flyEl.style.zIndex = '999999';
        flyEl.style.transition = 'all 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
        flyEl.style.transform = 'translate(-50%, -50%) scale(1)';
        flyEl.style.pointerEvents = 'none';
        flyEl.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)';
        
        document.body.appendChild(flyEl);
        
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                flyEl.style.left = endX + 'px';
                flyEl.style.top = endY + 'px';
                flyEl.style.transform = 'translate(-50%, -50%) scale(0.2)';
                flyEl.style.opacity = '0.5';
            });
        });
        
        setTimeout(() => {
            if (document.body.contains(flyEl)) document.body.removeChild(flyEl);
            const originalTransform = visibleCartBtn.style.transform;
            visibleCartBtn.style.transform = 'scale(1.2)';
            visibleCartBtn.style.transition = 'transform 0.2s';
            setTimeout(() => {
                visibleCartBtn.style.transform = originalTransform;
            }, 200);
        }, 600);
    }



    /**
     * Update quantity of an item
     */
    updateQuantity(productId, newQuantity) {
        if (newQuantity <= 0) {
            this.remove(productId);
            return;
        }

        const item = this.cart.find(item => item.id === productId);
        if (item) {
            item.quantity = newQuantity;
            this.saveCart();
            this.renderCartItems(); // Re-render inside slide-over
        }
    }

    /**
     * Remove an item from the cart
     */
    remove(productId) {
        this.cart = this.cart.filter(item => item.id !== productId);
        this.saveCart();
        this.renderCartItems();
    }

    /**
     * Clear the entire cart
     */
    clear() {
        this.cart = [];
        this.saveCart();
        this.renderCartItems();
    }

    /**
     * Get the total number of items
     */
    getTotalCount() {
        return this.cart.reduce((total, item) => total + item.quantity, 0);
    }

    /**
     * Get the total price
     */
    getTotalPrice() {
        return this.cart.reduce((total, item) => {
            const price = parseFloat(item.price) || 0;
            return total + (price * item.quantity);
        }, 0);
    }
    
    getItems() {
        return this.cart;
    }

    /**
     * Updates cart UI elements across the page
     */
    updateUI() {
        // Dispatch custom event for complex UI like the slide-over
        window.dispatchEvent(new CustomEvent('cartUpdated', { detail: this.cart }));

        // Update all badges on the page
        const count = this.getTotalCount();
        const badges = document.querySelectorAll('.cart-badge');
        
        badges.forEach(badge => {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        });
    }

    // Toggle the slide-over Cart UI
    toggleCartUI(forceShow = false) {
        const cartUI = document.getElementById('cartSlideOver');
        const overlay = document.getElementById('cartOverlay');
        
        if (!cartUI) {
            this.injectCartUI();
            // Allow DOM to update before showing
            setTimeout(() => this._showSlideOver(), 10);
            return;
        }
        
        if (forceShow || cartUI.classList.contains('translate-x-full')) {
            this._showSlideOver();
        } else {
            this._hideSlideOver();
        }
    }
    
    _showSlideOver() {
        const cartUI = document.getElementById('cartSlideOver');
        const overlay = document.getElementById('cartOverlay');
        if (cartUI && overlay) {
            overlay.classList.remove('opacity-0', 'pointer-events-none');
            cartUI.classList.remove('translate-x-full');
            // Use global scroll lock if available (works with position:fixed technique)
            if (typeof window._newketLockScroll === 'function') {
                window._newketLockScroll();
            } else {
                document.body.style.overflow = 'hidden';
            }
            this.renderCartItems();
        }
    }
    
    _hideSlideOver() {
        const cartUI = document.getElementById('cartSlideOver');
        const overlay = document.getElementById('cartOverlay');
        if (cartUI && overlay) {
            overlay.classList.add('opacity-0', 'pointer-events-none');
            cartUI.classList.add('translate-x-full');
            // Use global scroll unlock if available (restores position + top correctly)
            if (typeof window._newketUnlockScroll === 'function') {
                window._newketUnlockScroll();
            } else {
                document.body.style.overflow = '';
                document.body.style.removeProperty('overflow');
            }
        }
    }

    async checkout() {
        if (this.cart.length === 0) {
            if (window.showToast) window.showToast("Votre panier est vide.", "warning");
            return;
        }

        const total = this.cart.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
        const description = "Commande de " + this.cart.length + " article(s)";

        if (window.showCheckoutModal) {
            const customerInfo = await window.showCheckoutModal(description, total, 1, 999, true);
            if (!customerInfo) return; // Cancelled

            if (window.SupabaseAdapter) {
                const session = await window.SupabaseAdapter.getSession(3000);
                if (!session?.access_token) {
                    if (window.showToast) window.showToast('Vous devez être connecté pour passer une commande.', 'warning');
                    return;
                }
            }

            const { name, phone, city, email, lat, lng } = customerInfo;
            
            this.toggleCartUI(false);
            if (window.showToast) window.showToast("Création de votre commande en cours...", "info");

            let hasError = false;
            for (const item of this.cart) {
                const data = await window.ApiClient?.post('/orders', {
                    product_id: item.id,
                    vendor_id: item.vendor_id || item.vendor, // Assuming we pass vendor_id when adding
                    quantity: item.quantity,
                    customer_phone: phone,
                    customer_name: name,
                    customer_city: city,
                    customer_email: email || null,
                    customer_lat: lat,
                    customer_lng: lng
                });
                if (!data?.success) {
                    hasError = true;
                    console.error("Order error for item", item.id, data?.error);
                }
            }

            if (hasError) {
                if (window.showToast) window.showToast("Certains articles n'ont pas pu être commandés.", "error");
            } else {
                this.cart = [];
                this.saveCart();
                this.renderCartItems();
                
                if (window.showOrderSuccessModal) {
                    window.showOrderSuccessModal();
                } else if (window.showToast) {
                    window.showToast("Commande passée avec succès !", "success");
                }
            }
        } else {
            console.error("La fonction showCheckoutModal est introuvable.");
        }
    }

    renderCartItems() {
        const container = document.getElementById('cartItemsContainer');
        const totalEl = document.getElementById('cartTotalPrice');
        if (!container) return;

        const items = this.getItems();
        
        if (items.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-gray-500 py-12">
                    <iconify-icon icon="solar:cart-large-minimalistic-linear" width="48" class="mb-4 opacity-50"></iconify-icon>
                    <p class="font-medium text-lg">Votre panier est vide</p>
                    <p class="text-sm mt-1">Commencez vos achats !</p>
                    <button onclick="window.CartManager._hideSlideOver()" class="mt-6 px-6 py-2 bg-slate-900 text-white rounded-xl font-bold btn-active-scale hover:bg-slate-800 transition-colors">
                        Explorer le catalogue
                    </button>
                </div>
            `;
            if (totalEl) totalEl.innerHTML = this.formatCurrency(0);
            document.getElementById('cartCheckoutBtn')?.setAttribute('disabled', 'true');
            document.getElementById('cartCheckoutBtn')?.classList.add('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
            return;
        }

        document.getElementById('cartCheckoutBtn')?.removeAttribute('disabled');
        document.getElementById('cartCheckoutBtn')?.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none');

        let html = '<div class="space-y-4">';
        items.forEach(item => {
            const priceFormatted = this.formatCurrency(item.price);
            html += `
                <div class="flex gap-4 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm relative">
                    <div class="w-20 h-20 bg-gray-50 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                        <img src="${item.image && item.image !== '/Images/placeholder.png' ? item.image : 'https://res.cloudinary.com/dzhnphyp3/image/upload/v1782572380/newket_assets/frontend/src/assets/Images/default.jpg'}" alt="${item.title}" class="w-full h-full object-cover">
                    </div>
                    <div class="flex-1 flex flex-col justify-between py-1">
                        <div class="pr-6">
                            <h4 class="text-sm font-bold text-gray-900 line-clamp-1">${item.title}</h4>
                            <p class="text-xs text-gray-500 mt-0.5">${item.vendor || 'NewKet'}</p>
                        </div>
                        <div class="flex items-center justify-between mt-2">
                            <div class="font-black text-slate-900 text-sm">${priceFormatted}</div>
                            <div class="flex items-center gap-2 bg-gray-50 rounded-lg p-1 border border-gray-100">
                                <button onclick="window.CartManager.updateQuantity('${item.id}', ${item.quantity - 1})" class="w-6 h-6 flex items-center justify-center rounded-md bg-white shadow-sm hover:bg-gray-100 text-gray-700 font-bold text-lg">
                                    −
                                </button>
                                <span class="text-xs font-bold w-4 text-center">${item.quantity}</span>
                                <button onclick="window.CartManager.updateQuantity('${item.id}', ${item.quantity + 1})" class="w-6 h-6 flex items-center justify-center rounded-md bg-white shadow-sm hover:bg-gray-100 text-gray-700 font-bold text-lg">
                                    +
                                </button>
                            </div>
                        </div>
                    </div>
                    <button onclick="window.CartManager.remove('${item.id}')" class="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <iconify-icon icon="solar:trash-bin-trash-linear" width="16"></iconify-icon>
                    </button>
                </div>
            `;
        });
        html += '</div>';
        
        container.innerHTML = html;
        if (totalEl) {
            totalEl.innerHTML = this.formatCurrency(this.getTotalPrice());
        }
    }

    formatCurrency(amount) {
        if (window.CurrencyManager && window.CurrencyManager.formatPrice) {
            return window.CurrencyManager.formatPrice(amount);
        }
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD' }).format(amount || 0);
    }

    injectCartUI() {
        if (document.getElementById('cartSlideOver')) return;

        const cartHtml = `
            <!-- Cart Overlay -->
            <div id="cartOverlay" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] opacity-0 pointer-events-none transition-opacity duration-300" onclick="window.CartManager._hideSlideOver()"></div>
            
            <!-- Cart Slide-over -->
            <div id="cartSlideOver" role="dialog" aria-modal="true" aria-label="Panier" class="fixed top-0 right-0 h-full w-full bg-gray-50 z-[10001] transform translate-x-full transition-transform duration-300 ease-in-out shadow-2xl flex flex-col overscroll-contain">
                <!-- Header -->
                <div class="px-6 py-5 flex items-center justify-between shrink-0" style="background:#013220; border-bottom:1px solid rgba(1,50,32,0.6);">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full text-white flex items-center justify-center" style="background:rgba(255,255,255,0.15);">
                            <iconify-icon icon="solar:cart-large-minimalistic-bold" width="20"></iconify-icon>
                        </div>
                        <h2 class="text-lg font-black uppercase tracking-widest text-white">Mon Panier</h2>
                    </div>
                    <button onclick="window.CartManager._hideSlideOver()" class="p-2 rounded-xl text-white transition-colors btn-active-scale" style="hover:background:rgba(255,255,255,0.1);">
                        <iconify-icon icon="solar:close-circle-linear" width="24"></iconify-icon>
                    </button>
                </div>
                
                <!-- Items list -->
                <div id="cartItemsContainer" class="flex-1 overflow-y-auto p-4 sm:p-6 overscroll-contain" style="scrollbar-width: thin;">
                    <!-- Items rendered here dynamically -->
                </div>
                
                <!-- Footer / Checkout -->
                <div class="bg-white border-t border-gray-100 p-6 shrink-0 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
                    <div class="flex items-center justify-between mb-4">
                        <span class="text-sm font-semibold text-gray-500 uppercase tracking-widest">Total estimé</span>
                        <span id="cartTotalPrice" class="text-xl font-black text-slate-900">$0.00</span>
                    </div>
                    <p class="text-[10px] text-gray-400 text-center mb-4">Les frais de livraison seront calculés à l'étape suivante.</p>
                    <button onclick="if(window.CartManager) window.CartManager.checkout()" id="cartCheckoutBtn" class="flex items-center justify-center gap-2 w-full bg-slate-900 text-white py-4 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-colors btn-active-scale shadow-lg shadow-slate-900/20">
                        Passer à la caisse <iconify-icon icon="solar:arrow-right-linear" width="18"></iconify-icon>
                    </button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', cartHtml);
        
        // Setup initial listener for when currency might change
        window.addEventListener('currencyChanged', () => {
            if (!document.getElementById('cartSlideOver')?.classList.contains('translate-x-full')) {
                this.renderCartItems();
            }
        });
    }
}

window.CartManager = new CartManager();
window.addEventListener('DOMContentLoaded', () => {
    window.CartManager.init();
});
