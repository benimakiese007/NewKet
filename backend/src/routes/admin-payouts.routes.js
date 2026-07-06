import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireAdmin } from '../middlewares/auth.js';

const router = express.Router();

// Toutes les routes de ce fichier sont réservées aux admins
router.use(requireAdmin);

/**
 * GET /api/admin/payouts
 * Liste toutes les commandes dont le payout est en attente (PENDING) ou en échec (FAILED)
 */
router.get('/', async (req, res) => {
    try {
        const { status = 'PENDING' } = req.query;

        // On récupère les commandes avec payout_status PENDING ou FAILED
        const { data: orders, error } = await supabaseAdmin
            .from('orders')
            .select(`
                id,
                created_at,
                completed_at,
                total_amount,
                platform_commission_amount,
                payout_amount,
                payout_status,
                payout_last_error,
                payout_attempts,
                escrow_status,
                vendor_id
            `)
            .in('payout_status', status === 'ALL' ? ['PENDING', 'FAILED', 'SUCCESS'] : [status])
            .order('completed_at', { ascending: false });

        if (error) throw error;

        // Pour chaque commande, récupérer les infos du vendeur et sa méthode de payout
        const enrichedOrders = await Promise.all((orders || []).map(async (order) => {
            // Infos du vendeur
            const { data: vendor } = await supabaseAdmin
                .from('users')
                .select('id, name, email, phone, preferred_payout_method')
                .eq('id', order.vendor_id)
                .single();

            // Méthode de payout par défaut
            const { data: methods } = await supabaseAdmin
                .from('vendor_payout_methods')
                .select('*')
                .eq('vendor_id', order.vendor_id)
                .eq('is_default', true)
                .limit(1);

            return {
                ...order,
                vendor: vendor || null,
                payout_method: methods?.[0] || null
            };
        }));


        // Calcul des totaux
        const pending = enrichedOrders.filter(o => o.payout_status === 'PENDING');
        const failed = enrichedOrders.filter(o => o.payout_status === 'FAILED');
        const totalPendingAmount = pending.reduce((sum, o) => sum + parseFloat(o.payout_amount || 0), 0);

        res.json({
            success: true,
            data: enrichedOrders,
            stats: {
                pending_count: pending.length,
                failed_count: failed.length,
                total_pending_amount: Math.round(totalPendingAmount * 100) / 100
            }
        });
    } catch (error) {
        console.error('[AdminPayouts] GET / error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/admin/payouts/:orderId/confirm
 * L'admin confirme qu'il a effectué le paiement manuellement
 * Body: { note?: string }
 */
router.post('/:orderId/confirm', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { note = '' } = req.body;
        const adminId = req.user?.id || 'admin';

        // Vérifier que la commande existe et que le payout est bien PENDING ou FAILED
        const { data: order, error: fetchError } = await supabaseAdmin
            .from('orders')
            .select('id, payout_status, payout_amount, vendor_id, total_amount')
            .eq('id', orderId)
            .single();

        if (fetchError || !order) {
            return res.status(404).json({ success: false, message: 'Commande introuvable.' });
        }

        if (!['PENDING', 'FAILED'].includes(order.payout_status)) {
            return res.status(400).json({
                success: false,
                message: `Ce payout ne peut pas être confirmé (statut actuel: ${order.payout_status}).`
            });
        }

        // Mettre à jour le statut du payout à SUCCESS
        const { data: updatedOrder, error: updateError } = await supabaseAdmin
            .from('orders')
            .update({
                payout_status: 'SUCCESS',
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId)
            .select('*')
            .single();

        if (updateError) throw updateError;

        // Enregistrer l'événement dans l'historique escrow
        await supabaseAdmin
            .from('escrow_events')
            .insert({
                order_id: orderId,
                event_type: 'MANUAL_OVERRIDE',
                amount: parseFloat(order.payout_amount || 0),
                metadata: {
                    action: 'MANUAL_PAYOUT_CONFIRMED',
                    confirmed_by: adminId,
                    note: note || 'Paiement manuel confirmé par l\'admin',
                    payout_amount: order.payout_amount
                },
                processed_at: new Date().toISOString()
            });

        res.json({
            success: true,
            message: 'Paiement confirmé avec succès.',
            data: updatedOrder
        });
    } catch (error) {
        console.error('[AdminPayouts] POST /:orderId/confirm error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/admin/payouts/:orderId/retry
 * L'admin marque un payout FAILED comme PENDING pour le réessayer
 */
router.post('/:orderId/retry', async (req, res) => {
    try {
        const { orderId } = req.params;

        const { data: order, error: fetchError } = await supabaseAdmin
            .from('orders')
            .select('id, payout_status')
            .eq('id', orderId)
            .single();

        if (fetchError || !order) {
            return res.status(404).json({ success: false, message: 'Commande introuvable.' });
        }

        if (order.payout_status !== 'FAILED') {
            return res.status(400).json({
                success: false,
                message: 'Seuls les payouts en échec peuvent être relancés.'
            });
        }

        const { error: updateError } = await supabaseAdmin
            .from('orders')
            .update({
                payout_status: 'PENDING',
                payout_last_error: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);

        if (updateError) throw updateError;

        res.json({ success: true, message: 'Payout remis en attente.' });
    } catch (error) {
        console.error('[AdminPayouts] POST /:orderId/retry error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
