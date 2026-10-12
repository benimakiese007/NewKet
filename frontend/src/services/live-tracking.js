/**
 * NewKet — Native Live Tracking Service (iOS ActivityKit & Android Live Notifications)
 * ====================================================================================
 * Connecte les événements de commande Supabase en temps réel aux API système natives :
 *   - Sur iOS : ActivityKit (Dynamic Island + Lock Screen Widget SwiftUI)
 *   - Sur Android : Notifications persistantes de suivi en direct (Lock Screen + Progress Stepper)
 *   - Sur Web/PWA : Mode dégradé sécurisé (no-op avec logs clairs)
 */

const STORAGE_KEY_LOGS = 'newket_native_diag_logs';
const MAX_LOCAL_LOGS = 40;

// ─── Statuts Backend NewKet ➔ Échelons de Progression ─────────────────────────

const STEP_MAPPING = {
    'PENDING': {
        step: 1,
        progress: 0.15,
        title: 'Commande confirmée',
        description: 'Votre paiement est validé. En attente de la boutique.',
    },
    'PROCESSING': {
        step: 2,
        progress: 0.40,
        title: 'Préparation en cours',
        description: 'Le vendeur prépare vos articles.',
    },
    'READY_FOR_DELIVERY': {
        step: 2,
        progress: 0.50,
        title: 'Colis prêt',
        description: 'La commande attend la prise en charge du livreur.',
    },
    'SHIPPED': {
        step: 3,
        progress: 0.65,
        title: 'Commande expédiée',
        description: 'Votre colis a quitté la boutique.',
    },
    'IN_DELIVERY': {
        step: 3,
        progress: 0.85,
        title: 'En cours de livraison 🛵',
        description: 'Le livreur approche de votre point de livraison.',
    },
    'DELIVERED': {
        step: 4,
        progress: 1.0,
        title: 'Commande livrée 🎉',
        description: 'Colis remis. Merci pour votre confiance !',
    },
    'COMPLETED': {
        step: 4,
        progress: 1.0,
        title: 'Commande terminée',
        description: 'Transaction clôturée avec succès.',
    },
    'CANCELLED': {
        step: 1,
        progress: 0.0,
        title: 'Commande annulée ❌',
        description: 'La commande a été annulée.',
        isCancelled: true,
    },
    'REFUNDED': {
        step: 1,
        progress: 0.0,
        title: 'Commande remboursée',
        description: 'Les fonds ont été restitués.',
        isCancelled: true,
    },
    'DISPUTED': {
        step: 2,
        progress: 0.5,
        title: 'Litige en cours ⚠️',
        description: 'Notre service client examine la commande.',
        isCancelled: true,
    },
};

// ─── Service Singleton ─────────────────────────────────────────────────────────

class LiveOrderTrackerService {
    constructor() {
        this.plugin = null;
        this.isNative = false;
        this.platform = 'web';
        this.isSupported = false;
        this.activeOrderIds = new Set();
        this._initPromise = null;
        this.lastError = null;
        this.lastOperation = null;
    }

    /**
     * Enregistre un événement dans les logs locaux (localStorage).
     */
    logEvent(tag, message, status = 'INFO', details = null) {
        const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const date = new Date().toISOString();
        const entry = {
            id: 'log-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            time,
            date,
            tag,
            message: String(message || ''),
            status, // 'SUCCESS', 'ERROR', 'WARNING', 'INFO'
            details: details ? (typeof details === 'object' ? details : { info: details }) : null
        };

        try {
            const raw = localStorage.getItem(STORAGE_KEY_LOGS);
            const list = raw ? JSON.parse(raw) : [];
            list.unshift(entry);
            if (list.length > MAX_LOCAL_LOGS) {
                list.length = MAX_LOCAL_LOGS;
            }
            localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(list));
        } catch (_) {
            // LocalStorage quota or access error
        }

        console.info(`[LiveOrderTracker][${tag}] [${status}] ${message}`, details || '');
        return entry;
    }

    /**
     * Récupère tous les logs stockés localement.
     */
    getLocalLogs() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_LOGS);
            return raw ? JSON.parse(raw) : [];
        } catch (_) {
            return [];
        }
    }

    /**
     * Efface les logs stockés localement.
     */
    clearLogs() {
        try {
            localStorage.removeItem(STORAGE_KEY_LOGS);
        } catch (_) {}
    }

    /**
     * Initialise le plugin Capacitor natif.
     */
    async init() {
        if (this._initPromise) return this._initPromise;

        this._initPromise = (async () => {
            this.platform = window.Capacitor?.getPlatform?.() || (window.location.protocol === 'capacitor:' ? 'ios' : 'web');
            this.isNative = Boolean(
                window.Capacitor?.isNativePlatform?.() ||
                this.platform === 'ios' ||
                this.platform === 'android'
            );

            if (!this.isNative) {
                this.logEvent('INIT', 'Exécution en mode Web / PWA (Live Activities désactivées)', 'INFO');
                this.isSupported = false;
                return { available: false, enabled: false, reason: 'WEB_ENVIRONMENT' };
            }

            try {
                // 1. Chercher d'abord dans window.Capacitor.Plugins
                let pluginInstance = window.Capacitor?.Plugins?.LiveActivityPlugin;

                // 2. Fallback via registerPlugin si nécessaire
                if (!pluginInstance) {
                    try {
                        const { registerPlugin } = await import('@capacitor/core');
                        pluginInstance = registerPlugin('LiveActivityPlugin');
                    } catch (impErr) {
                        this.logEvent('INIT', 'Import @capacitor/core échoué : ' + impErr?.message, 'WARNING');
                    }
                }

                if (!pluginInstance) {
                    throw new Error('Plugin LiveActivityPlugin introuvable dans le runtime Capacitor.');
                }

                this.plugin = pluginInstance;

                // Vérifier la disponibilité native
                const status = await this.plugin.isAvailable();
                this.isSupported = Boolean(status?.available && status?.enabled);

                this.logEvent('INIT', `Plugin natif prêt (Plateforme: ${this.platform})`, this.isSupported ? 'SUCCESS' : 'WARNING', {
                    available: status?.available,
                    enabled: status?.enabled,
                    iosVersion: status?.iosVersion
                });

                // Écouter les push tokens APNs (iOS)
                if (this.plugin.addListener) {
                    this.plugin.addListener('activityPushToken', (data) => {
                        this.logEvent('APNS', 'Push token reçu pour ' + data?.orderId, 'INFO');
                        this._syncPushTokenWithBackend(data?.orderId, data?.token);
                    });
                }

                return status;
            } catch (err) {
                this.lastError = err?.message || String(err);
                this.isSupported = false;
                this.logEvent('INIT', 'Échec initialisation plugin natif : ' + this.lastError, 'ERROR');
                return { available: false, enabled: false, error: this.lastError };
            }
        })();

        return this._initPromise;
    }

    /**
     * Démarre ou met à jour le suivi en direct pour une commande donnée.
     * @param {Object} order - Objet commande NewKet
     * @returns {Promise<Object>} Résultat complet (sans masquer les erreurs)
     */
    async trackOrder(order) {
        if (!order || !order.id) {
            throw new Error('Données de commande invalides : order.id est requis.');
        }

        await this.init();

        const rawStatus = String(order.status || 'PENDING').toUpperCase();
        const mapping = STEP_MAPPING[rawStatus] || STEP_MAPPING['PROCESSING'];

        const orderId = String(order.id);
        const orderNumber = order.order_number || `#NK-${orderId.slice(0, 6).toUpperCase()}`;
        const shopName = order.shop_name || order.shops?.name || 'NewKet';
        const itemCount = Array.isArray(order.items) ? order.items.length : (Number(order.item_count) || 1);
        const etaText = order.eta_text || order.estimated_delivery_time || order.eta || null;

        const payload = {
            orderId,
            orderNumber,
            shopName,
            itemCount,
            status: rawStatus,
            statusTitle: mapping.title,
            statusDescription: mapping.description,
            progress: mapping.progress,
            currentStep: mapping.step,
            totalSteps: 4,
            etaText,
            isCancelled: Boolean(mapping.isCancelled),
        };

        if (!this.isNative) {
            const msg = 'Live Activities non supportées sur le Web. Test simulé avec succès.';
            this.logEvent('TRACK', msg, 'INFO', payload);
            return { success: true, simulated: true, message: msg };
        }

        if (!this.plugin) {
            const err = new Error('Plugin LiveActivityPlugin non chargé sur cet appareil.');
            this.logEvent('TRACK', err.message, 'ERROR');
            throw err;
        }

        if (!this.isSupported) {
            const err = new Error('Live Activities désactivées dans les Réglages iOS de NewKet ou non supportées.');
            this.logEvent('TRACK', err.message, 'ERROR');
            throw err;
        }

        try {
            let result;
            if (this.activeOrderIds.has(orderId)) {
                this.lastOperation = 'UPDATE';
                result = await this.plugin.updateActivity(payload);
                this.logEvent('UPDATE', `Activité mise à jour pour ${orderNumber} (${rawStatus})`, 'SUCCESS', result);
            } else {
                this.lastOperation = 'START';
                result = await this.plugin.startActivity(payload);
                this.activeOrderIds.add(orderId);
                this.logEvent('START', `Activité créée pour ${orderNumber} (${rawStatus})`, 'SUCCESS', result);
            }

            // Auto-fermeture si terminée
            if (rawStatus === 'DELIVERED' || rawStatus === 'COMPLETED' || rawStatus === 'CANCELLED') {
                setTimeout(() => {
                    this.stopTracking(orderId).catch(() => {});
                }, 20000);
            }

            return {
                success: true,
                orderId,
                activityId: result?.activityId || null,
                updated: Boolean(result?.updated),
                status: rawStatus
            };
        } catch (err) {
            this.lastError = err?.message || String(err);
            this.logEvent(this.lastOperation || 'TRACK', `Échec de l'opération : ${this.lastError}`, 'ERROR', { payload });
            throw err;
        }
    }

    /**
     * Arrête l'activité de suivi pour une commande.
     * @param {string} orderId
     */
    async stopTracking(orderId) {
        await this.init();

        if (!this.isNative) {
            this.logEvent('STOP', `Arrêt simulé (Web) pour ${orderId || 'toutes'}`, 'INFO');
            return { success: true, simulated: true };
        }

        if (!this.plugin) {
            throw new Error('Plugin natif non disponible.');
        }

        try {
            this.lastOperation = 'STOP';
            const res = await this.plugin.endActivity({ orderId: orderId || null });
            if (orderId) {
                this.activeOrderIds.delete(orderId);
            } else {
                this.activeOrderIds.clear();
            }
            this.logEvent('STOP', `Activité arrêtée pour ${orderId || 'toutes'}`, 'SUCCESS', res);
            return { success: true, orderId };
        } catch (err) {
            this.lastError = err?.message || String(err);
            this.logEvent('STOP', `Erreur lors de l'arrêt : ${this.lastError}`, 'ERROR');
            throw err;
        }
    }

    /**
     * Récupère le diagnostic complet (JS + Natif iOS/Android).
     */
    async getDiagnostics() {
        await this.init();

        const diag = {
            timestamp: new Date().toISOString(),
            platform: this.platform,
            isNative: this.isNative,
            isSupported: this.isSupported,
            pluginRegistered: Boolean(this.plugin),
            lastOperation: this.lastOperation,
            lastError: this.lastError,
            activeOrdersInJS: Array.from(this.activeOrderIds),
            localLogsCount: this.getLocalLogs().length,
            native: null
        };

        if (this.plugin && typeof this.plugin.getDiagnostics === 'function') {
            try {
                const nativeDiag = await this.plugin.getDiagnostics();
                diag.native = nativeDiag;
            } catch (err) {
                diag.native = { error: 'Échec getDiagnostics() natif: ' + (err?.message || err) };
            }
        }

        return diag;
    }

    /**
     * Envoie le token push au backend Supabase si nécessaire.
     */
    async _syncPushTokenWithBackend(orderId, token) {
        if (!window.supabaseClient || !orderId || !token) return;
        try {
            await window.supabaseClient
                .from('orders')
                .update({ live_activity_token: token })
                .eq('id', orderId);
        } catch (_) {}
    }
}

export const LiveOrderTracker = new LiveOrderTrackerService();
if (typeof window !== 'undefined') {
    window.LiveOrderTracker = LiveOrderTracker;
}
