/* newket EMarket Managed Utilities */

// ========== RECENTLY VIEWED MANAGER ==========
const RecentlyViewedManager = {
    maxItems: 10,
    getItems() {
        const items = localStorage.getItem('newketRecentlyViewed');
        return items ? JSON.parse(items) : [];
    },
    addItem(product) {
        if (!product || !product.id) return;
        let items = this.getItems();
        items = items.filter(item => item.id !== product.id);
        const firstImage = (product.image || '').split(',')[0];
        items.unshift({
            id: product.id,
            name: product.name,
            price: product.price || product.priceCDF,
            image: firstImage,
            category: product.category,
            viewedAt: new Date().toISOString()
        });
        if (items.length > this.maxItems) items = items.slice(0, this.maxItems);
        localStorage.setItem('newketRecentlyViewed', JSON.stringify(items));
        window.dispatchEvent(new CustomEvent('recentlyViewedUpdated'));
    },
    clearAll() {
        localStorage.removeItem('newketRecentlyViewed');
        window.dispatchEvent(new CustomEvent('recentlyViewedUpdated'));
    },
    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const items = this.getItems();
        if (items.length === 0) {
            if (container.parentElement) container.parentElement.style.display = 'none';
            return;
        }
        if (container.parentElement) container.parentElement.style.display = 'block';
        container.innerHTML = items.map(p => `
            <div class="flex-shrink-0 w-40 group">
                <a href="${window.location.pathname.includes('/pages/') ? '' : 'pages/'}product?id=${p.id}" class="block">
                    <div class="aspect-square bg-gray-50 rounded-2xl p-4 mb-3 flex items-center justify-center relative overflow-hidden group-hover:bg-gray-100 transition-colors">
                        <img src="${p.image}" loading="lazy" class="w-full h-full object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-110" alt="${p.name}">
                    </div>
                    <h4 class="text-xs font-bold text-gray-900 truncate mb-1">${p.name}</h4>
                    <div class="text-xs font-black text-gray-900">${window.CurrencyManager ? CurrencyManager.formatPrice(p.price) : p.price + ' FC'}</div>
                </a>
            </div>
        `).join('');
    }
};

// ========== PROMO MANAGER ==========
const PromoManager = {
    promos: {},
    async init() {
        if (!window.ApiClient) return;
        try {
            const data = await window.ApiClient.get('/promos');
        if (data && data.length > 0) {
            const promoMap = {};
            data.forEach(p => {
                promoMap[p.code] = {
                    type: p.type,
                    value: p.value,
                    maxUses: p.max_uses,
                    expiryDate: p.expiry_date,
                    currentUses: p.current_uses,
                    usedBy: p.used_by || []
                };
            });
            this.promos = promoMap;
        }
        } catch (e) {
            console.error('[PromoManager] Init error:', e);
        }
        window.dispatchEvent(new CustomEvent('promosUpdated'));
    },
    getPromos() { return this.promos; },
    canApply(code, userId) {
        const promo = this.promos[code];
        if (!promo) return { valid: false, message: 'Ce code privilège n\'est pas reconnu par notre système.' };
        if (promo.maxUses !== null && promo.currentUses >= promo.maxUses) {
            return { valid: false, message: 'Cette offre exclusive est malheureusement victime de son succès.' };
        }
        if (promo.expiryDate) {
            const now = new Date();
            const expiry = new Date(promo.expiryDate);
            expiry.setHours(23, 59, 59, 999);
            if (now > expiry) return { valid: false, message: 'Cette offre prestigieuse a malheureusement expiré.' };
        }
        if (userId && promo.usedBy && promo.usedBy.includes(userId)) {
            return { valid: false, message: 'Vous avez déjà bénéficié de cette offre exclusive.' };
        }
        return { valid: true };
    },
    async incrementUsage(code) {
        if (!window.ApiClient) return;
        try {
            const data = await window.ApiClient.post('/promos/apply', { code });
            if (data && data.success) {
                await this.init(); 
            }
        } catch (error) {
            console.error('[NewKet] Error applying promo:', error);
        }
    }
};

// ========== ACTIVITY MANAGER ==========
const ActivityManager = {
    activities: [],
    async init() {
        if (!window.ApiClient) return;
        try {
            const data = await window.ApiClient.get('/activities');
        if (data && data.length > 0) {
            this.activities = data;
        }
        } catch (e) {
            console.error('[ActivityManager] Init error:', e);
        }
        window.dispatchEvent(new CustomEvent('activitiesUpdated'));
    },
    getActivities() { return this.activities; },
    getRecentActivity(limit = 5) { return this.activities.slice(0, limit); },
    async log(text, type = 'system') {
        if (!window.ApiClient) return;
        try {
            const inserted = await window.ApiClient.post('/activities', { text, type });
            if (inserted) {
                this.activities.unshift(inserted);
                if (this.activities.length > 50) this.activities.pop();
                window.dispatchEvent(new CustomEvent('activitiesUpdated'));
            }
        } catch (e) {
            console.error('[ActivityManager] Log error:', e);
        }
    },
    formatTime(isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        if (diffInSeconds < 60) return 'À l\'instant';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} h`;
        return date.toLocaleDateString();
    }
};

// ========== NOTIFICATION MANAGER ==========
const NotificationManager = {
    notifications: [],
    async init() {
        if (!window.ApiClient) return;
        try {
            const data = await window.ApiClient.get('/notifications');
        if (data && data.length > 0) {
            this.notifications = data;
        }
        } catch (e) {
            console.error('[NotificationManager] Init error:', e);
        }
        this.updateBadge();
        window.dispatchEvent(new CustomEvent('notificationsUpdated'));
    },
    getNotifications() { return this.notifications; },
    async addNotification(title, message, type = 'info') {
        if (!window.ApiClient) return null;
        try {
            const inserted = await window.ApiClient.post('/notifications', { title, message, type });
            if (inserted) {
                this.notifications.unshift(inserted);
                if (this.notifications.length > 50) this.notifications.pop();
                this.updateBadge();
                window.dispatchEvent(new CustomEvent('notificationsUpdated'));
                return inserted;
            }
        } catch (e) {
            console.error('[NotificationManager] Add error:', e);
        }
        return null;
    },
    async markAsRead(id) {
        if (!window.ApiClient) return;
        try {
            const updated = await window.ApiClient.put(`/notifications/${id}/read`);
            if (updated) {
                const notif = this.notifications.find(n => n.id === id);
                if (notif) {
                    notif.read = true;
                    this.updateBadge();
                    window.dispatchEvent(new CustomEvent('notificationsUpdated'));
                }
            }
        } catch (e) {
            console.error('[NotificationManager] Mark read error:', e);
        }
    },
    getUnreadCount() { return this.notifications.filter(n => !n.read).length; },
    updateBadge() {
        const unreadCount = this.getUnreadCount();
        const badges = document.querySelectorAll('.notification-badge');
        badges.forEach(badge => {
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        });
    }
};

// Export to window
window.RecentlyViewedManager = RecentlyViewedManager;
window.PromoManager = PromoManager;
window.ActivityManager = ActivityManager;
window.NotificationManager = NotificationManager;

// Init
document.addEventListener('DOMContentLoaded', () => {
    PromoManager.init();
    ActivityManager.init();
    NotificationManager.init();
});
