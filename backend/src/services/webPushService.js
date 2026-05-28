import webPush from 'web-push';
import { supabaseAdmin } from '../config/supabase.js';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || process.env.WEB_PUSH_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || process.env.WEB_PUSH_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || process.env.WEB_PUSH_SUBJECT || 'mailto:support@newket.app';

const isConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

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
    if (targetRole === 'suppliers') return '/src/pages/vendor-dashboard.html#notifications';
    if (targetRole === 'admin') return '/src/pages/admin/notifications-admin.html';
    return '/src/pages/customer-dashboard.html#notifications';
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

    async sendForNotification(notification) {
        if (!isConfigured || !notification?.title || !notification?.message) return { sent: 0 };

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

        const { data, error } = await query.limit(500);
        if (error) {
            console.error('[WebPush] Subscription lookup failed:', error);
            return { sent: 0 };
        }

        const payload = buildPayload(notification);
        const results = await Promise.all((data || []).map((row) => sendRow(row, payload)));
        return { sent: results.filter(Boolean).length };
    }
};

export default WebPushService;
