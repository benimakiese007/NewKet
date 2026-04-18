import { supabaseAdmin, supabase } from '../config/supabase.js';

// ─── Statuts de commande autorisés ────────────────────────────────────────────
// Whitelist stricte : seuls ces statuts peuvent être écrits en base via l'API.
// N'importe quel autre valeur sera rejetée avec un 400.
const ALLOWED_ORDER_STATUSES = [
    'PENDING',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'ANNULÉ',
    'COMPLETED',
    'REFUNDED',
];

// Order is a term used for whatsapp_clicks in NewKet
export const getOrders = async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * parseInt(limit);
        const client = supabaseAdmin || supabase;

        let result = [];
        const { data: ordersData, error: ordersError } = await client
            .from('orders')
            .select('id, status, created_at, total, total_amount, customer_name, customer_email, phone_number, items, payment_status, transaction_id, user_id')
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        if (!ordersError) {
            result = ordersData || [];
        } else {
            console.warn('⚠️ orders table query failed:', ordersError.message);
        }
        
        return res.status(200).json(result);
    } catch (err) {
        console.error('❌ Erreur getOrders:', err.message);
        // Even in case of catastrophic failure, return an empty array with a warning to avoid crashing the whole dashboard
        return res.status(200).json([]);
    }
};

export const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        // ─── SÉCURITÉ : Validation whitelist des statuts ──────────────────────
        // On refuse tout statut non listé pour éviter les injections de données.
        if (!ALLOWED_ORDER_STATUSES.includes(status)) {
            return res.status(400).json({ 
                error: `Statut invalide. Valeurs autorisées : ${ALLOWED_ORDER_STATUSES.join(', ')}`
            });
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

