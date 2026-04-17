import { supabaseAdmin, supabase } from '../config/supabase.js';

// Order is a term used for whatsapp_clicks in NewKet
export const getOrders = async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * parseInt(limit);
        const client = supabaseAdmin || supabase;

        // ✅ Fallback logic: If 'orders' table fails (e.g. dropped in lead-gen migration), 
        // we fallback to 'whatsapp_clicks' which represent the new "orders" (leads).
        let { data, error } = await client
            .from('orders')
            .select('id, status, created_at, total, total_amount, customer_name, customer_email, phone_number, items, payment_status, transaction_id, user_id, vendor_id, customer_id')
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        if (error) {
            console.warn('⚠️ orders table query failed, falling back to whatsapp_clicks:', error.message);
            
            // Query whatsapp_clicks as leads
            const { data: leads, error: leadsError } = await client
                .from('whatsapp_clicks')
                .select('id, product_id, vendor_id, clicked_at')
                .order('clicked_at', { ascending: false })
                .range(offset, offset + parseInt(limit) - 1);

            if (leadsError) throw leadsError;

            // Map leads to order-like structure for frontend compatibility
            data = (leads || []).map(l => ({
                id: l.id,
                product_id: l.product_id,
                vendor_id: l.vendor_id,
                created_at: l.clicked_at,
                status: 'Lead WhatsApp',
                payment_status: 'N/A',
                total: 0 // Will be filled by frontend OrderManager from ProductManager
            }));
        }
        
        return res.status(200).json(data);
    } catch (err) {
        console.error('❌ Erreur getOrders:', err.message);
        return res.status(500).json({ error: 'Failed to fetch orders/leads', message: err.message });
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
