import { supabaseAdmin } from '../config/supabase.js';

export const getNotifications = async (req, res) => {
    try {
        const userId = req.user?.id;
        const userEmail = req.user?.email;
        if (!userId && !userEmail) return res.status(401).json({ error: 'Non autorisé' });

        // Retrieve user role from public.users to map to target (customers/suppliers)
        let userRole = 'customer';
        if (userId) {
            const { data: userData } = await supabaseAdmin.from('users').select('role').eq('id', userId).single();
            if (userData && userData.role) userRole = userData.role;
        }
        
        // Match the target mapped from select options in admin UI
        const mappedTarget = userRole === 'supplier' ? 'suppliers' : 'customers';

        // Filter: specifically to this user via ID/Email OR public for 'all' OR public for this mapped target
        let condition = `target_role.eq.all,target_role.eq.${mappedTarget}`;
        if (userId) condition += `,user_id.eq.${userId}`;
        if (userEmail) condition += `,user_email.eq.${userEmail}`;

        const { data, error } = await supabaseAdmin
            .from('notifications')
            .select('*')
            .or(condition)
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
        const { title, message, type, target } = req.body;
        const userId = req.user?.id;
        const userEmail = req.user?.email;
        
        if (!userEmail) return res.status(401).json({ error: 'Utilisateur non authentifié.' });
        if (!title || !message) return res.status(400).json({ error: 'Titre et message requis.' });

        const mappedTargetRole = target || 'all';

        const { data, error } = await supabaseAdmin
            .from('notifications')
            .insert({
                ...(userId ? { user_id: userId } : {}),
                user_email: userEmail,
                title,
                message,
                type: type || 'info',
                target_role: mappedTargetRole,
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
        const userEmail = req.user?.email;
        
        if (!userId && !userEmail) return res.status(401).json({ error: 'Non autorisé' });

        let query = supabaseAdmin
            .from('notifications')
            .update({ read: true })
            .eq('id', id);

        // Filter by user_id (UUID) if available, else fallback to email
        if (userId) {
            query = query.eq('user_id', userId);
        } else {
            query = query.eq('user_email', userEmail);
        }

        const { data, error } = await query.select().single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Erreur markAsRead:', err);
        res.status(500).json({ error: 'Erreur lors de la mise à jour de la notification.' });
    }
};

