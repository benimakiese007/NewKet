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

const app = express();

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

// ── Health ────────────────────────────────────────────────────
app.get('/api/health', (req, res) =>
    res.json({ status: 'ok', message: 'NewKet Serverless API 🚀', timestamp: new Date().toISOString() })
);

// ── PRODUITS ──────────────────────────────────────────────────
app.get('/api/products', optionalAuth, async (req, res) => {
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

app.get('/api/products/:id', optionalAuth, async (req, res) => {
    try {
        const sb = getSupabase(req.token);
        const { data, error } = await sb.from('products').select('*').eq('id', req.params.id).single();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Produit non trouvé' });
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/products', requireAuth, async (req, res) => {
    try {
        const productData = { ...req.body, user_id: req.user.id };
        const sb = getSupabase(req.token);
        const { data, error } = await sb.from('products').insert(productData).select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/products/:id', requireAuth, async (req, res) => {
    try {
        const sb = getSupabase(req.token);
        const { data, error } = await sb.from('products').update(req.body).eq('id', req.params.id).select().single();
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/products/:id', requireAuth, async (req, res) => {
    try {
        const sb = getSupabase(req.token);
        const { error } = await sb.from('products').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/products/bulk-delete', requireAuth, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids)) return res.status(400).json({ error: 'IDs invalides' });
        const { error } = await supabaseAdmin().from('products').delete().in('id', ids);
        if (error) throw error;
        res.json({ success: true, count: ids.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/products/bulk-category', requireAuth, async (req, res) => {
    try {
        const { ids, category } = req.body;
        if (!Array.isArray(ids) || !category) return res.status(400).json({ error: 'Paramètres invalides' });
        const { error } = await supabaseAdmin().from('products').update({ category }).in('id', ids);
        if (error) throw error;
        res.json({ success: true, count: ids.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PROMOS ────────────────────────────────────────────────────
app.get('/api/promos', optionalAuth, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin().from('promos').select('*')
            .order('created_at', { ascending: false }).limit(100);
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/promos/apply', requireAuth, async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Code requis.' });
        const { data, error } = await supabaseAdmin().rpc('apply_promo_secure', { promo_code: code });
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ACTIVITÉS ─────────────────────────────────────────────────
app.get('/api/activities', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin().from('activities').select('*')
            .eq('user_email', req.user.email).order('time', { ascending: false }).limit(50);
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/activities', requireAuth, async (req, res) => {
    try {
        const { text, type } = req.body;
        if (!text) return res.status(400).json({ error: 'Texte requis.' });
        const { data, error } = await supabaseAdmin().from('activities')
            .insert({ user_email: req.user.email, text, type: type || 'info', time: new Date().toISOString() })
            .select().single();
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PARAMÈTRES ────────────────────────────────────────────────
app.get('/api/settings', async (req, res) => {
    try {
        const { data, error } = await getSupabase().from('settings').select('*');
        if (error) throw error;
        res.json(data && data.length > 0 ? data : []);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/settings', requireAuth, requireAdmin, async (req, res) => {
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
app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin().auth.admin.listUsers();
        if (error) throw error;
        res.json(data.users);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users/:id', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin().from('profiles').select('*').eq('id', req.params.id).single();
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── FAVORIS ───────────────────────────────────────────────────
app.get('/api/favorites', requireAuth, async (req, res) => {
    try {
        const sb = getSupabase(req.token);
        const { data, error } = await sb.from('favorites').select('*, products(*)').eq('user_id', req.user.id);
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/favorites', requireAuth, async (req, res) => {
    try {
        const { product_id } = req.body;
        const sb = getSupabase(req.token);
        const { data, error } = await sb.from('favorites').insert({ user_id: req.user.id, product_id }).select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/favorites/:product_id', requireAuth, async (req, res) => {
    try {
        const sb = getSupabase(req.token);
        const { error } = await sb.from('favorites').delete()
            .eq('user_id', req.user.id).eq('product_id', req.params.product_id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── COMMANDES ─────────────────────────────────────────────────
app.get('/api/orders', requireAuth, async (req, res) => {
    try {
        const sb = getSupabase(req.token);
        const { data, error } = await sb.from('orders').select('*, products(name, images)').eq('user_id', req.user.id)
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/orders', requireAuth, async (req, res) => {
    try {
        const sb = getSupabase(req.token);
        const { data, error } = await sb.from('orders').insert({ ...req.body, user_id: req.user.id }).select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── NOTIFICATIONS ─────────────────────────────────────────────
app.get('/api/notifications', requireAuth, async (req, res) => {
    try {
        const sb = getSupabase(req.token);
        const { data, error } = await sb.from('notifications').select('*').eq('user_id', req.user.id)
            .order('created_at', { ascending: false }).limit(50);
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/notifications/:id/read', requireAuth, async (req, res) => {
    try {
        const sb = getSupabase(req.token);
        const { data, error } = await sb.from('notifications').update({ read: true })
            .eq('id', req.params.id).eq('user_id', req.user.id).select().single();
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PROFIL ────────────────────────────────────────────────────
app.get('/api/profile', requireAuth, async (req, res) => {
    try {
        const sb = getSupabase(req.token);
        const { data, error } = await sb.from('profiles').select('*').eq('id', req.user.id).single();
        if (error && error.code !== 'PGRST116') throw error;
        res.json(data || {});
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/profile', requireAuth, async (req, res) => {
    try {
        const sb = getSupabase(req.token);
        const { data, error } = await sb.from('profiles').upsert({ ...req.body, id: req.user.id }).select().single();
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Gestion des erreurs globale ───────────────────────────────
app.use((err, req, res, next) => {
    console.error('❌ Erreur serveur:', err.message);
    res.status(500).json({ error: 'Erreur interne du serveur' });
});

// ── Export pour Vercel ────────────────────────────────────────
export default app;
