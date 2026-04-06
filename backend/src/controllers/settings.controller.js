import { supabaseAdmin } from '../config/supabase.js';

export const getSettings = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('settings')
            .select('*');

        if (error) throw error;
        // Normalement on retourne un seul objet globale de settings
        res.json(data && data.length > 0 ? data : []);
    } catch (err) {
        console.error('Erreur getSettings:', err);
        res.status(500).json({ error: 'Erreur lors de la récupération des paramètres.' });
    }
};

export const saveSettings = async (req, res) => {
    try {
        const config = req.body;
        
        let existingId = config.id;
        if (!existingId) {
            const { data: existing } = await supabaseAdmin.from('settings').select('id').limit(1);
            if (existing && existing.length > 0) {
                existingId = existing[0].id;
            } else {
                existingId = 'global-settings';
            }
        }

        const { data, error } = await supabaseAdmin
            .from('settings')
            .upsert({ ...config, id: existingId })
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('Erreur saveSettings:', err);
        res.status(500).json({ error: 'Erreur lors de la sauvegarde des paramètres.' });
    }
};
