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

                                // Synchronisation avec les Live Activities natives (iOS & Android)
                                if (window.LiveOrderTracker) {
                                    window.LiveOrderTracker.trackOrder(payload.new).catch(e => {
                                        console.warn('[NewKet] LiveOrderTracker non bloquant :', e?.message);
                                    });
                                }
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

    _isNative() {
        return Boolean(
            window.Capacitor && (
                (typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) ||
                window.Capacitor.isNative ||
                window.Capacitor.getPlatform?.() === 'android' ||
                window.Capacitor.getPlatform?.() === 'ios'
            )
        );
    },

    _getPlatform() {
        if (this._isNative()) {
            const capPlatform = window.Capacitor?.getPlatform?.();
            if (capPlatform === 'android') return 'android-app';
            if (capPlatform === 'ios') return 'ios-app';
            return 'mobile-app';
        }
        const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent || '')
            || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches
            || window.navigator.standalone === true;

        if (isIos) {
            return isStandalone ? 'ios-pwa' : 'ios-browser';
        }
        if (isStandalone) {
            return 'pwa';
        }
        return 'web-browser';
    },

    async _getCapacitorPushPlugin() {
        if (window.Capacitor?.Plugins?.PushNotifications) {
            return window.Capacitor.Plugins.PushNotifications;
        }
        try {
            const mod = await import('@capacitor/push-notifications');
            return mod.PushNotifications || window.Capacitor?.Plugins?.PushNotifications || null;
        } catch {
            return window.Capacitor?.Plugins?.PushNotifications || null;
        }
    },

    isDevicePushSupported() {
        if (this._isNative()) {
            return true;
        }
        return Boolean('Notification' in window && 'PushManager' in window && 'serviceWorker' in navigator);
    },

    getDeviceNotificationGuidance(status = 'default') {
        const platform = this._getPlatform();

        if (status === 'enabled') {
            switch (platform) {
                case 'android-app':
                    return 'Actives sur votre application Android (alertes et commandes en direct).';
                case 'ios-app':
                    return 'Actives sur votre iPhone (alertes et commandes en direct).';
                case 'mobile-app':
                    return 'Actives sur votre application mobile.';
                case 'ios-pwa':
                    return 'Actives sur votre iPhone (PWA installée).';
                case 'pwa':
                    return 'Actives sur cette application installée.';
                default:
                    return 'Actives sur ce navigateur (alertes reçues même en arrière-plan).';
            }
        }

        if (status === 'denied') {
            switch (platform) {
                case 'android-app':
                    return 'Notifications désactivées dans les paramètres Android. Ouvrez Paramètres > Applications > NewKet > Notifications.';
                case 'ios-app':
                    return 'Notifications désactivées sur votre iPhone. Ouvrez Réglages > NewKet > Notifications pour les activer.';
                case 'mobile-app':
                    return 'Notifications désactivées dans les réglages système de votre téléphone.';
                case 'ios-pwa':
                    return 'Notifications bloquées. Allez dans Réglages > Notifications > NewKet sur votre iPhone.';
                default:
                    return 'Notifications bloquées par votre navigateur. Autorisez-les via l\'icône de cadenas ou paramètres de l\'adresse web.';
            }
        }

        if (status === 'ios-browser') {
            return 'Sur iPhone, installez d\'abord NewKet sur l\'écran d\'accueil via Safari (Partager > Sur l\'écran d\'accueil).';
        }

        if (status === 'unsupported') {
            return 'Ce navigateur ou environnement ne supporte pas les notifications système.';
        }

        // status === 'default'
        switch (platform) {
            case 'android-app':
                return 'Recevez les alertes de commandes et d\'offres directement sur votre téléphone Android.';
            case 'ios-app':
                return 'Recevez les alertes de commandes et devis directement sur votre iPhone.';
            case 'mobile-app':
                return 'Activez pour recevoir les alertes sur votre téléphone.';
            case 'ios-pwa':
                return 'Activez pour recevoir les alertes sur l\'écran verrouillé de votre iPhone.';
            case 'pwa':
                return 'Activez pour recevoir les alertes instantanées sur cet appareil.';
            default:
                return 'Recevez les alertes de commandes, devis et messages en temps réel sur cet appareil.';
        }
    },

    getDeviceNotificationHTML(status = 'default') {
        const platform = this._getPlatform();

        if (status === 'enabled') {
            let label = this.getDeviceNotificationGuidance('enabled');
            return `<span class="inline-flex items-center gap-1.5 text-emerald-600 font-semibold text-xs"><iconify-icon icon="solar:check-circle-bold" class="text-sm"></iconify-icon> ${label}</span>`;
        }

        if (status === 'denied') {
            switch (platform) {
                case 'android-app':
                    return '<span class="inline-flex items-center gap-1.5 text-amber-700 font-medium text-xs"><iconify-icon icon="solar:danger-triangle-bold" class="text-amber-500 text-sm"></iconify-icon> Bloquées sur votre téléphone. Ouvrez <strong>Paramètres &gt; Applications &gt; NewKet &gt; Notifications</strong>.</span>';
                case 'ios-app':
                    return '<span class="inline-flex items-center gap-1.5 text-amber-700 font-medium text-xs"><iconify-icon icon="solar:danger-triangle-bold" class="text-amber-500 text-sm"></iconify-icon> Bloquées sur votre iPhone. Ouvrez <strong>Réglages &gt; NewKet &gt; Notifications</strong> pour autoriser.</span>';
                case 'ios-pwa':
                    return '<span class="inline-flex items-center gap-1.5 text-amber-700 font-medium text-xs"><iconify-icon icon="solar:danger-triangle-bold" class="text-amber-500 text-sm"></iconify-icon> Bloquées dans Réglages &gt; Notifications &gt; NewKet sur votre iPhone.</span>';
                default:
                    return '<span>🔔 Notifications bloquées par votre navigateur. <a href="https://support.google.com/chrome/answer/3220216" target="_blank" rel="noopener" class="underline text-blue-600 font-semibold hover:text-blue-800">Comment les réactiver →</a></span>';
            }
        }

        if (status === 'ios-browser') {
            return `<div class="mt-2 p-3 bg-amber-50/90 border border-amber-200/70 rounded-xl text-xs text-amber-900">
                <p class="font-bold mb-1 flex items-center gap-1.5"><iconify-icon icon="solar:info-circle-bold" class="text-amber-600 text-sm"></iconify-icon> Pour activer les notifications sur iPhone (Safari) :</p>
                <ol class="list-decimal list-inside space-y-1 text-amber-800">
                    <li>Touchez l'icône Partager <iconify-icon icon="solar:export-outline" class="inline align-middle"></iconify-icon> en bas de Safari</li>
                    <li>Choisissez <strong>"Sur l'écran d'accueil"</strong></li>
                    <li>Ouvrez l'application installée pour autoriser les alertes</li>
                </ol>
            </div>`;
        }

        if (status === 'unsupported') {
            return '<span class="text-xs text-gray-500">Navigateur ou environnement non supporté. Utilisez l\'application mobile ou Chrome/Safari.</span>';
        }

        return `<span class="text-xs text-gray-500">${this.getDeviceNotificationGuidance('default')}</span>`;
    },

    getDeviceNotificationErrorMessage(error) {
        const platform = this._getPlatform();
        const isDenied = error?.message?.includes('denied') || error?.message?.includes('refusée') || error?.message?.includes('permission');

        if (this._isNative()) {
            if (isDenied) {
                return platform === 'ios-app'
                    ? 'Notifications désactivées. Allez dans Réglages > NewKet > Notifications pour les autoriser.'
                    : 'Notifications désactivées. Allez dans Paramètres Android > Applications > NewKet > Notifications pour les autoriser.';
            }
            return error?.message || 'Impossible d\'activer les notifications sur l\'application.';
        }

        if (isDenied) {
            return 'Notifications bloquées par votre navigateur. Autorisez-les dans les paramètres de votre navigateur.';
        }
        return 'Impossible de modifier les notifications. Vérifiez votre connexion et réessayez.';
    },

    async syncDevicePushSubscription() {
        if (this._isNative()) return false;
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
        if (this._isNative()) {
            const PushNotifications = await this._getCapacitorPushPlugin();
            if (!PushNotifications) {
                throw new Error('Plugin mobile indisponible sur cet appareil.');
            }

            let perm = await PushNotifications.checkPermissions();
            if (perm.receive === 'prompt') {
                perm = await PushNotifications.requestPermissions();
            }

            if (perm.receive !== 'granted') {
                throw new Error('Permission refusée par le système');
            }

            localStorage.removeItem('newket_native_push_disabled');
            try {
                await PushNotifications.register();
            } catch (regErr) {
                console.warn('[NewKet] Push registration warning:', regErr?.message || regErr);
            }
            return true;
        }

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
        if (this._isNative()) {
            localStorage.setItem('newket_native_push_disabled', 'true');
            return true;
        }

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
        const platform = this._getPlatform();

        if (this._isNative()) {
            const PushNotifications = await this._getCapacitorPushPlugin();
            if (!PushNotifications) return 'unsupported';
            try {
                const perm = await PushNotifications.checkPermissions();
                if (perm.receive === 'granted') {
                    const isLocallyDisabled = localStorage.getItem('newket_native_push_disabled') === 'true';
                    return isLocallyDisabled ? 'default' : 'enabled';
                }
                if (perm.receive === 'denied') return 'denied';
                return 'default';
            } catch (err) {
                console.warn('[NewKet] Native checkPermissions error:', err);
                return 'default';
            }
        }

        if (platform === 'ios-browser') return 'ios-browser';

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
