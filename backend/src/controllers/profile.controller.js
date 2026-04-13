import { supabaseAdmin } from '../config/supabase.js';

export const getMyProfile = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Utilisateur non authentifié' });

        // ✅ OPTIMISATION: Colonnes précises seulement
        const { data, error } = await supabaseAdmin
            .from('users')
            .select('id, email, name, role, status, avatar, company_name, phone, bio, province_id, commune_id, quartier_id, created_at, updated_at')
            .eq('id', userId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
            throw error;
        }

        res.json(data || null);
    } catch (err) {
        console.error('Erreur getMyProfile:', err);
        res.status(500).json({ error: 'Erreur lors de la récupération du profil.' });
    }
};

export const updateMyProfile = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Utilisateur non authentifié' });

        const updates = req.body;
        
        const { data, error } = await supabaseAdmin
            .from('users')
            .upsert({ ...updates, id: userId, updated_at: new Date().toISOString() })
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('Erreur updateMyProfile:', err);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du profil.' });
    }
};
