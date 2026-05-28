/**
 * NewKet Realtime & PWA Notifications
 * Handles Toast UI, Supabase Realtime (Price drops for favorites, Order updates),
 * and PWA Add-To-Home-Screen prompt.
 */

const AppNotifications = {
    toastContainer: null,
    deferredPrompt: null,
    pushPublicKey: null,

    init() {
        this._setupPWA();
        
        // Wait for Supabase client
        document.addEventListener('newketInitialized', () => {
            this._setupRealtime();
            this.syncDevicePushSubscription().catch(err => {
                console.warn('[NewKet] Device push sync skipped:', err?.message || err);
            });
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

        // Listen for order status updates and notifications robustly
        if (window.SupabaseAdapter) {
            window.SupabaseAdapter.getSession().then(session => {
                let userId = null;
                let userEmail = null;

                if (session && session.user) {
                    userId = session.user.id;
                    userEmail = session.user.email;
                    
                    // Listen for order status updates for the current user safely
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
                }

                // Listen for real-time notifications from admin (broadcast & targeted)
                // Always active even for guests/anonymous visitors to ensure robust broadcast delivery
                client.channel('admin-notifications-broadcast')
                    .on('postgres_changes', {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'notifications'
                    }, payload => {
                        const notif = payload.new;
                        const role = localStorage.getItem('newketRole') === 'supplier' ? 'suppliers' : 'customers';
                        const resolvedType = typeof window.normalizeNotificationType === 'function'
                            ? window.normalizeNotificationType(notif.type)
                            : (notif.type === 'broadcast' ? 'info' : notif.type);
                        
                        const isBroadcast = notif.type === 'broadcast' || String(notif.type || '').startsWith('broadcast:');
                        const isPopupNotification = typeof window.isPopupNotification === 'function'
                            ? window.isPopupNotification(notif.type)
                            : isBroadcast;

                        const isForMe = notif.target_role === 'all' || 
                                        notif.target_role === role || 
                                        (userId && notif.user_id === userId) || 
                                        (userEmail && notif.user_email === userEmail);

                        if (isForMe) {
                            const isDashboardPage = window.location.pathname.includes('customer-dashboard') || 
                                                    window.location.pathname.includes('vendor-dashboard') ||
                                                    window.location.pathname.includes('admin/');

                            // Premium modal announcement directly on platforms
                            if (isPopupNotification || isDashboardPage) {
                                if (window.showAnnouncementModal) {
                                    const options = {};
                                    const lowerTitle = String(notif.title || '').toLowerCase();
                                    
                                    // Contextual action button for customer dashboard
                                    if (window.location.pathname.includes('customer-dashboard')) {
                                        if (lowerTitle.includes('devis') || lowerTitle.includes('commande')) {
                                            options.actionText = 'Voir mes demandes';
                                            options.actionCallback = () => {
                                                if (typeof window.switchTab === 'function') {
                                                    window.switchTab('orders');
                                                }
                                            };
                                        } else if (lowerTitle.includes('achat') || lowerTitle.includes('paiement')) {
                                            options.actionText = 'Mes achats';
                                            options.actionCallback = () => {
                                                if (typeof window.switchTab === 'function') {
                                                    window.switchTab('achat');
                                                }
                                            };
                                        }
                                    } 
                                    // Contextual action button for vendor dashboard
                                    else if (window.location.pathname.includes('vendor-dashboard')) {
                                        if (lowerTitle.includes('demande') || lowerTitle.includes('prospect') || lowerTitle.includes('client')) {
                                            options.actionText = 'Voir les demandes';
                                            options.actionCallback = () => {
                                                if (typeof window.switchVendorTab === 'function') {
                                                    window.switchVendorTab('leads');
                                                }
                                            };
                                        } else if (lowerTitle.includes('paiement') || lowerTitle.includes('payout') || lowerTitle.includes('commande')) {
                                            options.actionText = 'Voir le tableau';
                                            options.actionCallback = () => {
                                                if (typeof window.switchVendorTab === 'function') {
                                                    window.switchVendorTab('dashboard');
                                                }
                                            };
                                        }
                                    }
                                    
                                    window.showAnnouncementModal(notif.title, notif.message, resolvedType, true, options);
                                } else {
                                    this.showToast(notif.title, notif.message, resolvedType, 'solar:bell-bold');
                                }
                            } else {
                                this.showToast(notif.title, notif.message, resolvedType || 'info', 'solar:bell-bold');
                            }

                            // Refresh NotificationManager to update badge count
                            if (window.NotificationManager) {
                                window.NotificationManager.init(true);
                            }
                        }
                    })
                    .subscribe();
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
    },

    _urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
    },

    async _getServiceWorkerRegistration() {
        if (!('serviceWorker' in navigator)) return null;
        const existing = await navigator.serviceWorker.getRegistration('/');
        return existing || navigator.serviceWorker.register('/sw.js');
    },

    async _getPushPublicKey() {
        if (this.pushPublicKey) return this.pushPublicKey;
        if (!window.ApiClient) return null;

        const config = await window.ApiClient.get('/push/public-key', {
            suppressToast: true,
            suppressErrorLogging: true
        });

        if (!config?.enabled || !config?.publicKey) return null;
        this.pushPublicKey = config.publicKey;
        return this.pushPublicKey;
    },

    isDevicePushSupported() {
        return Boolean('Notification' in window && 'PushManager' in window && 'serviceWorker' in navigator);
    },

    async syncDevicePushSubscription() {
        if (!this.isDevicePushSupported() || Notification.permission !== 'granted') return false;
        if (!window.ApiClient) return false;

        const publicKey = await this._getPushPublicKey();
        if (!publicKey) return false;

        const registration = await this._getServiceWorkerRegistration();
        if (!registration?.pushManager) return false;

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this._urlBase64ToUint8Array(publicKey)
            });
        }

        await window.ApiClient.post('/push/subscribe', { subscription: subscription.toJSON() }, {
            suppressToast: true
        });

        return true;
    },

    async enableDeviceNotifications() {
        if (!this.isDevicePushSupported()) {
            this.showToast('Notifications appareil', 'Ce navigateur ne supporte pas les notifications PWA.', 'warning');
            return false;
        }

        const publicKey = await this._getPushPublicKey();
        if (!publicKey) {
            this.showToast('Notifications appareil', 'Les notifications appareil ne sont pas encore configurees cote serveur.', 'warning');
            return false;
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            this.showToast('Notifications appareil', 'Autorisation refusee ou ignoree.', 'warning');
            return false;
        }

        await this.syncDevicePushSubscription();
        this.showToast('Notifications appareil', 'Les notifications appareil sont activees.', 'success');
        return true;
    },

    async disableDeviceNotifications() {
        if (!this.isDevicePushSupported() || !window.ApiClient) return false;

        const registration = await this._getServiceWorkerRegistration();
        const subscription = await registration?.pushManager?.getSubscription();
        if (!subscription) return true;

        await window.ApiClient.delete('/push/subscribe', { endpoint: subscription.endpoint }, {
            suppressToast: true
        });
        await subscription.unsubscribe();
        this.showToast('Notifications appareil', 'Les notifications appareil sont desactivees.', 'info');
        return true;
    },

    async getDeviceNotificationStatus() {
        if (!this.isDevicePushSupported()) return 'unsupported';
        if (Notification.permission === 'denied') return 'denied';
        if (Notification.permission !== 'granted') return 'default';

        const registration = await this._getServiceWorkerRegistration();
        const subscription = await registration?.pushManager?.getSubscription();
        return subscription ? 'enabled' : 'default';
    }
};

window.AppNotifications = AppNotifications;

document.addEventListener('DOMContentLoaded', () => {
    AppNotifications.init();
});
