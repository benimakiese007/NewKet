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
    'PAID_HELD',
    'RELEASED',
    'DISPUTED',
    'FROZEN'
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

export const verifyDelivery = async (req, res) => {
    try {
        const { id } = req.params;
        const { otp } = req.body;

        if (!otp) {
            return res.status(400).json({ error: 'Le code OTP est requis' });
        }

        const client = supabaseAdmin || supabase;

        // Récupérer la commande
        const { data: order, error: fetchError } = await client
            .from('orders')
            .select('id, status, otp_code')
            .eq('id', id)
            .single();

        if (fetchError || !order) {
            return res.status(404).json({ error: 'Commande introuvable' });
        }

        if (order.status !== 'PAID_HELD') {
            return res.status(400).json({ error: "La commande n'est pas en attente de livraison (PAID_HELD)" });
        }

        if (order.otp_code !== otp) {
            return res.status(400).json({ error: 'Code OTP invalide' });
        }

        // Mettre à jour le statut
        const { data: updatedOrder, error: updateError } = await client
            .from('orders')
            .update({
                status: 'DELIVERED',
                delivered_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        return res.status(200).json({ success: true, message: 'Livraison validée avec succès', order: updatedOrder });
    } catch (err) {
        console.error('❌ Erreur verifyDelivery:', err.message);
        return res.status(500).json({ error: 'Failed to verify delivery' });
    }
};

export const releaseEscrow = async (req, res) => {
    try {
        const { id } = req.params;
        const client = supabaseAdmin || supabase;

        // Récupérer la commande
        const { data: order, error: fetchError } = await client
            .from('orders')
            .select('id, status, vendor_id, total_amount')
            .eq('id', id)
            .single();

        if (fetchError || !order) {
            return res.status(404).json({ error: 'Commande introuvable' });
        }

        if (order.status !== 'DELIVERED') {
            return res.status(400).json({ error: 'Les fonds ne peuvent être libérés que pour une commande livrée (DELIVERED)' });
        }

        // Mettre à jour le statut et la date de libération
        const { data: updatedOrder, error: updateError } = await client
            .from('orders')
            .update({
                status: 'RELEASED',
                released_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        // Ici, il faudrait idéalement déclencher un transfert vers le wallet du vendeur (ex: flutterwave transfers)
        console.log(`[Escrow] Fonds libérés pour la commande ${id} au vendeur ${order.vendor_id}`);

        return res.status(200).json({ success: true, message: 'Fonds libérés avec succès', order: updatedOrder });
    } catch (err) {
        console.error('❌ Erreur releaseEscrow:', err.message);
        return res.status(500).json({ error: 'Failed to release escrow' });
    }
};

