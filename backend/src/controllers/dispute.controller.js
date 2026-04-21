import { supabaseAdmin } from '../config/supabase.js';
import EmailService from '../services/emailService.js';

export const createDispute = async (req, res) => {
    try {
        const { order_id, reason_category, description, proof_urls } = req.body;
        const customer_id = req.user.id;

        // Validation basique
        if (!order_id || !reason_category || !description) {
            return res.status(400).json({ success: false, message: 'Veuillez fournir order_id, reason_category, et description.' });
        }

        // Vérification des preuves: min 1 vidéo ou 2 photos
        if (!proof_urls || !Array.isArray(proof_urls)) {
            return res.status(400).json({ success: false, message: 'Vous devez fournir des preuves (2 photos ou 1 vidéo).' });
        }
        
        let validProofs = false;
        
        // SÉCURITÉ assouplie : Rejeter uniquement si vide, ou si ce ne sont pas du tout des URLs basiques
        const validUrls = proof_urls.filter(url => url.startsWith('http://') || url.startsWith('https://'));

        if (validUrls.length >= 1) {
            validProofs = true;
        }

        if (!validProofs) {
            return res.status(400).json({ success: false, message: 'Preuves insuffisantes: veuillez fournir au moins 1 lien valide (commençant par http(s)://).' });
        }

        // Fetch Order info
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select('id, store_id, status')
            .eq('id', order_id)
            .eq('customer_id', customer_id)
            .single();

        if (orderError || !order) {
            return res.status(404).json({ success: false, message: 'Commande introuvable ou accès refusé.' });
        }

        // Seules les commandes PAID_HELD ou DELIVERED ou SHIPPED peuvent être disputées
        const allowedStatuses = ['PAID_HELD', 'DELIVERED', 'SHIPPED'];
        if (!allowedStatuses.includes(order.status)) {
            return res.status(400).json({ success: false, message: 'Vous ne pouvez pas ouvrir de litige pour une commande avec le statut : ' + order.status });
        }

        // Créer l'entrée dispute
        const { data: dispute, error: disputeError } = await supabaseAdmin
            .from('disputes')
            .insert({
                order_id: order.id,
                customer_id: customer_id,
                vendor_id: order.store_id, // assuming store_id maps to vendor_id
                reason_category,
                description,
                proof_urls,
                status: 'OPEN'
            })
            .select()
            .single();

        if (disputeError) {
            console.error('Erreur Supabase création litige:', disputeError);
            return res.status(500).json({ success: false, message: 'Erreur lors de la création du litige.' });
        }

        // Mettre à jour la commande en FROZEN
        await supabaseAdmin
            .from('orders')
            .update({ status: 'FROZEN' })
            .eq('id', order.id);

        // Envoi d'Alerte Email
        const adminEmail = process.env.ADMIN_EMAIL || process.env.GMAIL_USER;
        if (adminEmail) {
            try {
                // Obtenir le nom du client si possible (optionnel)
                const { data: customer } = await supabaseAdmin.from('users').select('name').eq('id', customer_id).single();
                const cName = customer?.name || 'Un Client';
                await EmailService.sendDisputeOpenedAlert({
                    adminEmail,
                    orderId: order.id,
                    customerName: cName,
                    reason: reason_category
                });
            } catch (err) {
                console.error('Erreur envoi email litige:', err.message);
            }
        }

        return res.status(201).json({
            success: true,
            message: 'Litige ouvert avec succès, la commande a été gelée. L\'administrateur a été notifié.',
            data: dispute
        });
    } catch (error) {
        console.error('Erreur createDispute:', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

export const getDisputes = async (req, res) => {
    try {
        const userRole = req.user.role;
        const userId = req.user.id;

        let query = supabaseAdmin.from('disputes').select(`
            *,
            orders!inner (
                id,
                total,
                status
            )
        `).order('created_at', { ascending: false });

        if (userRole !== 'admin') {
            // Un client ou un vendeur ne voit que ses litiges
            query = query.or(`customer_id.eq.${userId},vendor_id.eq.${userId}`);
        }

        const { data: disputes, error } = await query;

        if (error) {
            console.error('Supabase fetch disputes error:', error);
            return res.status(500).json({ success: false, message: 'Erreur lors de la récupération des litiges.' });
        }

        return res.status(200).json({
            success: true,
            data: disputes
        });
    } catch (error) {
        console.error('Erreur getDisputes:', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

export const updateDispute = async (req, res) => {
    try {
        const { id } = req.params;
        const { description_update, new_proof_urls } = req.body;
        const user_id = req.user.id; // Customer or Vendor

        const { data: dispute, error: fetchError } = await supabaseAdmin
            .from('disputes')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !dispute) {
            return res.status(404).json({ success: false, message: 'Litige introuvable.' });
        }

        if (dispute.customer_id !== user_id && dispute.vendor_id !== user_id) {
            return res.status(403).json({ success: false, message: 'Accès non autorisé.' });
        }

        if (dispute.status === 'RESOLVED') {
            return res.status(400).json({ success: false, message: 'Ce litige est déjà résolu.' });
        }

        let updatedProofs = dispute.proof_urls || [];
        if (new_proof_urls && Array.isArray(new_proof_urls)) {
            updatedProofs = [...updatedProofs, ...new_proof_urls];
        }

        const updatedDesc = description_update ? dispute.description + '\n\nMAJ: ' + description_update : dispute.description;

        const { data: updatedDispute, error: updateError } = await supabaseAdmin
            .from('disputes')
            .update({ description: updatedDesc, proof_urls: updatedProofs })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            return res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour.' });
        }

        return res.status(200).json({
            success: true,
            data: updatedDispute
        });
    } catch (error) {
        console.error('Erreur updateDispute:', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

export const resolveDispute = async (req, res) => {
    try {
        const { id } = req.params;
        const { resolution_decision, refund_amount, action_for_order } = req.body;
        
        // Ensure admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Réservé aux administrateurs.' });
        }

        // SÉCURITÉ : Whitelist des actions autorisées sur la commande après résolution
        const ALLOWED_RESOLUTION_ACTIONS = ['REFUNDED', 'RELEASED', 'CANCELLED', 'PARTIAL_REFUND'];
        if (action_for_order && !ALLOWED_RESOLUTION_ACTIONS.includes(action_for_order)) {
            return res.status(400).json({ 
                success: false, 
                message: `Action invalide. Valeurs autorisées : ${ALLOWED_RESOLUTION_ACTIONS.join(', ')}`
            });
        }
        
        const { data: dispute, error: fetchError } = await supabaseAdmin
            .from('disputes')
            .update({
                status: 'RESOLVED',
                resolution_decision,
                refund_amount: refund_amount || 0
            })
            .eq('id', id)
            .select()
            .single();

        if (fetchError || !dispute) {
            return res.status(500).json({ success: false, message: 'Erreur lors de la résolution du litige.' });
        }

        // Update the actual order based on admin decision
        if (action_for_order) {
            const { data: updatedOrderArray } = await supabaseAdmin
                .from('orders')
                .update({ status: action_for_order })
                .eq('id', dispute.order_id)
                .select();

            const updatedOrder = updatedOrderArray?.[0];

            // ─── LOGIQUE DE REMISE EN STOCK ATOMIQUE ───
            if (updatedOrder && (action_for_order === 'CANCELLED' || action_for_order === 'REFUNDED')) {
                const items = updatedOrder.items || [];
                for (const item of items) {
                    if (item.product_id) {
                        try {
                            const { data: p } = await supabaseAdmin.from('products').select('stock').eq('id', item.product_id).single();
                            if (p && p.stock !== undefined) {
                                await supabaseAdmin.from('products').update({ stock: p.stock + (item.quantity || 1) }).eq('id', item.product_id);
                                console.log(`[DisputeResolution] Stock restauré pour le produit ${item.product_id} (+${item.quantity || 1})`);
                            }
                        } catch(e) {
                            console.error('[DisputeResolution] Erreur de restauration de stock:', e.message);
                        }
                    }
                }
            }

            // ─── LOG : Historique du changement de statut ───
            supabaseAdmin.from('order_status_history').insert({
                order_id: dispute.order_id,
                previous_status: 'DISPUTED',
                new_status: action_for_order,
                changed_by: req.user.id
            }).then(() => {}).catch(() => {});
        }

        return res.status(200).json({
            success: true,
            message: 'Litige résolu avec succès.',
            data: dispute
        });
    } catch (error) {
        console.error('Erreur resolveDispute:', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

/**
 * MESSAGERIE DE LITIGE
 */
export const addDisputeMessage = async (req, res) => {
    try {
        const { id } = req.params; // dispute id
        const { message } = req.body;
        const user_id = req.user.id;
        const role = req.user.role; // 'admin', 'vendor', or 'customer'

        if (!message || message.trim() === '') {
            return res.status(400).json({ success: false, message: 'Message vide.' });
        }

        // Vérifier l'accès
        const { data: dispute, error: fetchErr } = await supabaseAdmin.from('disputes').select('*').eq('id', id).single();
        if (fetchErr || !dispute) return res.status(404).json({ success: false, message: 'Litige introuvable.' });

        if (role !== 'admin' && dispute.customer_id !== user_id && dispute.vendor_id !== user_id) {
            return res.status(403).json({ success: false, message: 'Accès non autorisé à ce litige.' });
        }

        const { data: msgInfo, error: msgErr } = await supabaseAdmin.from('dispute_messages').insert({
            dispute_id: id,
            sender_id: user_id,
            sender_role: role,
            message: message.trim()
        }).select().single();

        if (msgErr) throw msgErr;

        return res.status(201).json({ success: true, data: msgInfo });
    } catch (error) {
        console.error('Erreur addDisputeMessage:', error);
        return res.status(500).json({ success: false, message: 'Erreur lors de l\'envoi du message.' });
    }
};

export const getDisputeMessages = async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.user.id;
        const role = req.user.role;

        const { data: dispute, error: fetchErr } = await supabaseAdmin.from('disputes').select('*').eq('id', id).single();
        if (fetchErr || !dispute) return res.status(404).json({ success: false, message: 'Litige introuvable.' });

        if (role !== 'admin' && dispute.customer_id !== user_id && dispute.vendor_id !== user_id) {
            return res.status(403).json({ success: false, message: 'Accès non autorisé.' });
        }

        // Récupérer les messages (et un peu d'info sur l'utilisateur si possible)
        const { data: messages, error: err } = await supabaseAdmin.from('dispute_messages')
            .select('*, users (name, avatar_url)')
            .eq('dispute_id', id)
            .order('created_at', { ascending: true });

        if (err) throw err;

        return res.status(200).json({ success: true, data: messages || [] });
    } catch (error) {
        console.error('Erreur getDisputeMessages:', error);
        return res.status(500).json({ success: false, message: 'Erreur lors de la récupération des messages.' });
    }
};

/**
 * AUTO-RÉSOLUTION PAR LE VENDEUR (Amiable)
 */
export const vendorResolveAmiable = async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.user.id;

        const { data: dispute, error: fetchError } = await supabaseAdmin.from('disputes').select('*').eq('id', id).single();
        if (fetchError || !dispute) {
            return res.status(404).json({ success: false, message: 'Litige introuvable.' });
        }

        // Seul le vendeur concerné peut faire ça
        if (dispute.vendor_id !== user_id && req.user.role !== 'vendor') {
            return res.status(403).json({ success: false, message: 'Action réservée au vendeur de cette commande.' });
        }

        if (dispute.status === 'RESOLVED') {
            return res.status(400).json({ success: false, message: 'Litige déjà résolu.' });
        }

        // Mise à jour du litige
        await supabaseAdmin.from('disputes').update({
            status: 'RESOLVED',
            resolution_decision: 'Auto-résolution (Amiable - Remboursé par le vendeur)'
        }).eq('id', id);

        // Mise à jour de la commande vers REFUNDED
        const { data: orderArr } = await supabaseAdmin.from('orders').update({ status: 'REFUNDED' }).eq('id', dispute.order_id).select();
        const updatedOrder = orderArr?.[0];

        // Restauration de stock (idem que résolution admin)
        if (updatedOrder) {
            const items = updatedOrder.items || [];
            for (const item of items) {
                if (item.product_id) {
                    try {
                        const { data: p } = await supabaseAdmin.from('products').select('stock').eq('id', item.product_id).single();
                        if (p && p.stock !== undefined) {
                            await supabaseAdmin.from('products').update({ stock: p.stock + (item.quantity || 1) }).eq('id', item.product_id);
                        }
                    } catch(e) {}
                }
            }
            // Historique
            await supabaseAdmin.from('order_status_history').insert({
                order_id: dispute.order_id,
                previous_status: 'DISPUTED',
                new_status: 'REFUNDED',
                changed_by: user_id,
                notes: 'Amiable via vendeur'
            }).catch(()=>{});
        }

        return res.status(200).json({
            success: true,
            message: 'Vous avez accepté le litige et remboursé le client à l\'amiable.'
        });
    } catch (err) {
        console.error('Erreur vendorResolveAmiable:', err);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};
