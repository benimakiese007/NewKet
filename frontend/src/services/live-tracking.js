/**
 * NewKet — Native Live Tracking Service (iOS ActivityKit & Android Live Notifications)
 * ====================================================================================
 * Connecte les événements de commande Supabase en temps réel aux API système natives :
 *   - Sur iOS : ActivityKit (Dynamic Island + Lock Screen Widget SwiftUI)
 *   - Sur Android : Notifications persistantes de suivi en direct (Lock Screen + Progress Stepper)
 *   - Sur Web/PWA : Mode dégradé sécurisé (no-op sans crash)
 */

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
        this.isSupported = false;
        this.activeOrderIds = new Set();
        this._initPromise = null;
    }

    /**
     * Initialise le plugin Capacitor natif.
     */
    async init() {
        if (this._initPromise) return this._initPromise;

        this._initPromise = (async () => {
            this.isNative = Boolean(
                window.Capacitor?.isNativePlatform?.() ||
                window.Capacitor?.getPlatform?.() === 'ios' ||
                window.Capacitor?.getPlatform?.() === 'android'
            );

            if (!this.isNative) {
                console.info('[LiveOrderTracker] Mode Web/PWA : Live Activities désactivées.');
                return;
            }

            try {
                const { registerPlugin } = await import('@capacitor/core');
                this.plugin = registerPlugin('LiveActivityPlugin');

                const status = await this.plugin.isAvailable();
                this.isSupported = Boolean(status?.available && status?.enabled);

                console.info('[LiveOrderTracker] Plugin natif initialisé. Support :', this.isSupported);

                // Écouter les push tokens APNs (iOS)
                if (this.plugin.addListener) {
                    this.plugin.addListener('activityPushToken', (data) => {
                        console.info('[LiveOrderTracker] Push token reçu pour commande :', data.orderId);
                        this._syncPushTokenWithBackend(data.orderId, data.token);
                    });
                }
            } catch (err) {
                console.warn('[LiveOrderTracker] Échec init plugin natif (non bloquant) :', err?.message);
                this.isSupported = false;
            }
        })();

        return this._initPromise;
    }

    /**
     * Démarre ou met à jour le suivi en direct pour une commande donnée.
     * @param {Object} order - Objet commande Supabase
     */
    async trackOrder(order) {
        if (!order || !order.id) return;
        await this.init();

        if (!this.isSupported || !this.plugin) return;

        const rawStatus = String(order.status || 'PENDING').toUpperCase();
        const mapping = STEP_MAPPING[rawStatus] || STEP_MAPPING['PROCESSING'];

        const orderId = String(order.id);
        const orderNumber = order.order_number || `#NK-${orderId.slice(0, 6).toUpperCase()}`;
        const shopName = order.shop_name || order.shops?.name || 'NewKet';
        const itemCount = Array.isArray(order.items) ? order.items.length : 1;
        const etaText = order.estimated_delivery_time || order.eta || null;

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

        try {
            if (this.activeOrderIds.has(orderId)) {
                // Déjà actif -> mettre à jour
                await this.plugin.updateActivity(payload);
                console.info(`[LiveOrderTracker] Mise à jour activité commande ${orderNumber} (${rawStatus})`);
            } else {
                // Pas encore actif -> démarrer
                await this.plugin.startActivity(payload);
                this.activeOrderIds.add(orderId);
                console.info(`[LiveOrderTracker] Démarrage activité commande ${orderNumber} (${rawStatus})`);
            }

            // Si la commande est livrée ou annulée, planifier l'arrêt
            if (rawStatus === 'DELIVERED' || rawStatus === 'COMPLETED' || rawStatus === 'CANCELLED') {
                setTimeout(() => {
                    this.stopTracking(orderId);
                }, 20000); // Reste affiché 20s pour confirmation visuelle
            }
        } catch (err) {
            console.warn(`[LiveOrderTracker] Erreur suivi commande ${orderId} :`, err?.message);
        }
    }

    /**
     * Arrête l'activité de suivi pour une commande.
     * @param {string} orderId
     */
    async stopTracking(orderId) {
        if (!orderId) return;
        await this.init();

        if (!this.plugin) return;

        try {
            await this.plugin.endActivity({ orderId });
            this.activeOrderIds.delete(orderId);
            console.info(`[LiveOrderTracker] Activité terminée pour ${orderId}`);
        } catch (err) {
            console.warn(`[LiveOrderTracker] Erreur fin activité ${orderId} :`, err?.message);
        }
    }

    /**
     * Envoie le token push de l'activité au backend Supabase si nécessaire.
     */
    async _syncPushTokenWithBackend(orderId, token) {
        if (!window.supabaseClient || !orderId || !token) return;
        try {
            await window.supabaseClient
                .from('orders')
                .update({ live_activity_token: token })
                .eq('id', orderId);
        } catch (_) {
            // Optionnel
        }
    }
}

export const LiveOrderTracker = new LiveOrderTrackerService();
if (typeof window !== 'undefined') {
    window.LiveOrderTracker = LiveOrderTracker;
}
