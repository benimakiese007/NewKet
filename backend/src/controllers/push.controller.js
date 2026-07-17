import { supabaseAdmin } from '../config/supabase.js';
import WebPushService from '../services/webPushService.js';

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

export const getPushPublicKey = async (req, res) => {
    res.json({
        enabled: WebPushService.isConfigured(),
        publicKey: WebPushService.getPublicKey()
    });
};

export const subscribeToPush = async (req, res) => {
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
        res.status(error.status || 500).json({ error: "Impossible d'activer les notifications appareil." });
    }
};

export const unsubscribeFromPush = async (req, res) => {
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
        res.status(500).json({ error: 'Impossible de desactiver les notifications appareil.' });
    }
};
