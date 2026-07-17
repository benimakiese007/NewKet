import { supabaseAdmin, supabase } from '../config/supabase.js';

export const syncFromSupabase = async (req, res) => {
    try {
        const userId = req.user.id;
        // Utilisez admin pour outrepasser les possibles problèmes RLS si besoin,
        // mais supabase via req.token est aussi possible. Utilisons admin pour fiabilité si présent.
        const client = supabaseAdmin || supabase;

        const { data, error } = await client
            .from('user_favorites')
            .select('favorites_data')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is no rows returned, which is fine
            throw error;
        }

        let favorites = [];
        if (data && data.favorites_data) {
            favorites = typeof data.favorites_data === 'string' 
                ? JSON.parse(data.favorites_data) 
                : data.favorites_data;
        }

        return res.status(200).json({ favorites });
    } catch (err) {
        console.error('❌ Erreur syncFromSupabase (favorites):', err.message);
        return res.status(500).json({ error: 'Failed to fetch favorites' });
    }
};

export const syncToSupabase = async (req, res) => {
    try {
        const userId = req.user.id;
        const { favorites } = req.body;

        if (!favorites) {
            return res.status(400).json({ error: 'favorites data is required' });
        }

        const client = supabaseAdmin || supabase;

        // Upsert
        const { data, error } = await client
            .from('user_favorites')
            .upsert({ 
                user_id: userId, 
                favorites_data: typeof favorites === 'string' ? favorites : JSON.stringify(favorites), 
                updated_at: new Date().toISOString() 
            }, { onConflict: 'user_id' });

        if (error) throw error;

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('❌ Erreur syncToSupabase (favorites):', err.message);
        return res.status(500).json({ error: 'Failed to sync favorites' });
    }
};
