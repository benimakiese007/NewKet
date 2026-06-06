import { supabaseAdmin } from '../config/supabase.js';
import { enqueuePushNotification } from '../services/push-queue.service.js';

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

        // âœ… OPTIMISATION: Colonnes précises seulement
        const { data, error } = await supabaseAdmin
            .from('notifications')
            .select('id, user_id, user_email, title, message, type, target_role, read, date')
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

        const isBroadcast = type === 'broadcast'
            || String(type || '').startsWith('broadcast:')
            || String(type || '').startsWith('broadcast-modal:');
        const mappedTargetRole = isBroadcast ? 'all' : (target || 'all');

        const insertPayload = {
            id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title,
            message,
            type: type || 'info',
            target_role: mappedTargetRole,
            read: false,
            date: new Date().toISOString()
        };

        // Admin-created notifications target a role/group, not the admin who sent them.

        const { data, error } = await supabaseAdmin
            .from('notifications')
            .insert(insertPayload)
            .select()
            .single();

        if (error) throw error;
        try {
            const pushJob = await enqueuePushNotification(data);
            console.log(`[Notifications] Web push queued: ${pushJob?.id || 'unknown'}`);
        } catch (pushError) {
            console.error('Erreur web push notification:', pushError);
        }
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

        const getMappedTargetForUser = async () => {
            let userRole = 'customer';
            if (userId) {
                const { data: userData } = await supabaseAdmin.from('users').select('role').eq('id', userId).single();
                if (userData && userData.role) userRole = userData.role;
            } else if (userEmail) {
                const { data: userData } = await supabaseAdmin.from('users').select('role').eq('email', userEmail).single();
                if (userData && userData.role) userRole = userData.role;
            }
            return userRole === 'supplier' ? 'suppliers' : 'customers';
        };

        const updateRead = async (filter) => {
            let query = supabaseAdmin
                .from('notifications')
                .update({ read: true })
                .eq('id', id);

            if (filter?.user_id) query = query.eq('user_id', filter.user_id);
            if (filter?.user_email) query = query.eq('user_email', filter.user_email);

            const { data, error } = await query.select();
            if (error) throw error;
            return Array.isArray(data) && data.length > 0 ? data[0] : null;
        };

        // Compatibility: many notifications were stored with user_email but no user_id.
        // Try user_id first (preferred), then fall back to user_email.
        let updated = null;
        if (userId) updated = await updateRead({ user_id: userId });
        if (!updated && userEmail) updated = await updateRead({ user_email: userEmail });

        // Broadcast notifications are stored without user_id/user_email.
        // With the current schema, a "read" update is global; allow it only if it targets this user's role.
        if (!updated) {
            const { data: notif, error: notifErr } = await supabaseAdmin
                .from('notifications')
                .select('id, user_id, user_email, target_role')
                .eq('id', id)
                .maybeSingle();

            if (notifErr) throw notifErr;

            const isBroadcast = notif && !notif.user_id && !notif.user_email;
            if (isBroadcast) {
                const mappedTarget = await getMappedTargetForUser();
                const allowed = notif.target_role === 'all' || notif.target_role === mappedTarget;
                if (allowed) updated = await updateRead();
            }
        }

        if (!updated) {
            return res.status(404).json({ error: 'Notification introuvable ou non autorisée.' });
        }

        res.json(updated);
    } catch (err) {
        console.error('Erreur markAsRead:', err);
        res.status(500).json({ error: 'Erreur lors de la mise à jour de la notification.' });
    }
};

export const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const userEmail = req.user?.email;

        if (!userEmail) return res.status(401).json({ error: 'Non autorisé' });

        // Vérifier si l'utilisateur est admin
        const { data: userData } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('email', userEmail)
            .single();

        const isAdmin = userData && userData.role === 'admin';

        const deleteOne = async (filter) => {
            let query = supabaseAdmin
                .from('notifications')
                .delete()
                .eq('id', id);

            if (filter?.user_id) query = query.eq('user_id', filter.user_id);
            if (filter?.user_email) query = query.eq('user_email', filter.user_email);

            const { data, error } = await query.select('id');
            if (error) throw error;
            return Array.isArray(data) && data.length > 0;
        };

        // SÉCURITÉ : Les non-admins ne peuvent supprimer que leurs propres notifications
        if (!isAdmin) {
            // Compatibility: many notifications were stored with user_email but no user_id.
            // Try user_id first (preferred), then fall back to user_email.
            let deleted = false;
            if (userId) deleted = await deleteOne({ user_id: userId });
            if (!deleted && userEmail) deleted = await deleteOne({ user_email: userEmail });

            if (!deleted) {
                return res.status(404).json({ error: 'Notification introuvable ou non autorisée.' });
            }
        } else {
            const { error } = await supabaseAdmin.from('notifications').delete().eq('id', id);
            if (error) throw error;
        }
        res.json({ success: true, message: 'Notification supprimée.' });
    } catch (err) {
        console.error('Erreur deleteNotification:', err);
        res.status(500).json({ error: 'Erreur lors de la suppression.' });
    }
};

export const clearNotifications = async (req, res) => {
    try {
        const userEmail = req.user?.email;
        if (!userEmail) return res.status(401).json({ error: 'Non autorisé' });

        // Retrieve user role to see if they are admin
        const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('email', userEmail)
            .single();

        if (userError && userError.code !== 'PGRST116') { // PGRST116 is code for "no rows found"
            console.error('Erreur lookup utilisateur:', userError);
        }

        const isAdmin = userData && userData.role === 'admin';
        let query = supabaseAdmin.from('notifications').delete();

        if (!isAdmin) {
            // Standard users only clear their own
            query = query.eq('user_email', userEmail);
        } else {
            // Admins clear all (their own + system wide)
            // Safety: Supabase often requires a filter for bulky operations.
            // We use a "match all" filter via .neq('id', '0') or comparable.
            query = query.neq('id', 'void-id-placeholder');
            console.log(`[Admin] Global notification clear triggered by ${userEmail}`);
        }

        const { error } = await query;

        if (error) {
            console.error('Erreur Supabase DELETE:', error);
            throw new Error(`Supabase error: ${error.message}`);
        }

        res.json({ success: true, message: 'Toutes les notifications ont été supprimées.' });
    } catch (err) {
        console.error('Erreur clearNotifications:', err);
        res.status(500).json({ error: 'Erreur lors de la suppression groupée.', details: err.message });
    }
};
