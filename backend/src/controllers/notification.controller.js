import { supabaseAdmin } from '../config/supabase.js';

export const getNotifications = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Non autorisé' });

        const { data, error } = await supabaseAdmin
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: false })
            .limit(50);

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Erreur getNotifications:', err);
        res.status(500).json({ error: 'Erreur lors de la récupération des notifications.' });
    }
};

export const addNotification = async (req, res) => {
    try {
        const { title, message, type } = req.body;
        const userId = req.user?.id;
        
        if (!userId) return res.status(401).json({ error: 'Utilisateur non authentifié.' });
        if (!title || !message) return res.status(400).json({ error: 'Titre et message requis.' });

        const { data, error } = await supabaseAdmin
            .from('notifications')
            .insert({
                user_id: userId,
                title,
                message,
                type: type || 'info',
                read: false,
                date: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Erreur addNotification:', err);
        res.status(500).json({ error: 'Erreur lors de la création de la notification.' });
    }
};

export const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        
        if (!userId) return res.status(401).json({ error: 'Non autorisé' });

        const { data, error } = await supabaseAdmin
            .from('notifications')
            .update({ read: true })
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Erreur markAsRead:', err);
        res.status(500).json({ error: 'Erreur lors de la mise à jour de la notification.' });
    }
};
