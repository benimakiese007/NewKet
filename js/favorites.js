/* newket EMarket Favorites Manager */

const FavoritesManager = {
    // Get favorites from localStorage
    getFavorites() {
        const favorites = localStorage.getItem('newketFavorites');
        return favorites ? JSON.parse(favorites) : [];
    },

    // Save favorites to localStorage (and sync to Supabase if logged in)
    saveFavorites(favorites) {
        localStorage.setItem('newketFavorites', JSON.stringify(favorites));
        this.updateUI();
        window.dispatchEvent(new CustomEvent('favoritesUpdated'));

        // Async Supabase sync for logged-in users
        this._syncToSupabase(favorites);
    },

    // Push favorites to Supabase (fire-and-forget)
    async _syncToSupabase(favorites) {
        try {
            if (!window.supabaseClient) return;
            const { data: { user } } = await window.supabaseClient.auth.getUser();
            if (!user) return;

            await window.supabaseClient
                .from('user_favorites')
                .upsert({ user_id: user.id, favorites_data: JSON.stringify(favorites), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
            console.log('[NewKet] Favorites synced to Supabase.');
        } catch (err) {
            console.warn('[NewKet] Favorites Supabase sync failed (non-blocking):', err.message);
        }
    },

    // Pull favorites from Supabase and merge with local
    async syncFromSupabase() {
        try {
            if (!window.supabaseClient) return;
            const { data: { user } } = await window.supabaseClient.auth.getUser();
            if (!user) return;

            const { data, error } = await window.supabaseClient
                .from('user_favorites')
                .select('favorites_data')
                .eq('user_id', user.id)
                .single();

            if (error || !data) return;

            const remoteFavs = JSON.parse(data.favorites_data || '[]');
            const localFavs = this.getFavorites();

            // Merge: remote wins if same id, otherwise combine
            const mergedMap = new Map();
            remoteFavs.forEach(item => mergedMap.set(item.id, item));
            localFavs.forEach(item => {
                if (!mergedMap.has(item.id)) mergedMap.set(item.id, item);
            });

            const merged = Array.from(mergedMap.values());
            localStorage.setItem('newketFavorites', JSON.stringify(merged));
            this.updateUI();
            console.log('[NewKet] Favorites synced from Supabase. Items:', merged.length);
        } catch (err) {
            console.warn('[NewKet] Favorites Supabase pull failed (non-blocking):', err.message);
        }
    },

    // Add item to favorites
    addItem(product) {
        const favorites = this.getFavorites();
        const exists = favorites.find(item => item.id === product.id);

        if (!exists) {
            const firstImage = (product.image || '').split(',')[0];
            favorites.push({
                ...product,
                image: firstImage,
                addedAt: new Date().toISOString()
            });
            this.saveFavorites(favorites);
            return true;
        }
        return false;
    },

    // Remove item from favorites
    removeItem(productId) {
        let favorites = this.getFavorites();
        favorites = favorites.filter(item => item.id !== productId);
        this.saveFavorites(favorites);
    },

    // Clear all favorites
    clearAll() {
        localStorage.removeItem('newketFavorites');
        this.updateUI();
    },

    // Check if item is in favorites
    isInFavorites(productId) {
        const favorites = this.getFavorites();
        return favorites.some(item => item.id === productId);
    },

    // Get count
    getCount() {
        return this.getFavorites().length;
    },

    // Update UI elements (badges and icons)
    updateUI() {
        const count = this.getCount();
        const favorites = this.getFavorites();

        // Update badges
        const badges = document.querySelectorAll('#favoritesBadge, #mobileFavoritesBadge, #desktopFavoritesBadge, .favorites-badge');
        const totalText = document.getElementById('favoritesTotal');

        badges.forEach(badge => {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        });

        if (totalText) {
            totalText.textContent = count;
        }

        // Update heart icons on the page
        document.querySelectorAll('.product-card').forEach((card, index) => {
            // Try to identify product
            let productId = card.getAttribute('data-product-id') || '';

            if (!productId) {
                // Strategy 1: Link ID
                const link = card.querySelector('a[href*="id="]');
                if (link) {
                    const url = new URL(link.href, window.location.origin);
                    productId = url.searchParams.get('id');
                }
            }

            // Strategy 2: Scrape name (fallback)
            if (!productId) {
                const titleEl = card.querySelector('.product-title a, .product-title, h3 a, h3');
                if (titleEl) {
                    const productName = titleEl.textContent.trim();
                    productId = productName.toLowerCase().replace(/\s+/g, '-');
                }
            }

            if (!productId) return;

            const isFavorite = this.isInFavorites(productId);
            const wishlistBtn = card.querySelector('.wishlist-btn');

            // Target both font-awesome and iconify-icon
            if (wishlistBtn) {
                const iconify = wishlistBtn.querySelector('iconify-icon');
                const faIcon = wishlistBtn.querySelector('i');

                if (iconify) {
                    iconify.setAttribute('icon', isFavorite ? 'solar:heart-bold' : 'solar:heart-linear');
                    if (isFavorite) {
                        wishlistBtn.classList.add('text-red-500');
                    } else {
                        wishlistBtn.classList.remove('text-red-500');
                    }
                } else if (faIcon) {
                    if (isFavorite) {
                        faIcon.classList.remove('far');
                        faIcon.classList.add('fas');
                        faIcon.style.color = '#EF4444';
                    } else {
                        faIcon.classList.remove('fas');
                        faIcon.classList.add('far');
                        faIcon.style.color = '';
                    }
                }
            }
        });
    }
};

window.FavoritesManager = FavoritesManager;

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    FavoritesManager.updateUI();
});
