import { supabaseAdmin, supabase } from '../config/supabase.js';

export const getUsers = async (req, res) => {
    try {
        const client = supabaseAdmin || supabase;
        // ✅ OPTIMISATION: Colonnes précises seulement (pas de select('*'))
        const { data, error } = await client
            .from('users')
            .select('id, email, name, role, status, avatar, company_name, created_at:date_joined')
            .order('date_joined', { ascending: false });

        if (error) throw error;

        return res.status(200).json(data);
    } catch (err) {
        console.error('❌ Erreur getUsers:', err.message);
        return res.status(500).json({ error: 'Failed to fetch users' });
    }
};

export const updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        const client = supabaseAdmin || supabase;

        const { data, error } = await client
            .from('users')
            .update({ status })
            .eq('id', id)
            .select();

        if (error) throw error;

        return res.status(200).json({ success: true, user: data[0] });
    } catch (err) {
        console.error('❌ Erreur updateStatus:', err.message);
        return res.status(500).json({ error: 'Failed to update user status' });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const client = supabaseAdmin || supabase;

        // Optionally prevent deleting self or other checks
        const { error } = await client
            .from('users')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('❌ Erreur deleteUser:', err.message);
        return res.status(500).json({ error: 'Failed to delete user' });
    }
};
