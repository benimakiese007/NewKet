import { supabaseAdmin } from '../config/supabase.js';
import EmailService from '../services/emailService.js';
import {
    ORDER_STATUSES,
    ESCROW_EVENT_TYPES,
    ESCROW_STATUSES,
    createEscrowEvent,
    getOrderCustomerId,
    getOrderVendorId,
    logOrderStatusHistory,
    releaseOrderEscrow,
    mapLegacyOrderStatus
} from '../services/order-workflow.js';

export const createDispute = async (req, res) => {
    try {
        const { order_id, reason_category, description, proof_urls } = req.body;
        const customerId = req.user.id;

        if (!order_id || !reason_category || !description) {
            return res.status(400).json({ success: false, message: 'Veuillez fournir order_id, reason_category et description.' });
        }

        if (!Array.isArray(proof_urls) || proof_urls.length === 0) {
            return res.status(400).json({ success: false, message: 'Vous devez fournir au moins une preuve.' });
        }

        const validUrls = proof_urls.filter((url) => typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://')));
        if (validUrls.length === 0) {
            return res.status(400).json({ success: false, message: 'Les preuves doivent être des URLs http(s) valides.' });
        }

        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select('*')
            .eq('id', order_id)
            .single();

        if (orderError || !order || getOrderCustomerId(order) !== customerId) {
            return res.status(404).json({ success: false, message: 'Commande introuvable ou accès refusé.' });
        }

        const allowedStatuses = [ORDER_STATUSES.PAID_HELD, ORDER_STATUSES.IN_DELIVERY, ORDER_STATUSES.DELIVERED];
        const normalizedStatus = mapLegacyOrderStatus(order.status);
        if (!allowedStatuses.includes(normalizedStatus)) {
            return res.status(400).json({ success: false, message: `Vous ne pouvez pas ouvrir de litige depuis le statut ${normalizedStatus}.` });
        }

        const { data: dispute, error: disputeError } = await supabaseAdmin
            .from('disputes')
            .insert({
                order_id: order.id,
                customer_id: customerId,
                vendor_id: getOrderVendorId(order),
                reason_category,
                description,
                proof_urls: validUrls,
                status: 'OPEN',
                order_status_snapshot: normalizedStatus,
                escrow_frozen_at: new Date().toISOString()
            })
            .select()
            .single();

        if (disputeError) {
            console.error('Dispute creation failed:', disputeError);
            return res.status(500).json({ success: false, message: 'Erreur lors de la création du litige.' });
        }

        // Litige ouvert -> état de commande dédié, et escrow gelé (statut d'escrow séparé)
        await supabaseAdmin
            .from('orders')
            .update({
                status: ORDER_STATUSES.DISPUTE_OPEN,
                escrow_status: ESCROW_STATUSES.FROZEN,
                updated_at: new Date().toISOString()
            })
            .eq('id', order.id);

        await createEscrowEvent(supabaseAdmin, {
            orderId: order.id,
            eventType: ESCROW_EVENT_TYPES.FROZEN,
            amount: order.total_amount,
            metadata: { dispute_id: dispute.id, reason_category },
            processedAt: new Date().toISOString()
        });

        await logOrderStatusHistory(supabaseAdmin, {
            orderId: order.id,
            previousStatus: normalizedStatus,
            newStatus: ORDER_STATUSES.DISPUTE_OPEN,
            changedBy: req.user.id,
            notes: 'Dispute opened'
        });

        const adminEmail = process.env.ADMIN_EMAIL || process.env.GMAIL_USER;
        if (adminEmail) {
            try {
                const { data: customer } = await supabaseAdmin.from('users').select('name').eq('id', customerId).single();
                await EmailService.sendDisputeOpenedAlert({
                    adminEmail,
                    orderId: order.id,
                    customerName: customer?.name || 'Un client',
                    reason: reason_category
                });
            } catch (emailError) {
                console.error('Dispute email alert failed:', emailError.message);
            }
        }

        return res.status(201).json({
            success: true,
            message: 'Litige ouvert avec succès. La commande a été gelée.',
            data: dispute
        });
    } catch (error) {
        console.error('createDispute error:', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

export const getDisputes = async (req, res) => {
    try {
        const userRole = req.user.role;
        const userId = req.user.id;

        let query = supabaseAdmin
            .from('disputes')
            .select(`
                *,
                orders!inner (
                    id,
                    total,
                    total_amount,
                    status
                )
            `)
            .order('created_at', { ascending: false });

        if (userRole !== 'admin') {
            query = query.or(`customer_id.eq.${userId},vendor_id.eq.${userId}`);
        }

        const { data, error } = await query;
        if (error) {
            console.error('getDisputes error:', error);
            return res.status(500).json({ success: false, message: 'Erreur lors de la récupération des litiges.' });
        }

        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('getDisputes error:', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

export const updateDispute = async (req, res) => {
    try {
        const { id } = req.params;
        const { description_update, new_proof_urls } = req.body;
        const userId = req.user.id;

        const { data: dispute, error: fetchError } = await supabaseAdmin
            .from('disputes')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !dispute) {
            return res.status(404).json({ success: false, message: 'Litige introuvable.' });
        }

        if (dispute.customer_id !== userId && dispute.vendor_id !== userId) {
            return res.status(403).json({ success: false, message: 'Accès non autorisé.' });
        }

        if (dispute.status === 'RESOLVED') {
            return res.status(400).json({ success: false, message: 'Ce litige est déjà résolu.' });
        }

        const extraProofs = Array.isArray(new_proof_urls) ? new_proof_urls.filter((url) => typeof url === 'string') : [];
        const updatedProofs = [...(dispute.proof_urls || []), ...extraProofs];
        const updatedDescription = description_update
            ? `${dispute.description}\n\nMAJ: ${description_update}`
            : dispute.description;

        const { data: updatedDispute, error } = await supabaseAdmin
            .from('disputes')
            .update({
                description: updatedDescription,
                proof_urls: updatedProofs
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour.' });
        }

        return res.status(200).json({ success: true, data: updatedDispute });
    } catch (error) {
        console.error('updateDispute error:', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

export const resolveDispute = async (req, res) => {
    try {
        const { id } = req.params;
        const { resolution_decision, refund_amount, action_for_order } = req.body;

        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Réservé aux administrateurs.' });
        }

        const allowedActions = [ORDER_STATUSES.REFUNDED, ORDER_STATUSES.COMPLETED, ORDER_STATUSES.CANCELLED, 'PARTIAL_REFUND'];
        if (action_for_order && !allowedActions.includes(action_for_order)) {
            return res.status(400).json({ success: false, message: `Action invalide. Valeurs autorisées : ${allowedActions.join(', ')}` });
        }

        const { data: dispute, error: disputeError } = await supabaseAdmin
            .from('disputes')
            .update({
                status: 'RESOLVED',
                resolution_decision,
                refund_amount: refund_amount || 0
            })
            .eq('id', id)
            .select()
            .single();

        if (disputeError || !dispute) {
            return res.status(500).json({ success: false, message: 'Erreur lors de la résolution du litige.' });
        }

        const { data: order } = await supabaseAdmin
            .from('orders')
            .select('*')
            .eq('id', dispute.order_id)
            .single();

        if (!order) {
            return res.status(404).json({ success: false, message: 'Commande liée introuvable.' });
        }

        const previousStatus = mapLegacyOrderStatus(order.status);

        if (action_for_order === ORDER_STATUSES.COMPLETED) {
            await releaseOrderEscrow({
                client: supabaseAdmin,
                order,
                initiatedBy: req.user.id,
                autoRelease: false,
                force: true
            });
        } else if (action_for_order === ORDER_STATUSES.CANCELLED || action_for_order === ORDER_STATUSES.REFUNDED) {
            await supabaseAdmin
                .from('orders')
                .update({
                    status: action_for_order,
                    escrow_status: action_for_order === ORDER_STATUSES.REFUNDED ? ESCROW_STATUSES.REFUNDED : order.escrow_status,
                    updated_at: new Date().toISOString()
                })
                .eq('id', dispute.order_id);

            if (action_for_order === ORDER_STATUSES.REFUNDED) {
                await createEscrowEvent(supabaseAdmin, {
                    orderId: dispute.order_id,
                    eventType: ESCROW_EVENT_TYPES.REFUNDED,
                    amount: order.total_amount,
                    metadata: { dispute_id: dispute.id, refund_amount: refund_amount || order.total_amount },
                    processedAt: new Date().toISOString()
                });
            }
        }

        if (action_for_order && action_for_order !== 'PARTIAL_REFUND') {
            await logOrderStatusHistory(supabaseAdmin, {
                orderId: dispute.order_id,
                previousStatus,
                newStatus: action_for_order,
                changedBy: req.user.id,
                notes: 'Dispute resolved'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Litige résolu avec succès.',
            data: dispute
        });
    } catch (error) {
        console.error('resolveDispute error:', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

export const addDisputeMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body;
        const userId = req.user.id;
        const role = req.user.role;

        if (!message || message.trim() === '') {
            return res.status(400).json({ success: false, message: 'Message vide.' });
        }

        const { data: dispute, error: fetchError } = await supabaseAdmin.from('disputes').select('*').eq('id', id).single();
        if (fetchError || !dispute) {
            return res.status(404).json({ success: false, message: 'Litige introuvable.' });
        }

        if (role !== 'admin' && dispute.customer_id !== userId && dispute.vendor_id !== userId) {
            return res.status(403).json({ success: false, message: 'Accès non autorisé à ce litige.' });
        }

        const { data, error } = await supabaseAdmin
            .from('dispute_messages')
            .insert({
                dispute_id: id,
                sender_id: userId,
                sender_role: role,
                message: message.trim()
            })
            .select()
            .single();

        if (error) throw error;
        return res.status(201).json({ success: true, data });
    } catch (error) {
        console.error('addDisputeMessage error:', error);
        return res.status(500).json({ success: false, message: 'Erreur lors de l\'envoi du message.' });
    }
};

export const getDisputeMessages = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const role = req.user.role;

        const { data: dispute, error: fetchError } = await supabaseAdmin.from('disputes').select('*').eq('id', id).single();
        if (fetchError || !dispute) {
            return res.status(404).json({ success: false, message: 'Litige introuvable.' });
        }

        if (role !== 'admin' && dispute.customer_id !== userId && dispute.vendor_id !== userId) {
            return res.status(403).json({ success: false, message: 'Accès non autorisé.' });
        }

        const { data, error } = await supabaseAdmin
            .from('dispute_messages')
            .select('*, users (name, avatar_url)')
            .eq('dispute_id', id)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return res.status(200).json({ success: true, data: data || [] });
    } catch (error) {
        console.error('getDisputeMessages error:', error);
        return res.status(500).json({ success: false, message: 'Erreur lors de la récupération des messages.' });
    }
};

export const vendorResolveAmiable = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const { data: dispute, error: fetchError } = await supabaseAdmin.from('disputes').select('*').eq('id', id).single();
        if (fetchError || !dispute) {
            return res.status(404).json({ success: false, message: 'Litige introuvable.' });
        }

        if (dispute.vendor_id !== userId) {
            return res.status(403).json({ success: false, message: 'Action réservée au vendeur de cette commande.' });
        }

        if (dispute.status === 'RESOLVED') {
            return res.status(400).json({ success: false, message: 'Litige déjà résolu.' });
        }

        await supabaseAdmin
            .from('disputes')
            .update({
                status: 'RESOLVED',
                resolution_decision: 'Auto-résolution vendeur'
            })
            .eq('id', id);

        await supabaseAdmin
            .from('orders')
            .update({
                status: ORDER_STATUSES.REFUNDED,
                escrow_status: ESCROW_STATUSES.REFUNDED,
                updated_at: new Date().toISOString()
            })
            .eq('id', dispute.order_id);

        await createEscrowEvent(supabaseAdmin, {
            orderId: dispute.order_id,
            eventType: ESCROW_EVENT_TYPES.REFUNDED,
            metadata: { dispute_id: id, by: 'vendor' },
            processedAt: new Date().toISOString()
        });

        await logOrderStatusHistory(supabaseAdmin, {
            orderId: dispute.order_id,
            previousStatus: ORDER_STATUSES.DISPUTE_OPEN,
            newStatus: ORDER_STATUSES.REFUNDED,
            changedBy: userId,
            notes: 'Vendor amicable resolution'
        });

        return res.status(200).json({
            success: true,
            message: 'Vous avez accepté le litige et remboursé le client.'
        });
    } catch (error) {
        console.error('vendorResolveAmiable error:', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};
