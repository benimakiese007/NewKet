import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
dotenv.config();

const router = express.Router();

// Rate limiter strict pour les analytics
// Limite a 20 increments par IP par 15 minutes pour empecher le spam de vues
const analyticsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: { error: 'Trop de requetes analytics. Reessayez plus tard.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Initialize Supabase Admin client for backend operations
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Validation UUID simple pour eviter les injections via IDs
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Validation ID produit (UUID ou format prod-timestamp)
const PRODUCT_ID_REGEX = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|prod-[a-z0-9-]+)$/i;

function isValidUuid(value) {
    return typeof value === 'string' && UUID_REGEX.test(value);
}

function isValidProductId(value) {
    return typeof value === 'string' && PRODUCT_ID_REGEX.test(value);
}

function getClientIp(req) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim()) {
        return xff.split(',')[0].trim();
    }
    return req.ip || req.connection?.remoteAddress || '';
}

function hashIp(ip) {
    if (!ip) return null;
    const salt = process.env.ANALYTICS_IP_SALT || '';
    return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

/**
 * Increment product view count
 * POST /api/analytics/view/:productId
 */
router.post('/view/:productId', analyticsLimiter, async (req, res) => {
    const { productId } = req.params;

    if (!productId) {
        return res.status(400).json({ error: 'Product ID is required.' });
    }

    if (!isValidProductId(productId)) {
        return res.status(400).json({ error: 'Product ID invalide.' });
    }

    try {
        const { error } = await supabase.rpc('increment_product_views', { product_id: productId });
        if (error) throw error;
        return res.json({ success: true, message: 'View counted.' });
    } catch (error) {
        console.error(`[Analytics] Error counting view for ${productId}:`, error);
        return res.status(500).json({ error: 'Failed to count view.' });
    }
});

/**
 * Record a shop view event
 * POST /api/analytics/shop-view
 * body: { vendor_id: uuid, session_id?: string }
 */
router.post('/shop-view', analyticsLimiter, async (req, res) => {
    const vendorId = req.body?.vendor_id;
    const sessionId = req.body?.session_id;

    if (!isValidUuid(vendorId)) {
        return res.status(400).json({ error: 'vendor_id invalide.' });
    }

    const viewerUserId = req.user?.id && isValidUuid(req.user.id) ? req.user.id : null;
    const safeSessionId = typeof sessionId === 'string' && sessionId.length <= 128 ? sessionId : null;
    const ipHash = hashIp(getClientIp(req));
    const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 300) : null;

    try {
        // Dedupe simple: max 1 event / vendor / session (or viewer user) / day (UTC)
        const dayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const dayStart = `${dayKey}T00:00:00.000Z`;
        const dayEnd = `${dayKey}T23:59:59.999Z`;

        if (viewerUserId) {
            const { data: existing, error: existingError } = await supabase
                .from('shop_views')
                .select('id')
                .eq('vendor_id', vendorId)
                .eq('viewer_user_id', viewerUserId)
                .gte('created_at', dayStart)
                .lt('created_at', dayEnd)
                .limit(1);

            if (existingError) throw existingError;
            if (existing?.length) return res.json({ success: true, deduped: true });
        } else if (safeSessionId) {
            const { data: existing, error: existingError } = await supabase
                .from('shop_views')
                .select('id')
                .eq('vendor_id', vendorId)
                .eq('session_id', safeSessionId)
                .gte('created_at', dayStart)
                .lt('created_at', dayEnd)
                .limit(1);

            if (existingError) throw existingError;
            if (existing?.length) return res.json({ success: true, deduped: true });
        }

        const { error } = await supabase
            .from('shop_views')
            .insert({
                vendor_id: vendorId,
                viewer_user_id: viewerUserId,
                session_id: safeSessionId,
                ip_hash: ipHash,
                user_agent: userAgent,
            });

        if (error) throw error;
        return res.json({ success: true });
    } catch (error) {
        console.error('[Analytics] Error recording shop view:', error);
        return res.status(500).json({ error: 'Failed to record shop view.' });
    }
});

/**
 * Vendor shop metrics
 * GET /api/analytics/vendor/shop-metrics?days=30
 */
router.get('/vendor/shop-metrics', async (req, res) => {
    const vendorId = req.user?.id;
    if (!isValidUuid(vendorId)) {
        return res.status(401).json({ error: 'Non autorise.' });
    }

    const days = Math.max(1, Math.min(90, parseInt(req.query.days, 10) || 30));
    const sinceIso = new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();

    try {
        const { data, error } = await supabase
            .from('shop_views')
            .select('viewer_user_id, session_id, ip_hash, created_at')
            .eq('vendor_id', vendorId)
            .gte('created_at', sinceIso);

        if (error) throw error;

        const rows = data || [];
        const totalViews = rows.length;
        const uniqueAccounts = new Set(rows.map((r) => r.viewer_user_id).filter(Boolean)).size;
        const uniqueVisitors = new Set(
            rows
                .map((r) => String(r.viewer_user_id || r.session_id || r.ip_hash || ''))
                .filter((v) => v && v !== 'null' && v !== 'undefined')
        ).size;

        return res.json({
            success: true,
            days,
            total_views: totalViews,
            unique_accounts: uniqueAccounts,
            unique_visitors: uniqueVisitors,
        });
    } catch (error) {
        console.error('[Analytics] Error fetching shop metrics:', error);
        return res.status(500).json({ error: 'Failed to fetch shop metrics.' });
    }
});

export default router;
