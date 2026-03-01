/* newket EMarket Cart Manager */

const CartManager = {
    // Get cart from localStorage
    getCart() {
        const cart = localStorage.getItem('newketCart');
        return cart ? JSON.parse(cart) : [];
    },

    // Save cart to localStorage (and sync to Supabase if logged in)
    saveCart(cart) {
        console.log('[NewKet] Saving cart:', cart);
        localStorage.setItem('newketCart', JSON.stringify(cart));
        this.updateBadge();

        // Dispatch to both window and document for maximum compatibility
        const event = new CustomEvent('cartUpdated', { detail: cart });
        window.dispatchEvent(event);
        document.dispatchEvent(event);

        // Async Supabase sync for logged-in users
        this._syncToSupabase(cart);
    },

    // Push cart to Supabase (fire-and-forget)
    async _syncToSupabase(cart) {
        try {
            if (!window.supabaseClient) return;
            const { data: { user } } = await window.supabaseClient.auth.getUser();
            if (!user) return;

            await window.supabaseClient
                .from('user_carts')
                .upsert({ user_id: user.id, cart_data: JSON.stringify(cart), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
            console.log('[NewKet] Cart synced to Supabase.');
        } catch (err) {
            console.warn('[NewKet] Cart Supabase sync failed (non-blocking):', err.message);
        }
    },

    // Pull cart from Supabase and merge with local
    async syncFromSupabase() {
        try {
            if (!window.supabaseClient) return;
            const { data: { user } } = await window.supabaseClient.auth.getUser();
            if (!user) return;

            const { data, error } = await window.supabaseClient
                .from('user_carts')
                .select('cart_data')
                .eq('user_id', user.id)
                .single();

            if (error || !data) return;

            const remoteCart = JSON.parse(data.cart_data || '[]');
            const localCart = this.getCart();

            // Merge: remote items win if same id, otherwise combine
            const mergedMap = new Map();
            remoteCart.forEach(item => mergedMap.set(item.id, item));
            localCart.forEach(item => {
                if (!mergedMap.has(item.id)) mergedMap.set(item.id, item);
            });

            const merged = Array.from(mergedMap.values());
            localStorage.setItem('newketCart', JSON.stringify(merged));
            this.updateBadge();
            console.log('[NewKet] Cart synced from Supabase. Items:', merged.length);
        } catch (err) {
            console.warn('[NewKet] Cart Supabase pull failed (non-blocking):', err.message);
        }
    },

    // Add item to cart
    addItem(product, quantity = 1) {
        const cart = this.getCart();
        const existingItem = cart.find(item => item.id == product.id);
        const qtyToAdd = parseInt(quantity) || 1;

        const productImage = (product.image || '').split(',')[0];
        const cleanProduct = { ...product, image: productImage };

        if (existingItem) {
            existingItem.quantity += qtyToAdd;
        } else {
            cart.push({ ...cleanProduct, quantity: qtyToAdd });
        }

        this.saveCart(cart);
        return cart;
    },

    // Remove item from cart
    removeItem(productId) {
        let cart = this.getCart();
        cart = cart.filter(item => item.id != productId);
        this.saveCart(cart);
        return cart;
    },

    // Update quantity
    updateQuantity(productId, delta) {
        const cart = this.getCart();
        const item = cart.find(item => item.id == productId);

        if (item) {
            const currentQty = parseInt(item.quantity) || 0;
            item.quantity = currentQty + delta;

            if (item.quantity <= 0) {
                return this.removeItem(productId);
            }
        }

        this.saveCart(cart);
        return cart;
    },

    // Set specific quantity (Maintains position but updates count)
    setQuantity(productId, quantity) {
        let cart = this.getCart();
        const itemIndex = cart.findIndex(item => item.id == productId);

        if (itemIndex > -1) {
            const newQty = parseInt(quantity);
            if (newQty <= 0) {
                cart.splice(itemIndex, 1);
            } else {
                cart[itemIndex].quantity = newQty;
            }
            this.saveCart(cart);
        }
        return cart;
    },

    // Get total items count
    getItemCount() {
        const cart = this.getCart();
        return cart.reduce((total, item) => total + item.quantity, 0);
    },

    // Update badge on all pages
    updateBadge() {
        const badges = document.querySelectorAll('.cart-count, #cart-count');
        const count = this.getItemCount();
        console.log(`[NewKet] Updating cart badges. Total distinct items: ${count}`);

        badges.forEach(badge => {
            badge.textContent = count;
            badge.style.display = count === 0 ? 'none' : 'flex';

            badge.classList.remove('count-update');
            void badge.offsetWidth;
            badge.classList.add('count-update');
        });

        const cartIcons = document.querySelectorAll('.main-header a[href="cart.html"], .main-header a[title="Panier"]');
        cartIcons.forEach(icon => {
            icon.classList.remove('cart-shake');
            void icon.offsetWidth;
            icon.classList.add('cart-shake');
            setTimeout(() => icon.classList.remove('cart-shake'), 600);
        });
    },

    // Clear cart
    clear() {
        localStorage.removeItem('newketCart');
        this.updateBadge();
    }
};

window.CartManager = CartManager;
