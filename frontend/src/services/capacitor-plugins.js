/**
 * NewKet — Capacitor Native Plugins
 * ===================================
 * Centralise l'initialisation des plugins Capacitor natifs :
 *   - Push Notifications (Firebase FCM)
 *   - Géolocalisation (Capacitor Geolocation)
 *
 * Ce module est importé par main.js et ne s'active que sur
 * l'app native (Android / iOS). Sur le web/PWA, les APIs
 * navigateur classiques restent utilisées.
 */

// ─── Détection plateforme ────────────────────────────────────────────────────

const isNative = () =>
    Boolean(
        window.Capacitor?.isNativePlatform?.() ||
        window.Capacitor?.getPlatform?.() === 'android' ||
        window.Capacitor?.getPlatform?.() === 'ios'
    );

// ─── PUSH NOTIFICATIONS ──────────────────────────────────────────────────────

/**
 * Demande la permission et enregistre le device pour les push notifications.
 * Stocke le FCM token dans Supabase (colonne `fcm_token` de la table `users`).
 */
async function initPushNotifications() {
    if (!isNative()) return;
    if (localStorage.getItem('newket_native_push_disabled') === 'true') {
        console.log('[NewKet Push] Notifications désactivées par l\'utilisateur dans les réglages.');
        return;
    }

    try {
        const { PushNotifications } = await import('@capacitor/push-notifications');

        // 1. Vérifier / demander la permission
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
            console.warn('[NewKet Push] Permission refusée par l\'utilisateur.');
            return;
        }

        // 2. Enregistrer le device auprès de FCM
        await PushNotifications.register();

        // 2b. Créer les canaux de notification Android (Oreo 8.0+)
        try {
            await PushNotifications.createChannel({
                id: 'chat',
                name: 'Messages et Discussions',
                description: 'Messages instantanés avec acheteurs et vendeurs',
                importance: 5, // Notification tête haute (heads-up) avec son & vibreur
                visibility: 1,
                vibration: true,
            });
            await PushNotifications.createChannel({
                id: 'orders',
                name: 'Commandes et Livraisons',
                description: 'Alertes de livraison et changements de statut',
                importance: 4,
                visibility: 1,
                vibration: true,
            });
            await PushNotifications.createChannel({
                id: 'default',
                name: 'Général',
                description: 'Alertes générales et offres',
                importance: 3,
                visibility: 1,
                vibration: true,
            });
            console.log('[NewKet Push] Canaux Android créés avec succès (chat, orders, default).');
        } catch (chanErr) {
            console.warn('[NewKet Push] Enregistrement des canaux non-bloquant :', chanErr?.message);
        }

        // 3. Récupérer le token FCM et le sauvegarder dans Supabase
        PushNotifications.addListener('registration', async (token) => {
            console.log('[NewKet Push] FCM Token reçu:', token.value);

            try {
                const user = window.AuthManager?.user;
                if (user?.id && window.supabaseClient) {
                    await window.supabaseClient
                        .from('users')
                        .update({ fcm_token: token.value })
                        .eq('id', user.id);
                    console.log('[NewKet Push] Token FCM sauvegardé en base.');
                }
            } catch (e) {
                console.warn('[NewKet Push] Erreur sauvegarde token:', e?.message);
            }

            // Exposer globalement pour usage futur
            window.newketFcmToken = token.value;
        });

        // 4. Erreur d'enregistrement
        PushNotifications.addListener('registrationError', (err) => {
            console.error('[NewKet Push] Erreur enregistrement:', err.error);
        });

        // 5. Notification reçue pendant que l'app est ouverte (foreground)
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('[NewKet Push] Notification reçue (foreground):', notification);

            // Afficher un toast natif NewKet
            const title = notification.title || 'NewKet';
            const body = notification.body || '';
            if (window.showToast) {
                window.showToast(body, 'info', title);
            }
        });

        // 6. L'utilisateur a tapé sur une notification (background/killed)
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            console.log('[NewKet Push] Action sur notification:', action);

            const data = action.notification?.data || {};

            // Navigation vers une page spécifique si précisé dans la data
            if (data.url) {
                const resolvedUrl = window.resolveUrl ? window.resolveUrl(data.url) : data.url;
                window.location.href = resolvedUrl;
            } else if (data.page) {
                window.location.href = `/src/pages/${data.page}.html`;
            }
        });

        console.log('[NewKet Push] Push Notifications initialisées avec succès.');

    } catch (e) {
        console.warn('[NewKet Push] Initialisation échouée (non-bloquant):', e?.message);
    }
}

// ─── GÉOLOCALISATION ─────────────────────────────────────────────────────────

/**
 * Utilitaire Promise.race avec timeout strict
 */
function withTimeout(promise, ms, errorMsg) {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(errorMsg || `Timeout après ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * Retourne la position courante via le plugin Capacitor (natif) ou
 * l'API navigateur (PWA/web) selon la plateforme.
 *
 * @param {object} options - Options Capacitor Geolocation
 * @returns {Promise<{latitude: number, longitude: number, accuracy: number}>}
 */
async function getCurrentPosition(options = {}) {
    const defaultOptions = {
        enableHighAccuracy: false, // Plus rapide et évite les blocages indoor à Kinshasa
        timeout: 5000,
        maximumAge: 15000,
        ...options
    };

    // Sur natif : utiliser le plugin Capacitor (plus précis, accès GPS)
    if (isNative()) {
        try {
            const { Geolocation } = await import('@capacitor/geolocation');

            // Vérifier les permissions
            let permStatus = await withTimeout(
                Geolocation.checkPermissions(),
                3000,
                'Délai vérification permissions dépassé'
            );

            if (permStatus.location === 'prompt' || permStatus.coarseLocation === 'prompt') {
                permStatus = await withTimeout(
                    Geolocation.requestPermissions(),
                    6000,
                    'Délai demande permission dépassé'
                );
            }

            if (permStatus.location !== 'granted' && permStatus.coarseLocation !== 'granted') {
                throw new Error('Permission de géolocalisation refusée.');
            }

            const position = await withTimeout(
                Geolocation.getCurrentPosition(defaultOptions),
                6000,
                'Délai acquisition GPS dépassé (6s)'
            );

            return {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                altitude: position.coords.altitude,
                altitudeAccuracy: position.coords.altitudeAccuracy,
                heading: position.coords.heading,
                speed: position.coords.speed,
                timestamp: position.timestamp
            };
        } catch (e) {
            console.warn('[NewKet Geo] Capacitor Geolocation échoué, fallback navigateur:', e?.message);
            // Fallback sur l'API navigateur si le plugin échoue
        }
    }

    // Sur web/PWA ou en cas d'erreur : utiliser l'API navigateur avec Promise timeout stricte
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('La géolocalisation n\'est pas supportée par ce navigateur.'));
            return;
        }

        let isDone = false;
        const fallbackTimer = setTimeout(() => {
            if (!isDone) {
                isDone = true;
                reject(new Error('Délai GPS dépassé (6s). Veuillez pointer votre adresse sur la carte.'));
            }
        }, 6000);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                if (isDone) return;
                isDone = true;
                clearTimeout(fallbackTimer);
                resolve({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                    altitude: pos.coords.altitude,
                    altitudeAccuracy: pos.coords.altitudeAccuracy,
                    heading: pos.coords.heading,
                    speed: pos.coords.speed,
                    timestamp: pos.timestamp
                });
            },
            (err) => {
                if (isDone) return;
                isDone = true;
                clearTimeout(fallbackTimer);
                reject(err);
            },
            defaultOptions
        );
    });
}

/**
 * Surveille la position en continu (watch).
 * Retourne l'ID du watcher pour pouvoir l'annuler plus tard.
 *
 * @param {function} callback - Appelé à chaque mise à jour de position
 * @param {function} errorCallback - Appelé en cas d'erreur
 * @param {object} options
 * @returns {Promise<string|number>} watcherId
 */
async function watchPosition(callback, errorCallback = null, options = {}) {
    const defaultOptions = {
        enableHighAccuracy: true,
        ...options
    };

    if (isNative()) {
        try {
            const { Geolocation } = await import('@capacitor/geolocation');
            const watcherId = await Geolocation.watchPosition(defaultOptions, (position, err) => {
                if (err) {
                    errorCallback?.(err);
                    return;
                }
                callback({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                });
            });
            return watcherId;
        } catch (e) {
            console.warn('[NewKet Geo] watchPosition Capacitor échoué:', e?.message);
        }
    }

    // Fallback web
    return navigator.geolocation.watchPosition(
        (pos) => callback({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp
        }),
        errorCallback,
        defaultOptions
    );
}

/**
 * Arrête un watcher de position.
 * @param {string|number} watcherId
 */
async function clearWatch(watcherId) {
    if (!watcherId) return;

    if (isNative()) {
        try {
            const { Geolocation } = await import('@capacitor/geolocation');
            await Geolocation.clearWatch({ id: watcherId });
            return;
        } catch (e) {
            console.warn('[NewKet Geo] clearWatch Capacitor échoué:', e?.message);
        }
    }

    navigator.geolocation.clearWatch(watcherId);
}


// ─── BIOMÉTRIE & CODE APPAREIL (Face ID / Touch ID / Code PIN) ──────────────

/**
 * Authentifie l'utilisateur via Face ID / Empreinte ou Code de l'appareil (iOS / Android).
 * Utilise la politique deviceOwnerAuthentication (Face ID d'abord, puis code PIN appareil en repli).
 * @param {string} reason
 * @returns {Promise<boolean>}
 */
export async function authenticateDeviceOwner(reason = "Confirmez votre identité") {
    // 1. Mobile natif (iOS & Android) : plugin Capacitor BiometricAuth natif (inchangé)
    if (isNative()) {
        try {
            const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
            const available = await BiometricAuth.checkBiometry();
            console.log('[NewKet Biometric] checkBiometry:', available);
            
            // Si la biométrie ou le code d'appareil est disponible
            await BiometricAuth.authenticate({
                reason: reason,
                cancelTitle: 'Annuler',
                allowDeviceCredential: true, // Permet le repli immédiat sur le code PIN de l'iPhone/Android
                iosFallbackTitle: "Utiliser le code de l'iPhone"
            });
            console.log('[NewKet Biometric] ✅ Authentification appareil réussie.');
            return true;
        } catch (e) {
            console.warn('[NewKet Biometric] Échec ou annulation appareil:', e?.message || e);
            return false;
        }
    }

    // 2. Web (Safari, Chrome sur PC / Mac) : WebAuthn (Touch ID, Face ID, Windows Hello, Code appareil)
    if (typeof window !== 'undefined' && window.PublicKeyCredential && typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        try {
            const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            if (available && navigator.credentials && navigator.credentials.create) {
                console.log('[NewKet Biometric] Déclenchement biométrie WebAuthn pour :', reason);
                const challenge = new Uint8Array(32);
                window.crypto.getRandomValues(challenge);
                const userId = new Uint8Array(16);
                window.crypto.getRandomValues(userId);

                await navigator.credentials.create({
                    publicKey: {
                        challenge: challenge,
                        rp: { name: "NewKet", id: window.location.hostname },
                        user: {
                            id: userId,
                            name: "vendor-auth@newket.com",
                            displayName: "NewKet Sécurité Vendeur"
                        },
                        pubKeyCredParams: [
                            { alg: -7, type: "public-key" },
                            { alg: -257, type: "public-key" }
                        ],
                        authenticatorSelection: {
                            authenticatorAttachment: "platform", // Touch ID / Face ID / Windows Hello / Code PIN
                            residentKey: "discouraged", // Privilégie l'authentificateur local de l'appareil (Windows Hello) plutôt que Google Cloud
                            requireResidentKey: false,
                            userVerification: "required"
                        },
                        timeout: 60000
                    }
                });
                console.log('[NewKet Biometric] ✅ Authentification WebAuthn appareil réussie.');
                return true;
            }
        } catch (e) {
            console.warn('[NewKet Biometric] Échec ou annulation WebAuthn :', e?.message || e?.name);
            return false;
        }
    }

    return false;
}

// ─── EXPOSITION GLOBALE ───────────────────────────────────────────────────────

/**
 * Initialise tous les plugins Capacitor.
 * Appelé par main.js après l'initialisation de l'AuthManager.
 */
export async function initCapacitorPlugins() {
    if (!isNative()) return;

    console.log('[NewKet] Initialisation des plugins Capacitor...');

    // Push Notifications (seulement si l'utilisateur est connecté)
    initPushNotifications().catch(e =>
        console.warn('[NewKet] Push init non-bloquant:', e?.message)
    );
}

// Géolocalisation exposée globalement pour usage dans tout le code
window.authenticateDeviceOwner = authenticateDeviceOwner;
window.NewKetGeo = {
    getCurrentPosition,
    watchPosition,
    clearWatch,
    isNative
};

export { getCurrentPosition, watchPosition, clearWatch };
