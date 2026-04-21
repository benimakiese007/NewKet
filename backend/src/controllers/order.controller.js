import { supabaseAdmin, supabase } from '../config/supabase.js';

// ─── Statuts de commande autorisés ────────────────────────────────────────────
// Whitelist stricte : seuls ces statuts peuvent être écrits en base via l'API.
// N'importe quel autre valeur sera rejetée avec un 400.
// CONVENTION : Tous les statuts sont en ANGLAIS MAJUSCULES. La traduction
// vers le français se fait exclusivement côté frontend.
const ALLOWED_ORDER_STATUSES = [
    'PENDING',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'COMPLETED',
    'REFUNDED',
    'PAID_HELD',
    'RELEASED',
    'DISPUTED',
    'FROZEN'
];

// ─── Nombre max de tentatives OTP avant blocage ──────────────────────────────
const MAX_OTP_ATTEMPTS = 5;

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

        // ─── Récupérer le statut actuel pour l'historique ─────────────────────
        const { data: currentOrder, error: fetchError } = await client
            .from('orders')
            .select('id, status')
            .eq('id', id)
            .single();

        if (fetchError || !currentOrder) {
            return res.status(404).json({ error: 'Commande introuvable' });
        }

        const previousStatus = currentOrder.status;

        const { data, error } = await client
            .from('orders')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select();

        if (error) throw error;

        // ─── GESTION DU RETOUR EN STOCK ───────────────────────────────────────
        if ((status === 'CANCELLED' || status === 'REFUNDED') && 
            (previousStatus !== 'CANCELLED' && previousStatus !== 'REFUNDED')) {
            const { data: orderDetails } = await client.from('orders').select('items').eq('id', id).single();
            if (orderDetails && orderDetails.items && Array.isArray(orderDetails.items)) {
                for (const item of orderDetails.items) {
                    if (item.product_id) {
                        try {
                            const { data: p } = await client.from('products').select('stock').eq('id', item.product_id).single();
                            if (p && p.stock !== undefined) {
                                await client.from('products').update({ stock: p.stock + (item.quantity || 1) }).eq('id', item.product_id);
                                console.log(`[Order] Stock restauré pour le produit ${item.product_id} (+${item.quantity || 1})`);
                            }
                        } catch(e) {
                            console.error('[Order] Erreur de restauration de stock:', e.message);
                        }
                    }
                }
            }
        }

        // ─── LOG : Historique du changement de statut ─────────────────────────
        // Fire-and-forget pour ne pas bloquer la réponse
        client
            .from('order_status_history')
            .insert({
                order_id: id,
                previous_status: previousStatus,
                new_status: status,
                changed_by: req.user?.id || 'system',
                changed_at: new Date().toISOString()
            })
            .then(({ error: histError }) => {
                if (histError) {
                    // Table may not exist yet — log but don't crash
                    console.warn('[OrderHistory] Could not log status change (table may not exist):', histError.message);
                }
            });

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
            .select('id, status, otp_code, otp_attempts')
            .eq('id', id)
            .single();

        if (fetchError || !order) {
            return res.status(404).json({ error: 'Commande introuvable' });
        }

        if (order.status !== 'PAID_HELD') {
            return res.status(400).json({ error: "La commande n'est pas en attente de livraison (PAID_HELD)" });
        }

        // ─── SÉCURITÉ : Compteur de tentatives OTP ───────────────────────────
        // Empêche le bruteforce même si le rate limiter IP est contourné.
        const currentAttempts = order.otp_attempts || 0;

        if (currentAttempts >= MAX_OTP_ATTEMPTS) {
            return res.status(429).json({
                error: 'Nombre maximum de tentatives atteint. Contactez le support pour débloquer cette commande.'
            });
        }

        if (order.otp_code !== otp) {
            // Incrémenter le compteur de tentatives (fire-and-forget)
            await client
                .from('orders')
                .update({ otp_attempts: currentAttempts + 1 })
                .eq('id', id);

            const remaining = MAX_OTP_ATTEMPTS - currentAttempts - 1;
            return res.status(400).json({
                error: `Code OTP invalide. ${remaining} tentative(s) restante(s).`
            });
        }

        // OTP correct — Mettre à jour le statut
        const { data: updatedOrder, error: updateError } = await client
            .from('orders')
            .update({
                status: 'DELIVERED',
                delivered_at: new Date().toISOString(),
                otp_attempts: 0 // Reset le compteur après succès
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
            .select('id, status, vendor_id, total_amount, transaction_id, delivered_at')
            .eq('id', id)
            .single();

        if (fetchError || !order) {
            return res.status(404).json({ error: 'Commande introuvable' });
        }

        if (order.status !== 'DELIVERED') {
            return res.status(400).json({ error: 'Les fonds ne peuvent être libérés que pour une commande livrée (DELIVERED)' });
        }

        // ─── SÉCURITÉ : Délai de rétractation de 72h ──────────────────────────
        // L'argent reste sous séquestre au moins 72h après la livraison
        // pour permettre au client d'ouvrir un litige si le produit est défectueux.
        if (order.delivered_at) {
            const deliveredDate = new Date(order.delivered_at);
            const now = new Date();
            const diffHours = (now - deliveredDate) / (1000 * 60 * 60);

            // On autorise un passage en force seulement si un paramètre d'override est fourni 
            // (ex: forcé par l'admin suite à résolution de litige)
            if (diffHours < 72 && !req.body.force_release) {
                return res.status(400).json({ 
                    error: `Les fonds sont bloqués sous séquestre. Ils ne peuvent être libérés que 72h après la livraison (restent ${Math.ceil(72 - diffHours)}h).` 
                });
            }
        }

        // ─── TRANSFERT FLUTTERWAVE (si configuré) ────────────────────────────
        // Tente d'initier un transfert réel vers le compte/wallet du vendeur.
        // Si les clés Flutterwave ne sont pas configurées ou si le transfert échoue,
        // on log l'erreur mais on met quand même le statut à RELEASED pour que
        // l'admin puisse traiter manuellement.
        let transferResult = null;

        if (process.env.FLW_SECRET_KEY) {
            try {
                // Récupérer les infos bancaires/wallet du vendeur
                const { data: vendor } = await client
                    .from('users')
                    .select('id, email, name, bank_code, account_number, mobile_money_number')
                    .eq('id', order.vendor_id)
                    .single();

                if (vendor && (vendor.account_number || vendor.mobile_money_number)) {
                    const transferPayload = {
                        account_bank: vendor.bank_code || 'MPS', // Mobile Money par défaut
                        account_number: vendor.account_number || vendor.mobile_money_number,
                        amount: order.total_amount,
                        currency: 'CDF',
                        narration: `NewKet Paiement - Commande ${order.transaction_id}`,
                        reference: `NK_RELEASE_${order.id}_${Date.now()}`,
                        beneficiary_name: vendor.name || 'Vendeur NewKet'
                    };

                    const flwResponse = await fetch('https://api.flutterwave.com/v3/transfers', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${process.env.FLW_SECRET_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(transferPayload)
                    });

                    transferResult = await flwResponse.json();
                    console.log(`[Escrow] Transfert Flutterwave initié pour commande ${id}:`, transferResult.status);
                } else {
                    console.warn(`[Escrow] Vendeur ${order.vendor_id} n'a pas de coordonnées bancaires configurées. Transfert manuel requis.`);
                }
            } catch (transferErr) {
                console.error(`[Escrow] Erreur transfert Flutterwave pour commande ${id}:`, transferErr.message);
                // On continue quand même pour mettre à jour le statut
            }
        } else {
            console.warn('[Escrow] FLW_SECRET_KEY non configurée — transfert automatique désactivé.');
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

        console.log(`[Escrow] ✅ Fonds libérés pour la commande ${id} au vendeur ${order.vendor_id}`);

        return res.status(200).json({
            success: true,
            message: 'Fonds libérés avec succès',
            order: updatedOrder,
            transfer: transferResult ? {
                status: transferResult.status,
                message: transferResult.message
            } : { status: 'manual', message: 'Transfert automatique non disponible — traitement manuel requis.' }
        });
    } catch (err) {
        console.error('❌ Erreur releaseEscrow:', err.message);
        return res.status(500).json({ error: 'Failed to release escrow' });
    }
};
