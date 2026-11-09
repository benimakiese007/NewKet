import { supabaseAdmin } from '../config/supabase.js';
import WebPushService from '../services/webPushService.js';
import FcmService from '../services/fcmService.js';

async function resolveUserRole(userId, userEmail) {
    if (!userId && !userEmail) return 'customer';

    let query = supabaseAdmin.from('users').select('role').limit(1);
    if (userId) {
        query = query.eq('id', userId);
    } else {
        query = query.eq('email', userEmail);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
        console.error('[PushController] Role lookup failed:', error);
    }

    return data?.role || 'customer';
}

export const getPushPublicKey = async (req, res, next) => {
    res.json({
        enabled: WebPushService.isConfigured(),
        publicKey: WebPushService.getPublicKey(),
        fcm_enabled: FcmService.isConfigured()
    });
};

export const subscribeToPush = async (req, res, next) => {
    try {
        const userId = req.user?.id || null;
        const userEmail = req.user?.email || null;
        if (!userId && !userEmail) return res.status(401).json({ error: 'Non autorise.' });

        const userRole = await resolveUserRole(userId, userEmail);
        const saved = await WebPushService.saveSubscription({
            userId,
            userEmail,
            userRole,
            subscription: req.body?.subscription,
            userAgent: req.headers['user-agent'] || null
        });

        res.json({ success: true, subscription: saved });
    } catch (error) {
        console.error('[PushController] subscribeToPush error:', error);
        next(error);
    }
};

export const unsubscribeFromPush = async (req, res, next) => {
    try {
        const userId = req.user?.id || null;
        const userEmail = req.user?.email || null;
        if (!userId && !userEmail) return res.status(401).json({ error: 'Non autorise.' });

        await WebPushService.removeSubscription({
            userId,
            userEmail,
            endpoint: req.body?.endpoint
        });

        res.json({ success: true });
    } catch (error) {
        console.error('[PushController] unsubscribeFromPush error:', error);
        next(error);
    }
};

export const sendCallRing = async (req, res, next) => {
    try {
        const { target_user_id, caller_name, caller_avatar, order_id } = req.body || {};
        if (!target_user_id || !order_id) {
            return res.status(400).json({ error: 'Champs requis manquants (target_user_id, order_id).' });
        }

        // Envoi en parallèle : Web Push (PWA/navigateur) + FCM (app native)
        const [webResult, fcmResult] = await Promise.allSettled([
            WebPushService.sendCallRingNotification({
                targetUserId: target_user_id,
                callerName: caller_name,
                callerAvatar: caller_avatar,
                orderId: order_id
            }),
            FcmService.sendToUser(target_user_id, {
                title: `📞 Appel de ${caller_name || 'NewKet'}`,
                body: 'Appel entrant sur votre commande',
                tag: `call-${order_id}`,
                channelId: 'calls',
                data: {
                    type: 'incoming-call',
                    order_id,
                    caller_name: caller_name || '',
                    caller_avatar: caller_avatar || '',
                    url: `/customer-dashboard#purchases?order_id=${encodeURIComponent(order_id)}&open_chat=1`,
                }
            })
        ]);

        const webSent = webResult.value?.sent ?? 0;
        const fcmSent = fcmResult.value?.sent ?? 0;

        res.json({ success: true, sent: webSent + fcmSent, web_sent: webSent, fcm_sent: fcmSent });
    } catch (error) {
        console.error('[PushController] sendCallRing error:', error);
        next(error);
    }
};

export const sendChatMessage = async (req, res, next) => {
    try {
        const { target_user_id, sender_name, sender_avatar, message_type, text, duration, order_id } = req.body || {};
        if (!target_user_id || !order_id) {
            return res.status(400).json({ error: 'Champs requis manquants (target_user_id, order_id).' });
        }

        // Envoi en parallèle : Web Push (PWA/navigateur) + FCM (app native Android/iOS)
        const [webResult, fcmResult] = await Promise.allSettled([
            WebPushService.sendChatMessageNotification({
                targetUserId: target_user_id,
                senderName: sender_name,
                senderAvatar: sender_avatar,
                messageType: message_type || 'text',
                text: text || '',
                duration: duration || '',
                orderId: order_id
            }),
            FcmService.sendChatMessage({
                targetUserId: target_user_id,
                senderName: sender_name,
                senderAvatar: sender_avatar,
                messageType: message_type || 'text',
                text: text || '',
                duration: duration || '',
                orderId: order_id
            })
        ]);

        const webSent = webResult.value?.sent ?? 0;
        const fcmSent = fcmResult.value?.sent ?? 0;

        console.log(`[PushController] Chat push — Web: ${webSent}, FCM: ${fcmSent}`);
        res.json({ success: true, sent: webSent + fcmSent, web_sent: webSent, fcm_sent: fcmSent });
    } catch (error) {
        console.error('[PushController] sendChatMessage error:', error);
        next(error);
    }
};
