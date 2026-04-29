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

// Helpers
const generateTxId = () => {
    return 'NK_' + Math.random().toString(36).substr(2, 9).toUpperCase() + '_' + Date.now();
};

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

// ── Health ────────────────────────────────────────────────────
router.get('/health', (req, res) =>
    res.json({ status: 'ok', message: 'NewKet Serverless API 🚀', timestamp: new Date().toISOString() })
);

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
        const { data, error } = await supabaseAdmin().auth.admin.listUsers();
        if (error) throw error;
        res.json(data.users);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/users/:id', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin().from('profiles').select('*').eq('id', req.params.id).single();
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

// ── COMMANDES (DÉSACTIVÉES - MODÈLE LEAD GEN) ─────────────────
router.get('/orders', requireAuth, async (req, res) => {
    // NewKet est passé à un modèle Lead Generation (WhatsApp). 
    // La table 'orders' a été supprimée. On retourne une liste vide instantanément.
    res.json([]);
});

router.post('/orders', requireAuth, async (req, res) => {
    res.status(410).json({ error: 'Le système de commande directe est désactivé. Utilisez les boutons WhatsApp.' });
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

// ── Gestion des erreurs globale ───────────────────────────────
app.use((err, req, res, next) => {
    console.error('❌ Erreur serveur:', err.message);
    res.status(500).json({ error: 'Erreur interne du serveur' });
});

// ── Export pour Vercel ────────────────────────────────────────
export default app;
