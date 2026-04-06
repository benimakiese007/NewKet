import { supabaseAdmin } from '../config/supabase.js';

export const getPromos = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('promos')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Erreur getPromos:', err);
        res.status(500).json({ error: 'Erreur lors de la récupération des promotions.' });
    }
};

export const applyPromo = async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Code requis.' });

        // Appel de la fonction RPC si elle existe, ou mise à jour directe (dépend de l'implémentation Supabase)
        // Dans le frontend actuel, c'est PromoManager.incrementUsage -> const { data, error } = await supabase.rpc('apply_promo_secure', { promo_code: code })
        const { data, error } = await supabaseAdmin.rpc('apply_promo_secure', { promo_code: code });

        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('Erreur applyPromo:', err);
        res.status(500).json({ error: err.message || 'Erreur lors de l\'application du code promo.' });
    }
};
