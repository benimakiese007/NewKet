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

// ─── EXPOSITION GLOBALE ───────────────────────────────────────────────────────

/**
 * Initialise tous les plugins Capacitor.
 * Appelé par main.js après l'initialisation de l'AuthManager.
 */
export async function initCapacitorPlugins() {
    if (!window.Capacitor) return;

    console.log('[NewKet] Initialisation des plugins Capacitor...');

    // Push Notifications (seulement si l'utilisateur est connecté)
    initPushNotifications().catch(e =>
        console.warn('[NewKet] Push init non-bloquant:', e?.message)
    );
}

// Géolocalisation exposée globalement pour usage dans tout le code
window.NewKetGeo = {
    getCurrentPosition,
    watchPosition,
    clearWatch,
    isNative
};

export { getCurrentPosition, watchPosition, clearWatch };
