import { supabaseAdmin, supabase } from '../config/supabase.js';

// Order is a term used for whatsapp_clicks in NewKet
export const getOrders = async (req, res) => {
    try {
        const client = supabaseAdmin || supabase;
        // Limit to 500 for now, as in frontend
        // Order is a term used for the orders table in NewKet
        const { data, error } = await client
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(500);

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
