import { supabaseAdmin, supabase } from '../config/supabase.js';

// Order is a term used for whatsapp_clicks in NewKet
export const getOrders = async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * parseInt(limit);
        const client = supabaseAdmin || supabase;

        // ✅ OPTIMISATION: Pagination + colonnes précises (fini limit:500 d'un coup)
        const { data, error } = await client
            .from('orders')
            .select('id, status, created_at, total_amount, customer_name, customer_email, phone_number')
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        if (error) throw error;
        
        return res.status(200).json(data);
    } catch (err) {
        console.error('❌ Erreur getOrders:', err.message);
        return res.status(500).json({ error: 'Failed to fetch orders/leads' });
    }
};

export const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        const client = supabaseAdmin || supabase;

        const { data, error } = await client
            .from('orders')
            .update({ status })
            .eq('id', id)
            .select();

        if (error) throw error;

        return res.status(200).json({ success: true, order: data[0] });
    } catch (err) {
        console.error('❌ Erreur updateOrderStatus:', err.message);
        return res.status(500).json({ error: 'Failed to update order status' });
    }
};
