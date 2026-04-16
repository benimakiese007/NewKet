/**
 * NewKet Realtime & PWA Notifications
 * Handles Toast UI, Supabase Realtime (Price drops for favorites, Order updates),
 * and PWA Add-To-Home-Screen prompt.
 */

const AppNotifications = {
    toastContainer: null,
    deferredPrompt: null,

    init() {
        this._setupPWA();
        
        // Wait for Supabase client
        document.addEventListener('newketInitialized', () => {
            this._setupRealtime();
        });
    },

    /**
     * Delegated to the global showToast in ui-helpers.js
     */
    showToast(title, message, type = 'info', icon = 'solar:bell-bold') {
        if (window.showToast) {
            window.showToast(message, type, title, icon);
        } else {
            // Fallback if ui-helpers isn't loaded yet
            console.warn('[NewKet] Global showToast not available, queuing or logging:', message);
            // Optional: minimal fallback or queue
        }
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
