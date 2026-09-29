/**
 * NewKet Realtime & PWA Notifications
 * Handles Toast UI, Supabase Realtime (Price drops for favorites, Order updates),
 * and PWA Add-To-Home-Screen prompt.
 */

const AppNotifications = {
    toastContainer: null,
    deferredPrompt: null,
    pushPublicKey: null,
    serviceWorkerUpdateTimer: null,
    broadcastModalSeenKey: 'newket_seen_broadcast_modal_ids',
    _broadcastModalListenerBound: false,

    init() {
        console.log('[AppNotifications] Initialization started');
        this._setupPWA();
        
        const bootRealtime = () => {
            console.log('[AppNotifications] Booting realtime features');
            this._setupRealtime();
            this._setupBroadcastModalRecovery();
            this.syncDevicePushSubscription().catch(err => {
                console.warn('[NewKet] Device push sync skipped:', err?.message || err);
            });
        };

        if (window.newketInitialized) {
            bootRealtime();
        } else {
            window.addEventListener('newketInitialized', bootRealtime, { once: true });
        }
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

        const path = String(window.location.pathname || '/').toLowerCase().replace(/\/+$/, '') || '/';
        const isBrowseFeed = path === '/'
            || /(?:^|\/)index(?:\.html)?$/.test(path)
            || /(?:^|\/)catalog(?:\.html)?$/.test(path);

        // Do not subscribe the home/catalogue to every product update. Those
        // pages can be open on many devices and only need fresh data on reload
        // or pull-to-refresh; product detail and dashboards keep targeted live UI.
        if (!isBrowseFeed) {
            client.channel('public:products')
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, payload => {
                    if (payload.new.price < payload.old.price) {
                        const favs = window.FavoritesManager ? FavoritesManager.getFavorites() : [];
                        if (favs.includes(payload.new.id)) {
                            this.showToast(
                                'Baisse de prix ! ',
                                `Bonne nouvelle, un article de vos favoris ("${payload.new.name}") est maintenant à ${window.CurrencyManager ? CurrencyManager.formatPrice(payload.new.price) : payload.new.price + ' FC'}.`,
                                'success',
                                'solar:tag-price-bold'
                            );
                        }
                    }
                })
                .subscribe();
        }

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
                            : ((notif.type === 'broadcast' || String(notif.type || '').startsWith('broadcast-modal:') || String(notif.type || '').startsWith('guest-modal:')) ? 'info' : notif.type);
                        
                        const isBroadcast = notif.type === 'broadcast'
                            || String(notif.type || '').startsWith('broadcast:')
                            || String(notif.type || '').startsWith('broadcast-modal:')
                            || String(notif.type || '').startsWith('guest-modal:');
                        const isPopupNotification = typeof window.isPopupNotification === 'function'
                            ? window.isPopupNotification(notif.type)
                            : isBroadcast;

                        const isForMe = notif.target_role === 'all' || 
                                        notif.target_role === role || 
                                        (userId && notif.user_id === userId) || 
                                        (userEmail && notif.user_email === userEmail);

                        if (isForMe) {
                            // push-only: device notification only — no in-app display
                            if (String(notif.type || '').startsWith('push-only:')) {
                                if (window.NotificationManager) window.NotificationManager.init(true);
                                return;
                            }

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
                                                    window.switchTab('purchases');
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
                                    
                                    if (this._isBroadcastModalType(notif.type)) {
                                        const token = localStorage.getItem('supabase.auth.token');
                                        const isLoggedIn = !!role || !!token;
                                        if (isLoggedIn) return; // Ne pas afficher aux connectés
                                        
                                        window.showAnnouncementModal(notif.title, notif.message, resolvedType, true, options);
                                        this._markBroadcastModalShown(notif.id);
                                    } else {
                                        window.showAnnouncementModal(notif.title, notif.message, resolvedType, true, options);
                                    }
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

    _loadSeenBroadcastModalIds() {
        try {
            const raw = localStorage.getItem(this.broadcastModalSeenKey);
            const parsed = raw ? JSON.parse(raw) : [];
            return new Set(Array.isArray(parsed) ? parsed : []);
        } catch {
            return new Set();
        }
    },

    _saveSeenBroadcastModalIds(seenIds) {
        try {
            localStorage.setItem(this.broadcastModalSeenKey, JSON.stringify([...seenIds].slice(-200)));
        } catch (err) {
            console.warn('[NewKet] Unable to persist broadcast modal ids:', err?.message || err);
        }
    },

    _isBroadcastModalType(type) {
        return String(type || '').startsWith('guest-modal:') || String(type || '').startsWith('broadcast-modal:');
    },

    _markBroadcastModalShown(notificationId) {
        if (!notificationId) return;
        const seen = this._loadSeenBroadcastModalIds();
        if (seen.has(notificationId)) return;
        seen.add(notificationId);
        this._saveSeenBroadcastModalIds(seen);
    },

    _hasBroadcastModalBeenShown(notificationId) {
        if (!notificationId) return false;
        return this._loadSeenBroadcastModalIds().has(notificationId);
    },

    _showBroadcastModalNotification(notif, options = {}) {
        if (!notif || !notif.id || !window.showAnnouncementModal) return false;
        
        // --- NOUVELLE LOGIQUE "INVITÉ ACTIF" ---
        // Ne montrer que si l'utilisateur N'EST PAS connecté.
        const role = localStorage.getItem('newketRole');
        const token = localStorage.getItem('supabase.auth.token'); // common check for auth
        const isLoggedIn = !!role || !!token;
        if (isLoggedIn) {
            return false; // Les utilisateurs connectés ne voient pas les modales invités
        }
        
        if (this._hasBroadcastModalBeenShown(notif.id) && !options.forceReplay) return false;

        const resolvedType = typeof window.normalizeNotificationType === 'function'
            ? window.normalizeNotificationType(notif.type)
            : (this._isBroadcastModalType(notif.type) ? 'info' : notif.type);

        window.showAnnouncementModal(notif.title, notif.message, resolvedType || 'info', true, options);
        this._markBroadcastModalShown(notif.id);
        return true;
    },

    _setupBroadcastModalRecovery() {
        if (this._broadcastModalListenerBound) return;
        this._broadcastModalListenerBound = true;

        const processPendingBroadcastModals = () => {
            // S'il est connecté, on ne traite même pas les popups invités
            const role = localStorage.getItem('newketRole');
            const token = localStorage.getItem('supabase.auth.token');
            if (role || token) return;

            if (!window.NotificationManager || typeof window.NotificationManager.getNotifications !== 'function') return;
            const notifications = window.NotificationManager.getNotifications() || [];
            
            notifications
                .filter((notif) => this._isBroadcastModalType(notif.type))
                .forEach((notif) => {
                    this._showBroadcastModalNotification(notif);
                });
        };

        window.addEventListener('notificationsUpdated', processPendingBroadcastModals);
        // Au changement d'état d'authentification (si on vient de se connecter), fermer la modale
        window.addEventListener('authStateChange', (e) => {
            if (e.detail?.isLoggedIn) {
                const modal = document.getElementById('nk-announcement-modal');
                if (modal) modal.remove();
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) processPendingBroadcastModals();
        });

        processPendingBroadcastModals();
    },

    _setupPWA() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            
            // Dispatch a custom event so the UI can show an "Install" button
            window.dispatchEvent(new CustomEvent('pwaInstallAvailable'));
        });

        if ('serviceWorker' in navigator) {
            this._setupServiceWorkerUpdates();
        }
    },

    _setupServiceWorkerUpdates() {
        // Vite development must stay network-first and must not show production
        // service-worker update prompts while testing interactive uploads.
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return;
        }

        const reloadKey = 'newket-sw-reloading';
        sessionStorage.removeItem(reloadKey);

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (sessionStorage.getItem(reloadKey) === '1') return;
            sessionStorage.setItem(reloadKey, '1');
            window.location.reload();
        });

        navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
            .then((registration) => {
                // Appliquer la mise à jour silencieusement quand l'utilisateur clique sur le logo
                document.addEventListener('click', (e) => {
                    const logoLink = e.target.closest('.header-logo-link') || e.target.closest('.nk-header-logo-link');
                    if (logoLink && registration.waiting) {
                        e.preventDefault();
                        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                    }
                });

                // On garde la vérification périodique silencieuse (sans toast)
                window.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible') {
                        registration.update().catch(() => {});
                    }
                });

                if (!this.serviceWorkerUpdateTimer) {
                    this.serviceWorkerUpdateTimer = window.setInterval(() => {
                        registration.update().catch(() => {});
                    }, 30 * 60 * 1000);
                }
            })
            .catch(err => console.error('[NewKet] SW registration failed', err));
    },

    promptInstall() {
        if (!this.deferredPrompt) {
            this.showToast('Information', "L'application est déjà installée ou non supportée sur ce navigateur.", 'info');
            return;
        }
        this.deferredPrompt.prompt();
        this.deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                this.showToast('Succès', "Merci d'avoir installé NewKet sur votre appareil ! ", 'success');
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
        return existing || navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
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

    getDeviceNotificationGuidance(status = 'default') {
        const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent || '')
            || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches
            || window.navigator.standalone === true;

        if (status === 'enabled') return 'Actives sur cet appareil.';
        if (status === 'denied') return 'Bloquees dans les reglages du navigateur ou du systeme.';
        if (status === 'unsupported') {
            return isIos && !isStandalone
                ? "Sur iPhone, installez NewKet sur l'ecran d'accueil puis ouvrez l'app installee."
                : 'Navigateur non supporte. Utilisez la PWA installee ou Chrome/Edge/Samsung Internet.';
        }

        return isIos && !isStandalone
            ? "Installez NewKet en PWA pour une reception fiable sur iPhone."
            : 'PWA installee recommandee. Navigateur normal: support variable; navigateur integre: generalement non.';
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
            throw new Error('Navigateur non supporte');
        }

        const publicKey = await this._getPushPublicKey();
        if (!publicKey) {
            throw new Error('Configuration serveur manquante');
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            throw new Error('Permission denied');
        }

        await this.syncDevicePushSubscription();
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
        return true;
    },

    async getDeviceNotificationStatus() {
        const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent || '')
            || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches
            || window.navigator.standalone === true;

        // iPhone/iPad in browser (not installed as PWA) — needs install first
        if (isIos && !isStandalone) return 'ios-browser';

        if (!this.isDevicePushSupported()) return 'unsupported';
        if (Notification.permission === 'denied') return 'denied';
        if (Notification.permission !== 'granted') return 'default';

        const registration = await this._getServiceWorkerRegistration();
        const subscription = await registration?.pushManager?.getSubscription();
        return subscription ? 'enabled' : 'default';
    }
};

window.AppNotifications = AppNotifications;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        AppNotifications.init();
    });
} else {
    AppNotifications.init();
}
