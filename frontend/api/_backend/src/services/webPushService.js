import webPush from 'web-push';
import { supabaseAdmin } from '../config/supabase.js';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || process.env.WEB_PUSH_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || process.env.WEB_PUSH_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || process.env.WEB_PUSH_SUBJECT || 'mailto:support@newket.app';

const isConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
const PUSH_BATCH_SIZE = 500;

if (isConfigured) {
    webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
    console.warn('[WebPush] VAPID keys missing. Device push notifications disabled.');
}

function normalizeRole(role) {
    if (role === 'all') return 'all';
    if (role === 'supplier' || role === 'suppliers') return 'suppliers';
    if (role === 'customer' || role === 'customers') return 'customers';
    if (role === 'admin') return 'admin';
    return 'customers';
}

function getNotificationUrl(notification = {}) {
    const targetRole = normalizeRole(notification.target_role);
    if (targetRole === 'suppliers') return '/vendor-dashboard#notifications';
    if (targetRole === 'admin') return '/admin/notifications-admin';
    return '/customer-dashboard#notifications';
}

function buildPayload(notification = {}) {
    return {
        title: notification.title || 'NewKet',
        body: notification.message || 'Vous avez une nouvelle notification.',
        icon: '/Images/Logo NewKet PNG-192.png',
        badge: '/favicon-32x32.png',
        tag: notification.id || `newket-${Date.now()}`,
        data: {
            notificationId: notification.id || null,
            url: getNotificationUrl(notification),
            type: notification.type || 'info'
        }
    };
}

async function revokeEndpoint(endpoint) {
    if (!endpoint) return;

    const { error } = await supabaseAdmin
        .from('push_subscriptions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('endpoint', endpoint);

    if (error) {
        console.error('[WebPush] Failed to revoke endpoint:', error);
    }
}

async function sendRow(row, payload) {
    if (!isConfigured || !row?.subscription) return false;

    try {
        await webPush.sendNotification(row.subscription, JSON.stringify(payload));
        return true;
    } catch (error) {
        const status = Number(error?.statusCode || error?.status || 0);
        if (status === 404 || status === 410) {
            await revokeEndpoint(row.endpoint);
            return false;
        }

        console.error('[WebPush] Send failed:', error?.message || error);
        return false;
    }
}

async function fetchAllPushSubscriptions(buildQuery) {
    const rows = [];
    let offset = 0;

    while (true) {
        const { data, error } = await buildQuery()
            .order('endpoint', { ascending: true })
            .range(offset, offset + PUSH_BATCH_SIZE - 1);

        if (error) throw error;

        const batch = Array.isArray(data) ? data : [];
        rows.push(...batch);

        if (batch.length < PUSH_BATCH_SIZE) break;
        offset += PUSH_BATCH_SIZE;
    }

    return rows;
}

async function sendNotificationNow(notification) {
    if (!isConfigured || !notification?.title || !notification?.message) return { sent: 0 };

    const isPushOnly = String(notification.type || '').startsWith('push-only:');
    // Only push-only notifications trigger a device push.
    // Broadcasts (broadcast: / broadcast-modal:) are in-app only.
    if (!isPushOnly) return { sent: 0 };

    let data;
    try {
        data = await fetchAllPushSubscriptions(() => buildPushSubscriptionQuery(notification));
    } catch (error) {
        console.error('[WebPush] Subscription lookup failed:', error);
        throw error;
    }

    const payload = buildPayload(notification);
    const results = await Promise.all(data.map((row) => sendRow(row, payload)));
    return { sent: results.filter(Boolean).length };
}

function buildPushSubscriptionQuery(notification) {
    let query = supabaseAdmin
        .from('push_subscriptions')
        .select('endpoint, subscription')
        .is('revoked_at', null);

    const targetRole = normalizeRole(notification.target_role);
    if (notification.user_id || notification.user_email) {
        const filters = [];
        if (notification.user_id) filters.push(`user_id.eq.${notification.user_id}`);
        if (notification.user_email) filters.push(`user_email.eq.${notification.user_email}`);
        query = query.or(filters.join(','));
    } else if (targetRole !== 'all') {
        query = query.eq('user_role', targetRole);
    }

    return query;
}

const WebPushService = {
    isConfigured() {
        return isConfigured;
    },

    getPublicKey() {
        return VAPID_PUBLIC_KEY;
    },

    async saveSubscription({ userId, userEmail, userRole, subscription, userAgent }) {
        if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
            const error = new Error('INVALID_PUSH_SUBSCRIPTION');
            error.status = 400;
            throw error;
        }

        const now = new Date().toISOString();
        const payload = {
            user_id: userId || null,
            user_email: userEmail || null,
            user_role: normalizeRole(userRole),
            endpoint: subscription.endpoint,
            subscription,
            user_agent: userAgent || null,
            last_seen_at: now,
            revoked_at: null,
            updated_at: now
        };

        const { data, error } = await supabaseAdmin
            .from('push_subscriptions')
            .upsert(payload, { onConflict: 'endpoint' })
            .select('id, endpoint, user_role, updated_at')
            .single();

        if (error) throw error;
        return data;
    },

    async removeSubscription({ userId, userEmail, endpoint }) {
        if (!endpoint) return false;

        let query = supabaseAdmin
            .from('push_subscriptions')
            .update({ revoked_at: new Date().toISOString() })
            .eq('endpoint', endpoint);

        if (userId) {
            query = query.eq('user_id', userId);
        } else if (userEmail) {
            query = query.eq('user_email', userEmail);
        }

        const { error } = await query;
        if (error) throw error;
        return true;
    },

    sendForNotification(notification) {
        return sendNotificationNow(notification);
    },

    async sendCallRingNotification({ targetUserId, callerName, callerAvatar, orderId }) {
        if (!isConfigured || !targetUserId) return { sent: 0 };

        try {
            const { data: subs, error } = await supabaseAdmin
                .from('push_subscriptions')
                .select('endpoint, subscription')
                .eq('user_id', targetUserId)
                .is('revoked_at', null);

            if (error || !subs || subs.length === 0) return { sent: 0 };

            const payload = {
                title: `Appel vocal — ${callerName || 'NewKet'}`,
                body: 'Appel en direct en cours. Appuyez pour répondre.',
                icon: callerAvatar || '/Images/Logo NewKet PNG-192.png',
                badge: '/favicon-32x32.png',
                tag: `call-ring-${orderId}`,
                requireInteraction: true,
                data: {
                    type: 'call-ring',
                    order_id: orderId,
                    caller_name: callerName || 'NewKet',
                    caller_avatar: callerAvatar || '',
                    url: `/customer-dashboard#purchases?order_id=${encodeURIComponent(orderId)}&auto_answer=1`
                }
            };

            const results = await Promise.all(subs.map(row => sendRow(row, payload)));
            return { sent: results.filter(Boolean).length };
        } catch (err) {
            console.error('[WebPush] sendCallRingNotification error:', err);
            return { sent: 0 };
        }
    },

    async sendChatMessageNotification({ targetUserId, senderName, senderAvatar, messageType, text, duration, orderId }) {
        if (!isConfigured || !targetUserId) return { sent: 0 };

        try {
            const { data: subs, error } = await supabaseAdmin
                .from('push_subscriptions')
                .select('endpoint, subscription')
                .eq('user_id', targetUserId)
                .is('revoked_at', null);

            if (error || !subs || subs.length === 0) return { sent: 0 };

            const body = messageType === 'audio'
                ? `🎙️ Message vocal (${duration || '0:00'})`
                : (text || '');

            const payload = {
                title: senderName || 'NewKet',
                body,
                icon: senderAvatar || '/Images/Logo NewKet PNG-192.png',
                badge: '/favicon-32x32.png',
                tag: `chat-${orderId}`,
                requireInteraction: false,
                data: {
                    type: 'chat-message',
                    order_id: orderId,
                    url: `/customer-dashboard#purchases?order_id=${encodeURIComponent(orderId)}&open_chat=1`
                }
            };

            const results = await Promise.all(subs.map(row => sendRow(row, payload)));
            return { sent: results.filter(Boolean).length };
        } catch (err) {
            console.error('[WebPush] sendChatMessageNotification error:', err);
            return { sent: 0 };
        }
    }
};

export default WebPushService;
