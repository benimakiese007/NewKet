import { supabaseAdmin } from '../config/supabase.js';

export const getActivities = async (req, res) => {
    try {
        const userId = req.user?.id;
        const userEmail = req.user?.email;
        if (!userEmail) return res.status(401).json({ error: 'Non autorisé' });

        // Check if user is admin to allow seeing all activities
        let isAdmin = false;
        if (userId) {
            const { data: userData } = await supabaseAdmin
                .from('users')
                .select('role')      // ✅ Seulement le champ nécessaire
                .eq('id', userId)
                .single();
            if (userData?.role === 'admin') isAdmin = true;
        }

        // ✅ OPTIMISATION: Colonnes précises seulement
        let query = supabaseAdmin
            .from('activities')
            .select('id, user_email, text, type, time')
            .order('time', { ascending: false })
            .limit(50);

        // Admin sees all activities; others see only their own
        if (!isAdmin) {
            query = query.eq('user_email', userEmail);
        }

        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Erreur getActivities:', err);
        res.status(500).json({ error: 'Erreur lors de la récupération des activités.' });
    }
};

export const logActivity = async (req, res) => {
    try {
        const { text, type } = req.body;
        if (!text) return res.status(400).json({ error: 'Texte requis.' });
        if (!req.user) return res.status(401).json({ error: 'Utilisateur non authentifié.' });

        const userEmail = req.user.email;
        
        const { data, error } = await supabaseAdmin
            .from('activities')
            .insert({
                user_email: userEmail,
                text,
                type: type || 'info',
                time: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Erreur logActivity:', err);
        res.status(500).json({ error: 'Erreur lors de l\'enregistrement de l\'activité.' });
    }
};
