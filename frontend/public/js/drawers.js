/**
 * NewKet Drawers Manager
 * Provides slide-over drawers from the right side for Favorites and Notifications,
 * matching the look and feel of CartManager.
 */

class DrawersManager {
    constructor() {
        this.activeDrawer = null;
        this.notifFilter = 'all';

        // Listen for data updates to re-render if open
        window.addEventListener('favoritesUpdated', () => {
            if (this.isFavoritesOpen()) {
                this.renderFavorites();
            }
        });

        window.addEventListener('notificationsUpdated', () => {
            if (this.isNotificationsOpen()) {
                this.renderNotifications();
            }
        });

        window.addEventListener('currencyChanged', () => {
            if (this.isFavoritesOpen()) {
                this.renderFavorites();
            }
        });

        // Close on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAll();
            }
        });
    }

    _lockScroll() {
        if (typeof window._newketLockScroll === 'function') {
            window._newketLockScroll();
        } else {
            document.body.style.overflow = 'hidden';
        }
    }

    _unlockScroll() {
        if (typeof window._newketUnlockScroll === 'function') {
            window._newketUnlockScroll();
        } else {
            document.body.style.overflow = '';
            document.body.style.removeProperty('overflow');
        }
    }

    /* ══════════════════════════════════════════════════════════════════════════
       FAVORITES DRAWER
       ══════════════════════════════════════════════════════════════════════════ */

    injectFavoritesUI() {
        if (document.getElementById('favoritesSlideOver')) return;

        const html = `
            <!-- Favorites Overlay -->
            <div id="favoritesOverlay" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] opacity-0 pointer-events-none transition-opacity duration-300" onclick="window.DrawersManager.closeFavorites()"></div>

            <!-- Favorites Slide-over (Right side) -->
            <div id="favoritesSlideOver" role="dialog" aria-modal="true" aria-label="Favoris" class="fixed top-0 right-0 h-full w-full sm:max-w-md bg-gray-50 transform translate-x-full transition-transform duration-300 ease-in-out shadow-2xl flex flex-col overscroll-contain" style="z-index: 1000000; height: 100dvh;">
                <!-- Header -->
                <div class="px-6 py-5 flex items-center justify-between shrink-0 bg-newket-header text-white" style="border-bottom:1px solid rgba(255,255,255,0.1); padding-top: calc(1.25rem + env(safe-area-inset-top, 0px));">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full text-white flex items-center justify-center bg-white/15">
                            <iconify-icon icon="solar:heart-bold" width="20" class="text-red-400"></iconify-icon>
                        </div>
                        <div>
                            <h2 class="text-base sm:text-lg font-black uppercase tracking-wider text-white">Mes Favoris</h2>
                            <p id="drawerFavCount" class="text-[11px] text-white/70 font-medium">0 article enregistré</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-1">
                        <button id="drawerClearFavBtn" onclick="window.DrawersManager.clearAllFavorites()" class="p-2 text-white/80 hover:text-red-400 hover:bg-white/10 rounded-xl transition-colors btn-active-scale" title="Tout effacer" aria-label="Tout effacer">
                            <iconify-icon icon="solar:trash-bin-trash-linear" width="20"></iconify-icon>
                        </button>
                        <button onclick="window.DrawersManager.closeFavorites()" class="p-2 rounded-xl text-white hover:bg-white/10 transition-colors btn-active-scale" aria-label="Fermer">
                            <iconify-icon icon="solar:close-circle-linear" width="24"></iconify-icon>
                        </button>
                    </div>
                </div>

                <!-- Items Container -->
                <div id="drawerFavItemsContainer" class="flex-1 overflow-y-auto p-4 sm:p-5 overscroll-contain modal-scroll">
                    <!-- Dynamic Items -->
                </div>

                <!-- Footer -->
                <div class="drawer-footer bg-white border-t border-gray-100 p-4 shrink-0 text-center" style="padding-bottom: calc(96px + env(safe-area-inset-bottom, 34px));">
                    <a href="/catalog" onclick="window.DrawersManager.closeFavorites()" class="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition-colors btn-active-scale">
                        <iconify-icon icon="solar:shop-2-linear" width="16"></iconify-icon>
                        Découvrir d'autres articles
                    </a>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);
    }

    openFavorites() {
        // If on favorites.html itself, do nothing to avoid redundancy
        if (window.location.pathname.includes('/favorites')) return;

        this.closeNotifications(false);
        if (window.CartManager && typeof window.CartManager._hideSlideOver === 'function') {
            window.CartManager._hideSlideOver();
        }

        this.injectFavoritesUI();

        // Also trigger background pull if available
        if (window.FavoritesManager?.syncFromSupabase) {
            window.FavoritesManager.syncFromSupabase().catch(() => {});
        }

        setTimeout(() => {
            const el = document.getElementById('favoritesSlideOver');
            const overlay = document.getElementById('favoritesOverlay');
            if (!el || !overlay) return;

            overlay.classList.remove('opacity-0', 'pointer-events-none');
            el.classList.remove('translate-x-full');
            this._lockScroll();
            this.activeDrawer = 'favorites';
            this.renderFavorites();
        }, 10);
    }

    closeFavorites(unlockScroll = true) {
        const el = document.getElementById('favoritesSlideOver');
        const overlay = document.getElementById('favoritesOverlay');
        if (el && overlay) {
            overlay.classList.add('opacity-0', 'pointer-events-none');
            el.classList.add('translate-x-full');
            if (unlockScroll) this._unlockScroll();
            if (this.activeDrawer === 'favorites') this.activeDrawer = null;
        }
    }

    toggleFavorites() {
        if (this.isFavoritesOpen()) {
            this.closeFavorites();
        } else {
            this.openFavorites();
        }
    }

    isFavoritesOpen() {
        const el = document.getElementById('favoritesSlideOver');
        return el && !el.classList.contains('translate-x-full');
    }

    renderFavorites() {
        const container = document.getElementById('drawerFavItemsContainer');
        const countText = document.getElementById('drawerFavCount');
        const clearBtn = document.getElementById('drawerClearFavBtn');
        if (!container) return;

        const items = window.FavoritesManager ? window.FavoritesManager.getFavorites() : [];
        const count = items.length;

        if (countText) {
            countText.textContent = `${count} article${count > 1 ? 's' : ''} enregistré${count > 1 ? 's' : ''}`;
        }
        if (clearBtn) {
            clearBtn.style.display = count > 0 ? 'inline-flex' : 'none';
        }

        if (count === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-gray-500 py-16 text-center">
                    <div class="w-16 h-16 rounded-full bg-red-50 text-red-400 flex items-center justify-center mb-4">
                        <iconify-icon icon="solar:heart-broken-linear" width="32"></iconify-icon>
                    </div>
                    <p class="font-bold text-gray-800 text-base">Aucun coup de cœur</p>
                    <p class="text-xs text-gray-500 mt-1 max-w-xs">Appuyez sur le cœur sur n'importe quel produit pour le retrouver ici.</p>
                </div>
            `;
            return;
        }

        const fallbackImg = 'https://res.cloudinary.com/dzhnphyp3/image/upload/f_auto,q_auto/v1782572380/newket_assets/frontend/src/assets/Images/default.jpg';

        container.innerHTML = `
            <div class="space-y-3">
                ${items.map(item => {
                    const priceFormatted = window.CurrencyManager?.formatPrice
                        ? window.CurrencyManager.formatPrice(item.price)
                        : (item.price ? `${item.price} FC` : '0 FC');

                    const rawImg = (item.image || item.image_url || '').split(',')[0];
                    const imgUrl = window.getOptimizedImageUrl ? window.getOptimizedImageUrl(rawImg) : (rawImg || fallbackImg);
                    const safeName = (item.name || item.title || 'Produit').replace(/"/g, '&quot;');
                    const safeVendor = (item.users?.company_name || item.users?.name || item.vendor || 'NewKet').replace(/"/g, '&quot;');

                    return `
                        <div class="flex gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm relative group hover:border-gray-200 transition-all">
                            <a href="/src/pages/product.html?id=${item.id}" onclick="window.DrawersManager.closeFavorites()" class="w-20 h-20 bg-gray-50 rounded-xl overflow-hidden shrink-0 border border-gray-100 block">
                                <img src="${imgUrl}" alt="${safeName}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" onerror="this.src='${fallbackImg}'">
                            </a>
                            <div class="flex-1 flex flex-col justify-between min-w-0 pr-6">
                                <div>
                                    <span class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block truncate">${safeVendor}</span>
                                    <a href="/src/pages/product.html?id=${item.id}" onclick="window.DrawersManager.closeFavorites()" class="font-bold text-slate-900 text-xs sm:text-sm hover:text-emerald-700 transition-colors line-clamp-2 block leading-snug">
                                        ${safeName}
                                    </a>
                                </div>
                                <div class="flex items-center justify-between mt-2 pt-1 border-t border-gray-50">
                                    <span class="font-black text-slate-900 text-xs sm:text-sm">${priceFormatted}</span>
                                    <button onclick="window.DrawersManager.addFavoriteToCart('${item.id}', this)" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[11px] font-bold hover:bg-slate-800 transition-colors btn-active-scale">
                                        <iconify-icon icon="solar:cart-plus-bold" width="14"></iconify-icon>
                                        <span>Ajouter</span>
                                    </button>
                                </div>
                            </div>
                            <button onclick="window.DrawersManager.removeFavorite('${item.id}')" class="absolute top-2.5 right-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors" title="Retirer" aria-label="Retirer">
                                <iconify-icon icon="solar:trash-bin-trash-bold" width="16"></iconify-icon>
                            </button>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    addFavoriteToCart(productId, btn = null) {
        if (!window.CartManager || !window.FavoritesManager) return;
        const item = window.FavoritesManager.getFavorites().find(i => String(i.id) === String(productId));
        if (!item) return;

        const cartItem = {
            id: item.id,
            title: item.name || item.title || 'Article',
            price: item.price,
            image: (item.image || '').split(',')[0],
            vendor_id: item.user_id || item.users?.id || '',
            vendor: item.users?.company_name || item.users?.name || item.vendor || 'NewKet'
        };

        window.CartManager.add(cartItem);
        if (window.showToast) {
            window.showToast('Article ajouté au panier !', 'success');
        }

        if (btn) {
            const original = btn.innerHTML;
            btn.innerHTML = '<iconify-icon icon="solar:check-circle-bold" width="14"></iconify-icon> <span>Ajouté !</span>';
            btn.classList.add('bg-emerald-600');
            setTimeout(() => {
                btn.innerHTML = original;
                btn.classList.remove('bg-emerald-600');
            }, 1200);
        }
    }

    removeFavorite(productId) {
        if (window.FavoritesManager) {
            window.FavoritesManager.removeItem(productId);
            this.renderFavorites();
        }
    }

    clearAllFavorites() {
        if (!window.FavoritesManager) return;
        if (window.showConfirm) {
            window.showConfirm(
                'Tout effacer ?',
                'Supprimer tous vos articles favoris ?',
                () => {
                    window.FavoritesManager.clearAll();
                    this.renderFavorites();
                }
            );
        } else if (confirm('Supprimer tous vos favoris ?')) {
            window.FavoritesManager.clearAll();
            this.renderFavorites();
        }
    }

    /* ══════════════════════════════════════════════════════════════════════════
       NOTIFICATIONS DRAWER
       ══════════════════════════════════════════════════════════════════════════ */

    injectNotificationsUI() {
        if (document.getElementById('notificationsSlideOver')) return;

        const html = `
            <!-- Notifications Overlay -->
            <div id="notificationsOverlay" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] opacity-0 pointer-events-none transition-opacity duration-300" onclick="window.DrawersManager.closeNotifications()"></div>

            <!-- Notifications Slide-over (Right side) -->
            <div id="notificationsSlideOver" role="dialog" aria-modal="true" aria-label="Notifications" class="fixed top-0 right-0 h-full w-full sm:max-w-md bg-gray-50 transform translate-x-full transition-transform duration-300 ease-in-out shadow-2xl flex flex-col overscroll-contain" style="z-index: 1000000; height: 100dvh;">
                <!-- Header -->
                <div class="px-6 py-5 flex items-center justify-between shrink-0 bg-newket-header text-white" style="border-bottom:1px solid rgba(255,255,255,0.1); padding-top: calc(1.25rem + env(safe-area-inset-top, 0px));">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full text-white flex items-center justify-center bg-white/15">
                            <iconify-icon icon="solar:bell-bold" width="20" class="text-amber-400"></iconify-icon>
                        </div>
                        <div>
                            <h2 class="text-base sm:text-lg font-black uppercase tracking-wider text-white">Notifications</h2>
                            <p id="drawerNotifCount" class="text-[11px] text-white/70 font-medium">0 notification</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-1">
                        <button onclick="window.DrawersManager.markAllNotificationsRead()" class="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors btn-active-scale" title="Tout marquer comme lu" aria-label="Tout lire">
                            <iconify-icon icon="solar:check-read-linear" width="20"></iconify-icon>
                        </button>
                        <button onclick="window.DrawersManager.closeNotifications()" class="p-2 rounded-xl text-white hover:bg-white/10 transition-colors btn-active-scale" aria-label="Fermer">
                            <iconify-icon icon="solar:close-circle-linear" width="24"></iconify-icon>
                        </button>
                    </div>
                </div>

                <!-- Filter Chips -->
                <div class="px-4 py-3 bg-white border-b border-gray-100 flex items-center gap-2 shrink-0">
                    <button onclick="window.DrawersManager.setNotifFilter('all')" data-drawer-filter="all" class="drawer-filter-chip px-3 py-1 rounded-full text-[11px] font-bold bg-black text-white transition-all">Tout</button>
                    <button onclick="window.DrawersManager.setNotifFilter('unread')" data-drawer-filter="unread" class="drawer-filter-chip px-3 py-1 rounded-full text-[11px] font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">Non lues</button>
                    <button onclick="window.DrawersManager.setNotifFilter('alerts')" data-drawer-filter="alerts" class="drawer-filter-chip px-3 py-1 rounded-full text-[11px] font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">Alertes</button>
                </div>

                <!-- List Container -->
                <div id="drawerNotifItemsContainer" class="flex-1 overflow-y-auto p-4 overscroll-contain modal-scroll space-y-2.5">
                    <!-- Dynamic Notifications -->
                </div>

                <!-- Footer -->
                <div class="drawer-footer bg-white border-t border-gray-100 p-4 shrink-0 flex items-center justify-between" style="padding-bottom: calc(96px + env(safe-area-inset-bottom, 34px));">
                    <button onclick="window.DrawersManager.clearAllNotifications()" class="text-xs font-bold text-red-500 hover:text-red-700 transition-colors">
                        Effacer l'historique
                    </button>
                    <a href="/notifications" onclick="window.DrawersManager.closeNotifications()" class="text-xs font-bold text-slate-700 hover:text-slate-900 transition-colors inline-flex items-center gap-1">
                        Page complète
                        <iconify-icon icon="solar:arrow-right-linear" width="14"></iconify-icon>
                    </a>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);
    }

    openNotifications() {
        // If on notifications.html itself, do nothing
        if (window.location.pathname.includes('/notifications')) return;

        this.closeFavorites(false);
        if (window.CartManager && typeof window.CartManager._hideSlideOver === 'function') {
            window.CartManager._hideSlideOver();
        }

        this.injectNotificationsUI();

        // Trigger fresh fetch
        if (window.NotificationManager?.init) {
            window.NotificationManager.init(true).catch(() => {});
        }

        setTimeout(() => {
            const el = document.getElementById('notificationsSlideOver');
            const overlay = document.getElementById('notificationsOverlay');
            if (!el || !overlay) return;

            overlay.classList.remove('opacity-0', 'pointer-events-none');
            el.classList.remove('translate-x-full');
            this._lockScroll();
            this.activeDrawer = 'notifications';
            this.renderNotifications();
        }, 10);
    }

    closeNotifications(unlockScroll = true) {
        const el = document.getElementById('notificationsSlideOver');
        const overlay = document.getElementById('notificationsOverlay');
        if (el && overlay) {
            overlay.classList.add('opacity-0', 'pointer-events-none');
            el.classList.add('translate-x-full');
            if (unlockScroll) this._unlockScroll();
            if (this.activeDrawer === 'notifications') this.activeDrawer = null;
        }
    }

    toggleNotifications() {
        if (this.isNotificationsOpen()) {
            this.closeNotifications();
        } else {
            this.openNotifications();
        }
    }

    isNotificationsOpen() {
        const el = document.getElementById('notificationsSlideOver');
        return el && !el.classList.contains('translate-x-full');
    }

    setNotifFilter(filter) {
        this.notifFilter = filter;
        document.querySelectorAll('.drawer-filter-chip').forEach(btn => {
            const isActive = btn.dataset.drawerFilter === filter;
            btn.className = `drawer-filter-chip px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                isActive ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`;
        });
        this.renderNotifications();
    }

    renderNotifications() {
        const container = document.getElementById('drawerNotifItemsContainer');
        const countText = document.getElementById('drawerNotifCount');
        if (!container) return;

        const notifs = window.NotificationManager ? window.NotificationManager.getNotifications() : [];
        const unreadCount = notifs.filter(n => !n.read).length;

        if (countText) {
            countText.textContent = unreadCount > 0
                ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`
                : 'Toutes les notifications sont lues';
        }

        const filtered = notifs.filter(n => {
            if (this.notifFilter === 'unread') return !n.read;
            if (this.notifFilter === 'alerts') return n.type === 'danger' || n.type === 'error' || n.type === 'warning';
            return true;
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-gray-500 py-16 text-center">
                    <div class="w-16 h-16 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mb-4">
                        <iconify-icon icon="solar:bell-linear" width="32"></iconify-icon>
                    </div>
                    <p class="font-bold text-gray-800 text-base">Aucune notification</p>
                    <p class="text-xs text-gray-500 mt-1">Vous êtes à jour !</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(n => {
            let icon = 'solar:bell-linear';
            let iconColor = 'text-gray-900 bg-gray-100';

            const type = window.normalizeNotificationType ? window.normalizeNotificationType(n.type) : n.type;
            if (type === 'success') {
                icon = 'solar:check-circle-bold';
                iconColor = 'text-green-600 bg-green-50';
            } else if (type === 'error' || type === 'danger') {
                icon = 'solar:danger-circle-bold';
                iconColor = 'text-red-600 bg-red-50';
            } else if (type === 'warning') {
                icon = 'solar:bell-bing-bold';
                iconColor = 'text-orange-600 bg-orange-50';
            } else if (type === 'info') {
                icon = 'solar:info-circle-bold';
                iconColor = 'text-blue-600 bg-blue-50';
            }

            const dateObj = new Date(n.date || n.created_at || Date.now());
            const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const dateStr = dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

            return `
                <div onclick="window.DrawersManager.markNotificationRead('${n.id}')" class="p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    !n.read ? 'bg-white border-amber-200 shadow-sm' : 'bg-white/70 border-gray-100 opacity-80'
                } hover:border-gray-300">
                    <div class="flex gap-3">
                        <div class="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${iconColor}">
                            <iconify-icon icon="${icon}" width="20"></iconify-icon>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between mb-0.5">
                                <h4 class="font-bold text-xs sm:text-sm text-slate-900 truncate">${n.title || 'Notification'}</h4>
                                <span class="text-[10px] text-gray-400 font-medium shrink-0 ml-2">${dateStr}</span>
                            </div>
                            <p class="text-xs text-gray-600 leading-snug line-clamp-2">${n.message || ''}</p>
                            <div class="flex items-center justify-between mt-2 pt-1 border-t border-gray-50 text-[10px] text-gray-400">
                                <span>${timeStr}</span>
                                ${!n.read ? '<span class="inline-flex items-center gap-1 font-bold text-amber-600"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Non lue</span>' : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    markNotificationRead(id) {
        if (window.NotificationManager) {
            window.NotificationManager.markAsRead(id);
            this.renderNotifications();
        }
    }

    markAllNotificationsRead() {
        if (window.NotificationManager) {
            window.NotificationManager.markAllAsRead();
            this.renderNotifications();
        }
    }

    clearAllNotifications() {
        if (!window.NotificationManager) return;
        if (confirm('Effacer toutes les notifications ?')) {
            window.NotificationManager.clearAll();
            this.renderNotifications();
        }
    }

    closeAll() {
        this.closeFavorites(false);
        this.closeNotifications(true);
    }
}

window.DrawersManager = new DrawersManager();
