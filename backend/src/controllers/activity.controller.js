import { supabaseAdmin } from '../config/supabase.js';

export const getActivities = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('activities')
            .select('*')
            .order('time', { ascending: false })
            .limit(50);

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

        const userId = req.user.id;
        
        const { data, error } = await supabaseAdmin
            .from('activities')
            .insert({
                user_id: userId,
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
