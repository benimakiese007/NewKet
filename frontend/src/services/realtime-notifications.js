/**
 * NewKet Realtime & PWA Notifications
 * Handles Toast UI, Supabase Realtime (Price drops for favorites, Order updates),
 * and PWA Add-To-Home-Screen prompt.
 */

const AppNotifications = {
    toastContainer: null,
    deferredPrompt: null,

    init() {
        this._setupToastContainer();
        this._setupPWA();
        
        // Wait for Supabase client
        document.addEventListener('newketInitialized', () => {
            this._setupRealtime();
        });
    },

    _setupToastContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            // Fixed top-center for mobile, top-right for desktop
            container.className = 'fixed top-4 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-4 z-[100] flex flex-col gap-2 w-[90%] sm:w-96 pointer-events-none';
            document.body.appendChild(container);
        }
        this.toastContainer = container;
    },

    /**
     * Show a modern Glassmorphism Toast notification
     */
    showToast(title, message, type = 'info', icon = 'solar:bell-bold') {
        if (!this.toastContainer) this._setupToastContainer();

        const toast = document.createElement('div');
        
        // Colors based on type
        const colors = {
            info: 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white border-gray-200 dark:border-gray-800',
            success: 'bg-green-50 dark:bg-green-900 text-green-900 dark:text-green-100 border-green-200 dark:border-green-800',
            warning: 'bg-yellow-50 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-100 border-yellow-200 dark:border-yellow-800',
            error: 'bg-red-50 dark:bg-red-900 text-red-900 dark:text-red-100 border-red-200 dark:border-red-800'
        };

        const iconColors = {
            info: 'text-blue-500',
            success: 'text-green-500',
            warning: 'text-yellow-500',
            error: 'text-red-500'
        };

        toast.className = `
            pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-xl border border-solid
            transform transition-all duration-300 translate-y-[-1rem] opacity-0
            ${colors[type] || colors.info}
        `;

        toast.innerHTML = `
            <div class="flex-shrink-0 mt-0.5">
                <iconify-icon icon="${icon}" width="22" class="${iconColors[type] || iconColors.info}"></iconify-icon>
            </div>
            <div class="flex-1 min-w-0">
                <h4 class="text-sm font-bold tracking-tight mb-1">${title}</h4>
                <p class="text-xs opacity-90 leading-relaxed">${message}</p>
            </div>
            <button class="flex-shrink-0 p-1 opacity-50 hover:opacity-100 transition-opacity" onclick="this.closest('.pointer-events-auto').remove()">
                <iconify-icon icon="solar:close-circle-linear" width="18"></iconify-icon>
            </button>
        `;

        this.toastContainer.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.style.transform = 'translateY(0)';
            toast.style.opacity = '1';
        });

        // Auto remove after 5s
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-1rem)';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    },

    _setupRealtime() {
        const client = window.SupabaseAdapter ? window.SupabaseAdapter.getClient() : null;
        if (!client) return;

        // Listen for product price drops (only relevant for favorites)
        client.channel('public:products')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, payload => {
                if (payload.new.price < payload.old.price) {
                    const favs = window.FavoritesManager ? FavoritesManager.getFavorites() : [];
                    if (favs.includes(payload.new.id)) {
                        this.showToast(
                            'Baisse de prix ! 🎉',
                            `Bonne nouvelle, un article de vos favoris ("${payload.new.name}") est maintenant à ${window.CurrencyManager ? CurrencyManager.formatPrice(payload.new.price) : payload.new.price + ' FC'}.`,
                            'success',
                            'solar:tag-price-bold'
                        );
                    }
                }
            })
            .subscribe();

        // Listen for order status updates for the current user safely
        if (window.SupabaseAdapter) {
            window.SupabaseAdapter.getSession().then(session => {
                if (session && session.user) {
                    const userId = session.user.id;
                    const userEmail = session.user.email;
                    
                    client.channel(`public:orders:${userId}`)
                        .on('postgres_changes', { 
                            event: 'UPDATE', 
                            schema: 'public', 
                            table: 'orders',
                            filter: `user_id=eq.${userId}` 
                        }, payload => {
                            if (payload.new.status !== payload.old.status) {
                                this.showToast(
                                    'Mise à jour de commande 📦',
                                    `Le statut de votre commande #${payload.new.id.split('-')[0]} est passé à : ${payload.new.status}.`,
                                    'info',
                                    'solar:box-minimalistic-bold'
                                );
                            }
                        })
                        .subscribe();

                    // Listen for real-time notifications from admin
                    client.channel(`public:notifications:${userId}`)
                        .on('postgres_changes', {
                            event: 'INSERT',
                            schema: 'public',
                            table: 'notifications'
                        }, payload => {
                            const notif = payload.new;
                            const role = localStorage.getItem('newketRole') === 'supplier' ? 'suppliers' : 'customers';
                            
                            const isForMe = notif.target_role === 'all' || 
                                            notif.target_role === role || 
                                            notif.user_id === userId || 
                                            notif.user_email === userEmail;

                            if (isForMe) {
                                this.showToast(notif.title, notif.message, notif.type, 'solar:bell-bold');
                                // Refresh NotificationManager quietly to update badges and list
                                if (window.NotificationManager) {
                                    window.NotificationManager.init();
                                }
                            }
                        })
                        .subscribe();
                }
            });
        }
    },

    _setupPWA() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            
            // Dispatch a custom event so the UI can show an "Install" button
            window.dispatchEvent(new CustomEvent('pwaInstallAvailable'));
        });

        // Optionally, register a service worker if not already done by standard html
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .catch(err => console.error('[NewKet] SW registration failed', err));
        }
    },

    promptInstall() {
        if (!this.deferredPrompt) {
            this.showToast('Information', "L'application est déjà installée ou non supportée sur ce navigateur.", 'info');
            return;
        }
        this.deferredPrompt.prompt();
        this.deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                this.showToast('Succès', "Merci d'avoir installé NewKet sur votre appareil ! 🎉", 'success');
            }
            this.deferredPrompt = null;
        });
    }
};

window.AppNotifications = AppNotifications;

document.addEventListener('DOMContentLoaded', () => {
    AppNotifications.init();
});
