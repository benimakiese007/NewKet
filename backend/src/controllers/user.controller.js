import { supabaseAdmin, supabase } from '../config/supabase.js';

export const getPublicUserStats = async (req, res) => {
    try {
        const client = supabaseAdmin || supabase;
        const { count, error } = await client
            .from('users')
            .select('id', { count: 'exact', head: true });

        if (error) throw error;

        return res.status(200).json({
            totalUsers: Number(count) || 0
        });
    } catch (err) {
        console.error('❌ Erreur getPublicUserStats:', err.message);
        return res.status(500).json({ error: 'Failed to fetch public user stats' });
    }
};

export const getUsers = async (req, res) => {
    try {
        const client = supabaseAdmin || supabase;
        // Return the fields the admin seller review screens actually use.
        const { data, error } = await client
            .from('users')
            .select(`
                id,
                email,
                name,
                role,
                status,
                avatar,
                cover_image,
                company_name,
                store_description,
                store_address,
                store_phone,
                shipping_time,
                preferred_payout_method,
                documents_url,
                physical_shop_url,
                shop_slug,
                date_joined
            `)
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
