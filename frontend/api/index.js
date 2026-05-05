// ============================================================
// NewKet – Vercel Serverless API
// Expose toutes les routes Express via /api/* sur Vercel.
// Les variables d'environnement SUPABASE_URL, SUPABASE_ANON_KEY
// et SUPABASE_SERVICE_ROLE_KEY doivent être configurées dans le
// dashboard Vercel (Settings → Environment Variables).
// ============================================================

import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import nodemailer from 'nodemailer';

// Helpers
const generateTxId = () => {
    return 'NK_' + Math.random().toString(36).substr(2, 9).toUpperCase() + '_' + Date.now();
};

// ── Helpers Analytics ─────────────────────────────────────────
const getClientIp = (req) => {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim()) {
        return xff.split(',')[0].trim();
    }
    return req.ip || req.connection?.remoteAddress || '';
};

const hashIp = (ip) => {
    if (!ip) return null;
    const salt = process.env.ANALYTICS_IP_SALT || 'nk-salt-2024';
    return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex');
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUuid = (id) => typeof id === 'string' && UUID_REGEX.test(id);

// ── CONSTANTES ORDRES & LIVRAISON ────────────────────────────
const ORDER_STATUSES = {
    PENDING: 'PENDING',
    QUOTE: 'QUOTE',
    READY_FOR_PAYMENT: 'READY_FOR_PAYMENT',
    PAID_HELD: 'PAID_HELD',
    IN_DELIVERY: 'IN_DELIVERY',
    DELIVERED: 'DELIVERED',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    DISPUTE_OPEN: 'DISPUTE_OPEN',
    FROZEN: 'FROZEN',
    REFUNDED: 'REFUNDED'
};

const DELIVERY_QUOTE_STATUSES = {
    PENDING: 'PENDING',
    ACCEPTED: 'ACCEPTED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED',
    EXPIRED: 'EXPIRED'
};

const DELIVERY_STATUSES = {
    PENDING: 'PENDING',
    IN_TRANSIT: 'IN_TRANSIT',
    DELIVERED: 'DELIVERED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED'
};

const CRON_STATUSES = {
    ORDER_DELIVERED: 'Livré',
    ORDER_COMPLETED: 'Terminé',
    ESCROW_AUTO_RELEASED: 'AUTO_RELEASED',
    DISPUTE_SELLER_PENDING: 'SELLER_PENDING',
    DISPUTE_BUYER_PENDING: 'BUYER_PENDING',
    DISPUTE_UNDER_REVIEW: 'UNDER_REVIEW',
    DISPUTE_RESOLVED: 'RESOLVED',
    RESOLUTION_FULL_REFUND: 'FULL_REFUND',
    RESOLUTION_RELEASE_TO_SELLER: 'RELEASE_TO_SELLER'
};

const mapLegacyOrderStatus = (status) => {
    const map = {
        'SHIPPED': ORDER_STATUSES.IN_DELIVERY,
        'RELEASED': ORDER_STATUSES.COMPLETED,
        'DISPUTED': ORDER_STATUSES.DISPUTE_OPEN,
        'PAYÉ': ORDER_STATUSES.PAID_HELD
    };
    return map[status] || status;
};

const generateOrderId = () => `ORD_${crypto.randomBytes(5).toString('hex').toUpperCase()}_${Date.now()}`;

async function logOrderStatusHistory(client, { orderId, previousStatus, newStatus, changedBy, notes = null }) {
    try {
        await client.from('order_status_history').insert({
            order_id: orderId,
            previous_status: previousStatus,
            new_status: newStatus,
            changed_by: changedBy || 'system',
            notes,
            changed_at: new Date().toISOString()
        });
    } catch (err) { console.warn('[OrderHistory] Log error:', err.message); }
}

// ── Email Service ─────────────────────────────────────────────
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

const EmailService = {
    async sendMail({ to, subject, html }) {
        try {
            if (!process.env.GMAIL_USER) return { success: false, error: 'GMAIL_USER non configuré' };
            const info = await transporter.sendMail({
                from: `"NewKet EMarket" <${process.env.GMAIL_USER}>`,
                to, subject, html
            });
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('[EmailService] Error:', error);
            return { success: false, error: error.message };
        }
    },
    async sendLeadNotification({ vendorEmail, vendorName, productName, customerName, customerPhone }) {
        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
                <h1 style="text-align: center; color: #000;">NewKet</h1>
                <div style="padding: 20px; background-color: #f0fdf4; border-radius: 15px;">
                    <h2 style="color: #166534;">Nouveau Prospect WhatsApp ! 🚀</h2>
                    <p>Bonjour <b>${vendorName}</b>,</p>
                    <p>Un client vient de cliquer sur votre produit <b>"${productName}"</b>.</p>
                    <p><b>Client :</b> ${customerName || 'Visiteur'}</p>
                    <p><b>Tel :</b> ${customerPhone || 'Visible sur WhatsApp'}</p>
                </div>
            </div>
        `;
        return this.sendMail({ to: vendorEmail, subject: `🚀 Nouveau prospect pour : ${productName}`, html });
    }
};

// ── Rate Limiters ─────────────────────────────────────────────
const analyticsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100, // Augmenté pour Vercel (plusieurs instances)
    message: { error: 'Trop de requêtes analytics.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const app = express();
const router = express.Router();

// Middleware pour logger les requêtes (utile pour le debug Vercel)
app.use((req, res, next) => {
    console.log(`[Vercel API] ${req.method} ${req.url}`);
    next();
});

// ── CORS : autoriser le domaine Vercel + localhost dev ────────
const allowedOrigins = [
    'https://newket.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])
];

app.use(cors({
    origin: (origin, cb) => {
        // Autorise les requêtes sans origin (curl, Postman, SSR)
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`CORS bloqué pour : ${origin}`));
    },
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Helpers Supabase ──────────────────────────────────────────
const getSupabase = (token) =>
    createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
        global: token ? { headers: { Authorization: `Bearer ${token}` } } : {}
    });

const supabaseAdmin = () =>
    createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );

// ── Middlewares d'authentification ────────────────────────────
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
        return res.status(401).json({ error: 'Non autorisé: Token manquant.' });
    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await getSupabase().auth.getUser(token);
    if (error || !user)
        return res.status(401).json({ error: 'Non autorisé: Token invalide ou expiré.' });
    req.user = user;
    req.token = token;
    next();
};

const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const { data: { user } } = await getSupabase().auth.getUser(token);
            if (user) { req.user = user; req.token = token; }
        }
    } catch {/* silencieux */}
    next();
};

const requireAdmin = async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Non autorisé.' });
    const ADMIN_EMAILS = ['benimakiese1234@gmail.com'];
    const isAdmin = ADMIN_EMAILS.includes(req.user.email?.toLowerCase())
        || req.user.user_metadata?.role === 'admin';
    if (!isAdmin) return res.status(403).json({ error: 'Accès refusé: droits administrateur requis.' });
    next();
};

const requireCronAuth = (req, res, next) => {
    const secret = process.env.CRON_SECRET || process.env.NEWKET_CRON_SECRET || 'fallback-if-not-set';
    const authHeader = req.headers.authorization || '';
    const token = req.query.token;
    if (authHeader === `Bearer ${secret}` || token === secret || req.headers['x-vercel-cron']) {
        return next();
    }
    console.warn(`[Cron] Unauthorized attempt from ${req.ip}`);
    res.status(401).json({ error: 'Unauthorized cron access' });
};

// ── Health ────────────────────────────────────────────────────
router.get('/health', (req, res) =>
    res.json({ status: 'ok', message: 'NewKet Serverless API 🚀', timestamp: new Date().toISOString() })
);

// ── Analytics (vues produit — même contrat que backend Express) ─
const PRODUCT_VIEW_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.post('/analytics/view/:productId', analyticsLimiter, async (req, res) => {
    const { productId } = req.params;
    if (!productId || !PRODUCT_VIEW_ID_REGEX.test(productId)) {
        return res.status(400).json({ error: 'Product ID invalide.' });
    }
    try {
        const sb = supabaseAdmin();
        const { error } = await sb.rpc('increment_product_views', { product_id: productId });
        if (error) throw error;
        return res.json({ success: true, message: 'View counted.' });
    } catch (err) {
        console.error('[Vercel API] analytics/view:', err?.message || err);
        return res.status(500).json({ error: 'Failed to count view.' });
    }
});

router.post('/analytics/shop-view', analyticsLimiter, async (req, res) => {
    const { vendor_id, session_id } = req.body;
    if (!isValidUuid(vendor_id)) {
        return res.status(400).json({ error: 'vendor_id invalide.' });
    }

    const viewerUserId = req.user?.id && isValidUuid(req.user.id) ? req.user.id : null;
    const safeSessionId = typeof session_id === 'string' && session_id.length <= 128 ? session_id : null;
    const ipHash = hashIp(getClientIp(req));
    const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 300) : null;

    try {
        const sb = supabaseAdmin();
        const dayKey = new Date().toISOString().slice(0, 10);
        const dayStart = `${dayKey}T00:00:00.000Z`;
        const dayEnd = `${dayKey}T23:59:59.999Z`;

        // Déduplication simple
        if (viewerUserId) {
            const { data: existing } = await sb.from('shop_views').select('id')
                .eq('vendor_id', vendor_id).eq('viewer_user_id', viewerUserId)
                .gte('created_at', dayStart).lt('created_at', dayEnd).limit(1);
            if (existing?.length) return res.json({ success: true, deduped: true });
        } else if (safeSessionId) {
            const { data: existing } = await sb.from('shop_views').select('id')
                .eq('vendor_id', vendor_id).eq('session_id', safeSessionId)
                .gte('created_at', dayStart).lt('created_at', dayEnd).limit(1);
            if (existing?.length) return res.json({ success: true, deduped: true });
        }

        const { error } = await sb.from('shop_views').insert({
            vendor_id, viewer_user_id: viewerUserId, session_id: safeSessionId,
            ip_hash: ipHash, user_agent: userAgent
        });
        if (error) throw error;
        return res.json({ success: true });
    } catch (err) {
        console.error('[Vercel API] analytics/shop-view:', err);
        return res.status(500).json({ error: 'Failed to record shop view.' });
    }
});

router.get('/analytics/vendor/shop-metrics', requireAuth, async (req, res) => {
    const vendorId = req.user.id;
    const days = Math.max(1, Math.min(90, parseInt(req.query.days) || 30));
    const sinceIso = new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();

    try {
        const sb = supabaseAdmin();
        const { data, error } = await sb.from('shop_views').select('viewer_user_id, session_id, ip_hash, created_at')
            .eq('vendor_id', vendorId).gte('created_at', sinceIso);
        if (error) throw error;

        const rows = data || [];
        const uniqueVisitors = new Set(rows.map(r => String(r.viewer_user_id || r.session_id || r.ip_hash || ''))
            .filter(v => v && v !== 'null')).size;

        return res.json({
            success: true,
            days,
            total_views: rows.length,
            unique_visitors: uniqueVisitors
        });
    } catch (err) {
        console.error('[Vercel API] analytics/shop-metrics:', err);
        return res.status(500).json({ error: 'Failed to fetch metrics.' });
    }
});

// ── PRODUITS ──────────────────────────────────────────────────
router.get('/products', optionalAuth, async (req, res) => {
    try {
        const { page = 1, limit = 20, category } = req.query;
        const offset = (page - 1) * limit;
        const sb = getSupabase(req.token);
        let query = sb.from('products').select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);
        if (category) query = query.eq('category', category);
        const { data, error, count } = await query;
        if (error) throw error;
        res.json({ data, count, page: parseInt(page) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/products/:id', optionalAuth, async (req, res) => {
    try {
        const sb = getSupabase(req.token);
        const { data, error } = await sb.from('products').select('*').eq('id', req.params.id).single();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Produit non trouvé' });
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/products', requireAuth, async (req, res) => {
    try {
        const productData = { ...req.body, user_id: req.user.id };
        const sb = getSupabase(req.token);
        const { data, error } = await sb.from('products').insert(productData).select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/products/:id', requireAuth, async (req, res) => {
    try {
        const sb = getSupabase(req.token);
        const { data, error } = await sb.from('products').update(req.body).eq('id', req.params.id).select().single();
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/products/:id', requireAuth, async (req, res) => {
    try {
        const sb = getSupabase(req.token);
        const { error } = await sb.from('products').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/products/bulk-delete', requireAuth, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids)) return res.status(400).json({ error: 'IDs invalides' });
        const { error } = await supabaseAdmin().from('products').delete().in('id', ids);
        if (error) throw error;
        res.json({ success: true, count: ids.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/products/bulk-category', requireAuth, async (req, res) => {
    try {
        const { ids, category } = req.body;
        if (!Array.isArray(ids) || !category) return res.status(400).json({ error: 'Paramètres invalides' });
        const { error } = await supabaseAdmin().from('products').update({ category }).in('id', ids);
        if (error) throw error;
        res.json({ success: true, count: ids.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PROMOS ────────────────────────────────────────────────────
router.get('/promos', optionalAuth, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin().from('promos').select('*')
            .order('created_at', { ascending: false }).limit(100);
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/promos/apply', requireAuth, async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Code requis.' });
        const { data, error } = await supabaseAdmin().rpc('apply_promo_secure', { promo_code: code });
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ACTIVITÉS ─────────────────────────────────────────────────
router.get('/activities', requireAuth, async (req, res) => {
    try {
        const sb = getSupabase(req.token);
        // On essaie d'abord par user_id, sinon par email (legacy)
        const { data, error } = await sb.from('activities')
            .select('*')
            .or(`user_id.eq.${req.user.id},user_email.eq.${req.user.email}`)
            .order('time', { ascending: false })
            .limit(50);
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/activities', requireAuth, async (req, res) => {
    try {
        const { text, type } = req.body;
        if (!text) return res.status(400).json({ error: 'Texte requis.' });
        const sb = getSupabase(req.token);
        const { data, error } = await sb.from('activities')
            .insert({ 
                user_id: req.user.id,
                user_email: req.user.email, 
                text, 
                type: type || 'info', 
                time: new Date().toISOString() 
            })
            .select().single();
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PARAMÈTRES ────────────────────────────────────────────────
router.get('/settings', async (req, res) => {
    try {
        const { data, error } = await getSupabase().from('settings').select('*');
        if (error) throw error;
        res.json(data && data.length > 0 ? data : []);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/settings', requireAuth, requireAdmin, async (req, res) => {
    try {
        const config = req.body;
        let existingId = config.id;
        if (!existingId) {
            const { data: existing } = await supabaseAdmin().from('settings').select('id').limit(1);
            existingId = existing?.[0]?.id || 'global-settings';
        }
        const { data, error } = await supabaseAdmin().from('settings')
            .upsert({ ...config, id: existingId }).select().single();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── UTILISATEURS ──────────────────────────────────────────────
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        // Align with local backend: read app profiles from `users` (role/status/company fields),
        // not Auth users from `auth.admin.listUsers()`.
        const { data, error } = await supabaseAdmin()
            .from('users')
            .select('id, email, name, role, status, avatar, company_name, created_at:date_joined')
            .order('date_joined', { ascending: false });

        if (error) throw error;
        res.json(data || []);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/users/:id/status', requireAuth, requireAdmin, async (req, res) => {
    try {
        const rawStatus = req.body?.status;
        const status = typeof rawStatus === 'string' ? rawStatus.trim() : '';
        // Admin UI can treat "submitted" as a pending-review state.
        const allowed = ['pending', 'submitted', 'approved', 'rejected'];

        if (!allowed.includes(status)) {
            return res.status(400).json({ error: 'Statut invalide' });
        }

        const { data, error } = await supabaseAdmin()
            .from('users')
            .update({ status })
            .eq('id', req.params.id)
            .select('id, email, name, role, status, avatar, company_name, created_at:date_joined')
            .single();

        if (error) throw error;
        res.json({ success: true, user: data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/users/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { error } = await supabaseAdmin()
            .from('users')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/users/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin()
            .from('users')
            .select('id, email, name, role, status, avatar, company_name, created_at:date_joined')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── FAVORIS ───────────────────────────────────────────────────
router.get('/favorites', requireAuth, async (req, res) => {
    try {
        const sb = getSupabase(req.token);
        const { data, error } = await sb.from('user_favorites').select('favorites_data').eq('user_id', req.user.id).single();
        if (error && error.code !== 'PGRST116') throw error;
        
        let favorites = [];
        if (data && data.favorites_data) {
            favorites = typeof data.favorites_data === 'string' 
                ? JSON.parse(data.favorites_data) 
                : data.favorites_data;
        }
        res.json({ favorites });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/favorites', requireAuth, async (req, res) => {
    try {
        const { favorites } = req.body;
        if (!favorites) {
            return res.status(400).json({ error: 'favorites data is required' });
        }
        
        const sb = getSupabase(req.token);
        const { data, error } = await sb.from('user_favorites').upsert({ 
            user_id: req.user.id, 
            favorites_data: typeof favorites === 'string' ? favorites : JSON.stringify(favorites), 
            updated_at: new Date().toISOString() 
        }, { onConflict: 'user_id' }).select().single();
        
        if (error) throw error;
        res.status(200).json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── COMMANDES ─────────────────────────────────────────────────
router.get('/orders', requireAuth, async (req, res) => {
    try {
        // Use admin client: RLS policies on 'orders' only check customer_email/supplier_emails,
        // NOT vendor_id or customer_id UUIDs — user-scoped JWT would return 0 rows.
        // Security is enforced by the explicit .or() filter below.
        const sb = supabaseAdmin();
        const { data: orders, error } = await sb.from('orders')
            .select('*, customer:users!orders_customer_id_users_fk(*)')
            .or(`vendor_id.eq.${req.user.id},customer_id.eq.${req.user.id}`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Enrich each order with its latest pending delivery quote
        const orderIds = (orders || []).map(o => o.id);
        let quotesByOrder = {};
        if (orderIds.length > 0) {
            const { data: quotes } = await sb.from('delivery_quotes')
                .select('*')
                .in('order_id', orderIds)
                .eq('status', 'PENDING')
                .order('created_at', { ascending: false });

            (quotes || []).forEach(q => {
                // Keep only the most recent PENDING quote per order
                if (!quotesByOrder[q.order_id]) {
                    quotesByOrder[q.order_id] = q;
                }
            });
        }

        res.json((orders || []).map(o => ({
            ...o,
            status: mapLegacyOrderStatus(o.status),
            latest_delivery_quote: quotesByOrder[o.id] || null
        })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/orders', requireAuth, async (req, res) => {
    try {
        const {
            product_id, vendor_id, quantity = 1,
            customer_phone, customer_name, customer_city, customer_email,
            customer_lat, customer_lng
        } = req.body;

        if (!product_id || !vendor_id) {
            return res.status(400).json({ error: 'product_id et vendor_id sont requis.' });
        }

        const sb = supabaseAdmin();
        
        // 1. Infos produit
        const { data: product, error: pError } = await sb.from('products')
            .select('id, name, price, image, supplier_email, user_id')
            .eq('id', product_id).single();

        if (pError || !product) return res.status(404).json({ error: 'Produit introuvable' });

        const orderId = generateOrderId();
        const amount = Number(product.price) * quantity;

        // 2. Création commande
        const { data: order, error: oError } = await sb.from('orders').insert({
            id: orderId,
            user_id: req.user.id,
            customer_id: req.user.id,
            vendor_id: vendor_id || product.user_id,
            items: [{
                product_id: product.id,
                vendor_id: vendor_id || product.user_id,
                price: product.price,
                name: product.name,
                image: product.image,
                quantity,
                supplier_email: product.supplier_email
            }],
            total: amount,
            merchandise_amount: amount,
            delivery_fee_amount: 0,
            total_amount: amount,
            status: ORDER_STATUSES.PENDING,
            payment_status: 'UNPAID',
            customer_phone,
            customer_name,
            customer_city,
            customer_email: customer_email || req.user.email,
            customer_lat,
            customer_lng
        }).select().single();

        if (oError) throw oError;

        await logOrderStatusHistory(sb, { orderId, newStatus: ORDER_STATUSES.PENDING, changedBy: req.user.id });

        res.status(201).json({ success: true, order });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/orders/:id/quote', requireAuth, async (req, res) => {
    try {
        const { delivery_fee_amount, estimated_delay_hours, note } = req.body;
        const sb = supabaseAdmin();
        
        const { data: order } = await sb.from('orders').select('vendor_id, status').eq('id', req.params.id).single();
        if (order.vendor_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé' });

        const { data: quote, error } = await sb.from('delivery_quotes').insert({
            order_id: req.params.id,
            vendor_id: req.user.id,
            delivery_fee_amount: Number(delivery_fee_amount),
            estimated_delay_hours: parseInt(estimated_delay_hours),
            note
        }).select().single();

        if (error) throw error;

        await sb.from('orders').update({ status: ORDER_STATUSES.QUOTE }).eq('id', req.params.id);
        await logOrderStatusHistory(sb, { orderId: req.params.id, previousStatus: order.status, newStatus: ORDER_STATUSES.QUOTE, changedBy: req.user.id });

        res.status(201).json({ success: true, quote });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/orders/:id/quote/respond', requireAuth, async (req, res) => {
    try {
        const { action } = req.body; // 'ACCEPT' or 'REJECT'
        const sb = supabaseAdmin();
        
        const { data: order } = await sb.from('orders').select('*').eq('id', req.params.id).single();
        if (order.customer_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé' });

        const { data: quote } = await sb.from('delivery_quotes')
            .select('*').eq('order_id', req.params.id).eq('status', 'PENDING')
            .order('created_at', { ascending: false }).limit(1).single();

        if (!quote) return res.status(404).json({ error: 'Aucun devis en attente' });

        const status = action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
        await sb.from('delivery_quotes').update({ status, responded_at: new Date().toISOString() }).eq('id', quote.id);

        let nextStatus = action === 'ACCEPT' ? ORDER_STATUSES.READY_FOR_PAYMENT : ORDER_STATUSES.CANCELLED;
        
        const update = { status: nextStatus };
        if (action === 'ACCEPT') {
            update.accepted_delivery_quote_id = quote.id;
            update.delivery_fee_amount = quote.delivery_fee_amount;
            update.total_amount = Number(order.merchandise_amount) + Number(quote.delivery_fee_amount);
        }

        await sb.from('orders').update(update).eq('id', req.params.id);
        await logOrderStatusHistory(sb, { orderId: req.params.id, previousStatus: order.status, newStatus: nextStatus, changedBy: req.user.id });

        res.json({ success: true, status: nextStatus });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── NOTIFICATIONS ─────────────────────────────────────────────
router.get('/notifications', requireAuth, async (req, res) => {
    try {
        const sb = getSupabase(req.token);
        
        // On cible par email (plus stable sur les notifications legacy)
        // Et on filtre pour exclure les notifications liées aux commandes
        const { data, error } = await sb.from('notifications')
            .select('*')
            .or(`user_id.eq.${req.user.id},user_email.eq.${req.user.email}`)
            .not('type', 'in', '("order","purchase","sale","command")')
            .order('created_at', { ascending: false })
            .limit(50);
            
        if (error) throw error;
        res.json(data || []);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PAIEMENTS ─────────────────────────────────────────────────
router.post('/payments/initiate', async (req, res) => {
    try {
        const { product_id, vendor_id, customer_phone, customer_name, customer_city, customer_email } = req.body;

        if (!product_id || !vendor_id) {
            return res.status(400).json({ error: 'Informations incomplètes pour le paiement' });
        }

        const client = supabaseAdmin();

        // 1. Sécurité : Vérifier le prix en BD
        const { data: product, error: prodError } = await client
            .from('products')
            .select('price, name, supplier_email, custom_exchange_rate')
            .eq('id', product_id)
            .single();

        if (prodError || !product) {
            return res.status(404).json({ error: 'Produit introuvable' });
        }

        // 2. Taux de change (Conversion CDF -> USD)
        const { data: settings } = await client
            .from('settings')
            .select('exchangeRate')
            .eq('id', 'global-settings')
            .single();

        const rate = parseFloat(product.custom_exchange_rate) || parseFloat(settings?.exchangeRate) || 2800;
        const verifiedAmount = product.price;
        const finalAmountUSD = parseFloat((verifiedAmount / rate).toFixed(2));

        const txId = generateTxId();

        // 3. Sauvegarder la commande (PENDING)
        const { error: dbError } = await client
            .from('orders')
            .insert({
                id: txId,
                vendor_id: vendor_id, // IMPORTANT: Ensure the vendor can see the order
                user_id: req.user?.id || null, // Link to customer if logged in
                customer_id: req.user?.id || null,
                items: [{
                    product_id,
                    vendor_id,
                    price: verifiedAmount,
                    name: product.name,
                    quantity: 1,
                    supplier_email: product.supplier_email
                }],
                total: verifiedAmount,
                total_amount: verifiedAmount,
                status: 'En attente',
                payment_status: 'PENDING',
                transaction_id: txId,
                customer_phone: customer_phone || null,
                phone_number: customer_phone || null,
                customer_name: customer_name || 'Client NewKet',
                customer_city: customer_city || null,
                customer_email: customer_email || 'client@newket.cd'
            });

        if (dbError) throw dbError;

        // 4. AvadaPay Payload
        if (!process.env.AVADAPAY_API_BASE_URL || !process.env.AVADAPAY_SECRET_KEY) {
            throw new Error('AvadaPay n’est pas configuré (AVADAPAY_API_BASE_URL / AVADAPAY_SECRET_KEY)');
        }

        const avadaPayload = {
            tx_ref: txId,
            amount: finalAmountUSD,
            currency: 'USD',
            redirect_url: process.env.AVADAPAY_REDIRECT_URL || `https://${req.headers.host}/pages/payment-success.html`,
            customer: {
                email: customer_email || 'client@newket.cd',
                phonenumber: customer_phone || '',
                name: customer_name || 'Client NewKet'
            },
            customizations: {
                title: 'NewKet Marketplace',
                description: `Achat : ${product.name}`,
                logo: 'https://kuygjocnnlvjtoaquicq.supabase.co/storage/v1/object/public/newket-logo/logo.png'
            },
            meta: { transaction_id: txId, product_id, vendor_id }
        };

        const avadaUrl = process.env.AVADAPAY_API_BASE_URL.replace(/\/$/, '') + '/payments';
        const avadaResponse = await fetch(avadaUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.AVADAPAY_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(avadaPayload)
        });

        const avadaData = await avadaResponse.json().catch(() => ({}));
        if (!avadaResponse.ok) {
            throw new Error(avadaData.message || `Erreur AvadaPay (HTTP ${avadaResponse.status})`);
        }

        const paymentUrl = avadaData?.data?.link || avadaData?.data?.payment_url || avadaData?.payment_url || avadaData?.link;
        if (!paymentUrl) {
            throw new Error('Réponse AvadaPay invalide: payment_url manquant');
        }

        res.status(200).json({
            success: true,
            transaction_id: txId,
            payment_url: paymentUrl,
            public_key: process.env.AVADAPAY_PUBLIC_KEY
        });
    } catch (err) {
        console.error('Erreur initiatePayment:', err);
        res.status(500).json({ success: false, error: "Impossible d'initialiser le paiement", message: err.message });
    }
});

router.patch('/notifications/:id/read', requireAuth, async (req, res) => {
    try {
        const sb = getSupabase(req.token);
        const { data, error } = await sb.from('notifications').update({ read: true })
            .eq('id', req.params.id)
            .select().single();
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PROFIL ────────────────────────────────────────────────────
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const sb = getSupabase(req.token);
        const { data, error } = await sb.from('profiles').select('*').eq('id', req.user.id).single();
        if (error && error.code !== 'PGRST116') throw error;
        res.json(data || {});
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── EMAILS ────────────────────────────────────────────────────
router.post('/emails/lead-notification', optionalAuth, async (req, res) => {
    const { vendorEmail, vendorName, productName, customerName, customerPhone } = req.body;
    if (!vendorEmail || !vendorName || !productName) {
        return res.status(400).json({ error: 'Informations manquantes.' });
    }
    const result = await EmailService.sendLeadNotification({
        vendorEmail, vendorName, productName, customerName, customerPhone
    });
    if (result.success) res.json({ success: true });
    else res.status(500).json({ error: result.error });
});

// ── REVIEWS ───────────────────────────────────────────────────
router.get('/reviews', async (req, res) => {
    try {
        const { product_id, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;
        const sb = supabaseAdmin();
        let query = sb.from('product_reviews').select('*').order('created_at', { ascending: false }).range(offset, offset + limit - 1);
        if (product_id) query = query.eq('product_id', product_id);
        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── SUPPORT ───────────────────────────────────────────────────
router.post('/support/tickets', optionalAuth, async (req, res) => {
    try {
        const { subject, customer_name, customer_email, message } = req.body;
        if (!subject || !customer_name || !message) return res.status(400).json({ error: 'Champs requis manquants.' });
        const ticketId = `TKT-${Date.now().toString().slice(-6)}`;
        const { data, error } = await supabaseAdmin().from('support_tickets').insert({
            id: ticketId, subject, customer_name, customer_email, message, status: 'OPEN'
        }).select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/profile', requireAuth, async (req, res) => {
    try {
        const sb = getSupabase(req.token);
        const { data, error } = await sb.from('profiles').upsert({ ...req.body, id: req.user.id }).select().single();
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Montage du routeur sur '/' et '/api' pour une compatibilité maximale
app.use('/api', router);
app.use('/', router);

// ── CRON JOBS ────────────────────────────────────────────────
router.get('/cron/escrows/release-due', requireCronAuth, async (req, res) => {
    try {
        const sb = supabaseAdmin();
        const now = new Date().toISOString();
        
        const { data: orders, error } = await sb.from('orders')
            .select('*')
            .eq('status', CRON_STATUSES.ORDER_DELIVERED)
            .lte('escrow_release_at', now);
            
        if (error) throw error;
        
        let processed = 0;
        for (const order of (orders || [])) {
            await sb.from('orders').update({
                status: CRON_STATUSES.ORDER_COMPLETED,
                escrow_status: CRON_STATUSES.ESCROW_AUTO_RELEASED,
                released_at: now,
                completed_at: now,
                updated_at: now
            }).eq('id', order.id);
            
            await sb.from('order_status_history').insert({
                order_id: order.id,
                previous_status: CRON_STATUSES.ORDER_DELIVERED,
                new_status: CRON_STATUSES.ORDER_COMPLETED,
                changed_by: 'system-cron',
                notes: 'Auto-release via Vercel Cron'
            });
            processed++;
        }
        
        res.json({ success: true, job: 'release-due-escrows', processed, timestamp: now });
    } catch (err) {
        console.error('[Cron] Escrow release failed:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/cron/disputes/process-due', requireCronAuth, async (req, res) => {
    try {
        const sb = supabaseAdmin();
        const now = new Date().toISOString();
        
        const { data: disputes, error } = await sb.from('disputes')
            .select('*')
            .in('status', [
                CRON_STATUSES.DISPUTE_SELLER_PENDING,
                CRON_STATUSES.DISPUTE_BUYER_PENDING,
                CRON_STATUSES.DISPUTE_UNDER_REVIEW
            ]);
            
        if (error) throw error;
        
        let processed = 0;
        for (const dispute of (disputes || [])) {
            let shouldResolve = false;
            let resolution = '';
            let reason = '';
            
            if (dispute.status === CRON_STATUSES.DISPUTE_SELLER_PENDING && dispute.seller_response_due_at <= now) {
                shouldResolve = true;
                resolution = CRON_STATUSES.RESOLUTION_FULL_REFUND;
                reason = 'seller_timeout';
            } else if (dispute.status === CRON_STATUSES.DISPUTE_BUYER_PENDING && dispute.buyer_response_due_at <= now) {
                shouldResolve = true;
                resolution = dispute.proposed_resolution || CRON_STATUSES.RESOLUTION_FULL_REFUND;
                reason = 'buyer_timeout';
            } else if (dispute.status === CRON_STATUSES.DISPUTE_UNDER_REVIEW && dispute.review_due_at <= now) {
                shouldResolve = true;
                resolution = CRON_STATUSES.RESOLUTION_RELEASE_TO_SELLER; // Default admin timeout policy
                reason = 'review_timeout';
            }
            
            if (shouldResolve) {
                await sb.from('disputes').update({
                    status: CRON_STATUSES.DISPUTE_RESOLVED,
                    resolution,
                    resolved_at: now,
                    updated_at: now
                }).eq('id', dispute.id);
                
                await sb.from('dispute_messages').insert({
                    dispute_id: dispute.id,
                    type: 'SYSTEM',
                    payload: { event: 'AUTO_RESOLVE', reason, resolution }
                });
                processed++;
            }
        }
        
        res.json({ success: true, job: 'process-due-disputes', processed, timestamp: now });
    } catch (err) {
        console.error('[Cron] Dispute processing failed:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── Gestion des erreurs globale ───────────────────────────────
app.use((err, req, res, next) => {
    console.error('❌ Erreur serveur:', err.message);
    res.status(500).json({ error: 'Erreur interne du serveur' });
});

// ── Export pour Vercel ────────────────────────────────────────
export default app;

// ── Serveur de développement local ────────────────────────────
// Permet de lancer 'node api/index.js' pour tester l'API localement sur le port 3000
if (process.env.NODE_ENV !== 'production' || process.argv.includes('--listen')) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 API Server running on http://localhost:${PORT}`);
        console.log(`📡 Proxy: Vite (5173) -> API (${PORT})`);
    });
}
