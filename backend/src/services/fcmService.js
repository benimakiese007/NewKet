/**
 * fcmService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Service de notification push natif via Firebase Cloud Messaging (FCM).
 *
 * Couvre :
 *   - App native Android (Capacitor) → FCM natif
 *   - App native iOS (Capacitor)     → FCM → APNs (via le même appel)
 *
 * Usage :
 *   import FcmService from './fcmService.js';
 *   await FcmService.sendToUser(userId, { title, body, data });
 *   await FcmService.sendChatMessage({ targetUserId, senderName, text, orderId });
 *
 * Configuration requise :
 *   - backend/config/firebase-service-account.json (fichier clé privée Firebase)
 *     OU variable d'environnement FIREBASE_SERVICE_ACCOUNT (contenu JSON en string)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { supabaseAdmin } from '../config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Initialisation Firebase Admin ───────────────────────────────────────────

function _initFirebase() {
    // Éviter la double initialisation (ex: hot-reload en dev)
    if (getApps().length > 0) {
        return getApps()[0];
    }

    let credential;

    // 1. Priorité : variable d'environnement (utile pour Vercel/production)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            credential = cert(parsed);
            console.log('[FCM] Initialisé via variable d\'environnement FIREBASE_SERVICE_ACCOUNT');
        } catch (e) {
            console.error('[FCM] Impossible de parser FIREBASE_SERVICE_ACCOUNT :', e.message);
        }
    }

    // 2. Fallback : fichier JSON local (dev)
    if (!credential) {
        const keyPath = path.resolve(__dirname, '../../config/firebase-service-account.json');
        if (fs.existsSync(keyPath)) {
            const require = createRequire(import.meta.url);
            const serviceAccount = require(keyPath);
            credential = cert(serviceAccount);
            console.log('[FCM] Initialisé via fichier firebase-service-account.json');
        }
    }

    if (!credential) {
        console.warn('[FCM] Aucune configuration Firebase trouvée. Push FCM désactivé.');
        return null;
    }

    return initializeApp({ credential });
}

const firebaseApp = _initFirebase();
const isConfigured = Boolean(firebaseApp);

// ─── Helpers internes ─────────────────────────────────────────────────────────

/**
 * Récupère les fcm_tokens actifs d'un utilisateur depuis la table `users`.
 * Un utilisateur peut avoir plusieurs appareils → on envoie à tous.
 */
async function _getFcmTokensForUser(userId) {
    if (!userId) return [];

    const { data, error } = await supabaseAdmin
        .from('users')
        .select('fcm_token')
        .eq('id', userId)
        .not('fcm_token', 'is', null);

    if (error || !data || data.length === 0) return [];

    return data
        .map(row => row.fcm_token)
        .filter(Boolean);
}

/**
 * Supprime un token FCM invalide (expiré ou révoqué par l'OS).
 */
async function _revokeInvalidToken(token) {
    if (!token) return;
    try {
        await supabaseAdmin
            .from('users')
            .update({ fcm_token: null })
            .eq('fcm_token', token);
        console.log('[FCM] Token invalide révoqué et supprimé de la base.');
    } catch (e) {
        console.warn('[FCM] Erreur lors de la révocation du token :', e.message);
    }
}

/**
 * Envoie un seul message FCM à un token donné.
 * Gère proprement les tokens expirés.
 * @returns {{ success: boolean, token: string }}
 */
async function _sendToToken(token, payload) {
    const messaging = getMessaging(firebaseApp);

    const message = {
        token,
        notification: {
            title: payload.title || 'NewKet',
            body: payload.body || '',
        },
        android: {
            priority: 'high',
            notification: {
                icon: 'ic_launcher',           // Icône native officielle de l'app NewKet
                color: '#10B981',              // emerald-500 (vert NewKet)
                channelId: payload.channelId || 'default',
                sound: 'default',
                clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                tag: payload.tag || undefined,
            },
        },
        apns: {
            headers: {
                'apns-priority': '10',
            },
            payload: {
                aps: {
                    sound: 'default',
                    badge: 1,
                    'content-available': 1,
                    'mutable-content': 1,
                    category: payload.category || 'general',
                },
            },
        },
        data: payload.data
            ? Object.fromEntries(
                Object.entries(payload.data).map(([k, v]) => [k, String(v)])
            )
            : {},
    };

    try {
        const response = await messaging.send(message);
        console.log('[FCM] Message envoyé avec succès, messageId:', response);
        return { success: true, token };
    } catch (err) {
        const code = err.code || '';
        // Codes d'erreur indiquant un token invalide / révoqué
        if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/invalid-argument'
        ) {
            console.warn('[FCM] Token invalide détecté, révocation en cours...');
            await _revokeInvalidToken(token);
        } else {
            console.error('[FCM] Erreur d\'envoi :', code, err.message);
        }
        return { success: false, token };
    }
}

// ─── API Publique ─────────────────────────────────────────────────────────────

const FcmService = {

    isConfigured() {
        return isConfigured;
    },

    /**
     * Envoie une notification push FCM à TOUS les appareils d'un utilisateur.
     *
     * @param {string}  userId          - UUID de l'utilisateur cible
     * @param {object}  payload
     * @param {string}  payload.title   - Titre de la notification
     * @param {string}  payload.body    - Corps du message
     * @param {string}  [payload.tag]   - Tag pour regrouper les notifications (ex: "chat-ORDER_ID")
     * @param {string}  [payload.channelId] - Canal Android (ex: 'chat', 'orders', 'alerts')
     * @param {object}  [payload.data]  - Données supplémentaires (url, type, orderId, etc.)
     * @returns {{ sent: number }}
     */
    async sendToUser(userId, payload) {
        if (!isConfigured || !userId) return { sent: 0 };

        const tokens = await _getFcmTokensForUser(userId);
        if (tokens.length === 0) {
            console.log(`[FCM] Aucun token FCM pour l'utilisateur ${userId}`);
            return { sent: 0 };
        }

        const results = await Promise.all(tokens.map(token => _sendToToken(token, payload)));
        const sent = results.filter(r => r.success).length;
        console.log(`[FCM] ${sent}/${tokens.length} push envoyés à l'utilisateur ${userId}`);
        return { sent };
    },

    /**
     * Envoie un push FCM pour un message de chat 1vs1.
     * Utilisé quand le destinataire est hors de l'app (app native fermée).
     *
     * @param {object} opts
     * @param {string} opts.targetUserId   - UUID du destinataire
     * @param {string} opts.senderName     - Nom de l'expéditeur
     * @param {string} [opts.senderAvatar] - URL de l'avatar
     * @param {string} [opts.messageType]  - 'text' | 'audio'
     * @param {string} [opts.text]         - Texte du message
     * @param {string} [opts.duration]     - Durée pour les messages audio
     * @param {string} opts.orderId        - ID de la commande liée au chat
     */
    async sendChatMessage({ targetUserId, senderName, senderAvatar, messageType, text, duration, orderId }) {
        if (!isConfigured || !targetUserId) return { sent: 0 };

        const isAudio = messageType === 'audio';
        const body = isAudio
            ? `🎙️ Message vocal (${duration || '0:00'})`
            : (text || 'Nouveau message');

        return this.sendToUser(targetUserId, {
            title: senderName || 'NewKet',
            body,
            tag: `chat-${orderId}`,           // Regroupe les messages d'une même commande
            channelId: 'chat',                 // Canal Android dédié aux messages
            category: 'chat',                 // Catégorie APNs
            data: {
                type: 'chat-message',
                order_id: orderId || '',
                sender_name: senderName || '',
                sender_avatar: senderAvatar || '',
                message_type: messageType || 'text',
                // URL de deep-link : ouvre directement la conversation
                url: `/customer-dashboard#purchases?order_id=${encodeURIComponent(orderId || '')}&open_chat=1`,
            },
        });
    },

    /**
     * Envoie un push FCM pour une mise à jour de commande.
     *
     * @param {object} opts
     * @param {string} opts.targetUserId - UUID de l'utilisateur cible
     * @param {string} opts.orderId      - ID de la commande
     * @param {string} opts.newStatus    - Nouveau statut (ex: 'SHIPPED', 'DELIVERED')
     * @param {string} [opts.role]       - 'buyer' | 'vendor'
     */
    async sendOrderUpdate({ targetUserId, orderId, newStatus, role = 'buyer' }) {
        if (!isConfigured || !targetUserId) return { sent: 0 };

        const shortId = (orderId || '').split('-')[0].slice(0, 8).toUpperCase();
        const url = role === 'vendor'
            ? `/vendor-dashboard#orders?order_id=${encodeURIComponent(orderId || '')}`
            : `/customer-dashboard#purchases?order_id=${encodeURIComponent(orderId || '')}`;

        return this.sendToUser(targetUserId, {
            title: '📦 Mise à jour de commande',
            body: `Commande #${shortId} : statut mis à jour → ${newStatus}`,
            tag: `order-${orderId}`,
            channelId: 'orders',
            category: 'order',
            data: {
                type: 'order-update',
                order_id: orderId || '',
                new_status: newStatus || '',
                url,
            },
        });
    },

    /**
     * Envoie une notification générique (broadcast, promo, alerte admin…).
     *
     * @param {object} opts
     * @param {string} opts.targetUserId
     * @param {string} opts.title
     * @param {string} opts.body
     * @param {string} [opts.url]
     * @param {string} [opts.type]
     */
    async sendGeneral({ targetUserId, title, body, url, type = 'info' }) {
        if (!isConfigured || !targetUserId) return { sent: 0 };

        return this.sendToUser(targetUserId, {
            title,
            body,
            tag: `general-${Date.now()}`,
            channelId: 'default',
            data: {
                type,
                url: url || '/',
            },
        });
    },
};

export default FcmService;
