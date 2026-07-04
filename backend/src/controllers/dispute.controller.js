import { supabaseAdmin } from '../config/supabase.js';
import EmailService from '../services/emailService.js';
import {
    ORDER_STATUSES,
    ESCROW_EVENT_TYPES,
    ESCROW_STATUSES,
    DISPUTE_STATUSES,
    DISPUTE_REASONS,
    DISPUTE_RESOLUTIONS,
    DISPUTE_MESSAGE_TYPES,
    DISPUTE_VENDOR_ACTIONS,
    DISPUTE_BUYER_ACTIONS,
    DISPUTE_SELLER_RESPONSE_HOURS,
    DISPUTE_BUYER_RESPONSE_HOURS,
    DISPUTE_REVIEW_HOURS,
    ESCROW_HOLD_HOURS,
    addHours,
    createEscrowEvent,
    getOrderCustomerId,
    getOrderVendorId,
    logOrderStatusHistory,
    mapLegacyOrderStatus,
    releaseOrderEscrow
} from '../services/order-workflow.js';

const ABUSE_WINDOW_DAYS = 30;
const MAX_DISPUTES_PER_WINDOW = 5;

function isAdmin(user) {
    return user?.role === 'admin' || user?.app_metadata?.role === 'admin';
}

function hasClientEvidence(dispute) {
    return Array.isArray(dispute?.evidence) && dispute.evidence.length > 0;
}

function approximateEvidenceStrength(dispute) {
    const evidence = Array.isArray(dispute?.evidence) ? dispute.evidence : [];
    const mediaItems = evidence.filter((item) => item?.url);
    const videoCount = mediaItems.filter((item) => item?.kind === 'video').length;
    const photoCount = mediaItems.filter((item) => item?.kind !== 'video').length;
    return (videoCount * 2) + photoCount;
}

async function getOrderOrNull(orderId) {
    const { data } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();
    return data || null;
}

async function getDisputeOrNull(disputeId) {
    const { data } = await supabaseAdmin
        .from('disputes')
        .select('*')
        .eq('id', disputeId)
        .maybeSingle();
    return data || null;
}

async function getActiveDisputeByOrder(orderId) {
    const { data } = await supabaseAdmin
        .from('disputes')
        .select('*')
        .eq('order_id', orderId)
        .in('status', [
            DISPUTE_STATUSES.OPEN,
            DISPUTE_STATUSES.SELLER_PENDING,
            DISPUTE_STATUSES.BUYER_PENDING,
            DISPUTE_STATUSES.UNDER_REVIEW
        ])
        .order('created_at', { ascending: false })
        .limit(1);

    return data?.[0] || null;
}

async function addDisputeEventMessage(disputeId, senderId, type, payload) {
    const { data, error } = await supabaseAdmin
        .from('dispute_messages')
        .insert({
            dispute_id: disputeId,
            sender_id: senderId || null,
            type,
            payload
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function setOrderDisputeState(order, disputeStatus, escrowStatus, changedBy, notes) {
    const nextOrderStatus = disputeStatus === DISPUTE_STATUSES.RESOLVED || disputeStatus === DISPUTE_STATUSES.REJECTED
        ? order.status
        : ORDER_STATUSES.DISPUTE_OPEN;

    await supabaseAdmin
        .from('orders')
        .update({
            status: nextOrderStatus,
            escrow_status: escrowStatus,
            updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

    if (nextOrderStatus !== mapLegacyOrderStatus(order.status)) {
        await logOrderStatusHistory(supabaseAdmin, {
            orderId: order.id,
            previousStatus: mapLegacyOrderStatus(order.status),
            newStatus: nextOrderStatus,
            changedBy,
            notes
        });
    }
}

async function applyDisputeResolution({ dispute, order, resolution, refundAmount = 0, changedBy, source }) {
    const nowIso = new Date().toISOString();

    if (resolution === DISPUTE_RESOLUTIONS.FULL_REFUND) {
        await supabaseAdmin
            .from('orders')
            .update({
                status: ORDER_STATUSES.REFUNDED,
                escrow_status: ESCROW_STATUSES.REFUNDED,
                completed_at: nowIso,
                released_at: nowIso,
                updated_at: nowIso,
                refund_status: 'APPROVED',
                refund_amount: parseFloat(order.total_amount || 0),
                refunded_at: nowIso
            })
            .eq('id', order.id);

        await createEscrowEvent(supabaseAdmin, {
            orderId: order.id,
            eventType: ESCROW_EVENT_TYPES.REFUNDED,
            amount: order.total_amount,
            metadata: {
                dispute_id: dispute.id,
                source,
                refund_amount: order.total_amount
            },
            processedAt: nowIso
        });
    } else if (resolution === DISPUTE_RESOLUTIONS.PARTIAL_REFUND) {
        await supabaseAdmin
            .from('orders')
            .update({
                status: ORDER_STATUSES.COMPLETED,
                escrow_status: ESCROW_STATUSES.RELEASED,
                completed_at: nowIso,
                released_at: nowIso,
                updated_at: nowIso,
                refund_status: 'APPROVED',
                refund_amount: parseFloat(refundAmount || 0),
                refunded_at: nowIso
            })
            .eq('id', order.id);

        await createEscrowEvent(supabaseAdmin, {
            orderId: order.id,
            eventType: ESCROW_EVENT_TYPES.PARTIAL,
            amount: refundAmount,
            metadata: {
                dispute_id: dispute.id,
                source,
                refund_amount: refundAmount,
                seller_amount: Math.max(0, Number(order.total_amount || 0) - Number(refundAmount || 0))
            },
            processedAt: nowIso
        });
    } else if (resolution === DISPUTE_RESOLUTIONS.RELEASE_TO_SELLER) {
        await releaseOrderEscrow({
            client: supabaseAdmin,
            order,
            initiatedBy: changedBy || 'system',
            autoRelease: false,
            force: true
        });
    }

    await logOrderStatusHistory(supabaseAdmin, {
        orderId: order.id,
        previousStatus: ORDER_STATUSES.DISPUTE_OPEN,
        newStatus: ORDER_STATUSES.COMPLETED,
        changedBy,
        notes: `Dispute resolved via ${source}`
    });
}

async function updateDisputeRecord(disputeId, patch) {
    const { data, error } = await supabaseAdmin
        .from('disputes')
        .update({
            ...patch,
            updated_at: new Date().toISOString()
        })
        .eq('id', disputeId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function markUnderReview(dispute, reason, changedBy = 'system') {
    const order = await getOrderOrNull(dispute.order_id);
    if (!order) return dispute;

    const updatedDispute = await updateDisputeRecord(dispute.id, {
        status: DISPUTE_STATUSES.UNDER_REVIEW,
        review_due_at: addHours(new Date(), DISPUTE_REVIEW_HOURS),
        seller_response_due_at: null,
        buyer_response_due_at: null,
        last_actor_role: 'SYSTEM'
    });

    await addDisputeEventMessage(dispute.id, null, DISPUTE_MESSAGE_TYPES.SYSTEM, {
        event: 'UNDER_REVIEW',
        reason
    });

    await setOrderDisputeState(order, DISPUTE_STATUSES.UNDER_REVIEW, ESCROW_STATUSES.FROZEN, changedBy, reason);
    return updatedDispute;
}

async function resolveAndCloseDispute(dispute, order, resolution, refundAmount, changedBy, source, status = DISPUTE_STATUSES.RESOLVED) {
    const nowIso = new Date().toISOString();
    const updatedDispute = await updateDisputeRecord(dispute.id, {
        status,
        resolution,
        refund_amount: refundAmount || 0,
        resolved_at: nowIso,
        seller_response_due_at: null,
        buyer_response_due_at: null,
        review_due_at: null
    });

    await addDisputeEventMessage(dispute.id, changedBy || null, DISPUTE_MESSAGE_TYPES.SYSTEM, {
        event: 'RESOLVED',
        resolution,
        refund_amount: refundAmount || 0,
        source
    });

    await applyDisputeResolution({
        dispute: updatedDispute,
        order,
        resolution,
        refundAmount,
        changedBy,
        source
    });

    return updatedDispute;
}

async function detectDisputeAbuse(customerId) {
    const now = new Date();
    const recentThreshold = addHours(now, -(24 * 7));
    const windowStart = addHours(now, -(24 * ABUSE_WINDOW_DAYS));

    const [recentDisputesResult, priorResolvedResult] = await Promise.all([
        supabaseAdmin
            .from('disputes')
            .select('id', { count: 'exact', head: true })
            .eq('customer_id', customerId)
            .gte('created_at', windowStart),
        supabaseAdmin
            .from('disputes')
            .select('resolution, opened_by')
            .eq('customer_id', customerId)
            .not('resolution', 'is', null)
            .gte('created_at', windowStart)
    ]);

    const recentCount = recentDisputesResult.count || 0;
    const priorResolved = priorResolvedResult.data || [];
    const refundWins = priorResolved.filter((item) =>
        item.resolution === DISPUTE_RESOLUTIONS.FULL_REFUND || item.resolution === DISPUTE_RESOLUTIONS.PARTIAL_REFUND
    ).length;

    const { data: customerProfile } = await supabaseAdmin
        .from('users')
        .select('created_at, date_joined')
        .eq('id', customerId)
        .maybeSingle();

    const accountCreatedAt = customerProfile?.created_at || customerProfile?.date_joined || null;
    const suspiciousAccount = !!accountCreatedAt && new Date(accountCreatedAt) >= new Date(recentThreshold);
    const frequentDisputes = recentCount >= MAX_DISPUTES_PER_WINDOW;

    return {
        directReview: suspiciousAccount && frequentDisputes,
        recentCount,
        refundWins
    };
}

function normalizeEvidence(evidenceInput = []) {
    return (Array.isArray(evidenceInput) ? evidenceInput : [])
        .filter((item) => typeof item === 'string' || typeof item === 'object')
        .map((item) => {
            if (typeof item === 'string') {
                return {
                    url: item,
                    kind: item.match(/\.(mp4|mov|avi|webm)$/i) ? 'video' : 'photo',
                    source: 'client'
                };
            }

            return {
                url: item.url,
                kind: item.kind || 'photo',
                source: item.source || 'client',
                metadata: item.metadata || {}
            };
        })
        .filter((item) => item.url);
}

export const createDispute = async (req, res) => {
    try {
        const { order_id, reason, description, evidence = [] } = req.body;
        const customerId = req.user.id;

        if (!order_id || !reason || !description?.trim()) {
            return res.status(400).json({ success: false, message: 'order_id, reason et description sont requis.' });
        }

        if (!Object.values(DISPUTE_REASONS).includes(reason)) {
            return res.status(400).json({ success: false, message: 'Motif de litige invalide.' });
        }

        const order = await getOrderOrNull(order_id);
        if (!order || getOrderCustomerId(order) !== customerId) {
            return res.status(404).json({ success: false, message: 'Commande introuvable ou accès refusé.' });
        }

        const normalizedOrderStatus = mapLegacyOrderStatus(order.status);
        if (normalizedOrderStatus !== ORDER_STATUSES.DELIVERED) {
            return res.status(400).json({ success: false, message: 'Le litige ne peut être ouvert qu’après livraison validée.' });
        }

        if (!order.escrow_release_at || new Date(order.escrow_release_at) <= new Date()) {
            return res.status(400).json({ success: false, message: 'La fenêtre de litige est expirée.' });
        }

        const activeDispute = await getActiveDisputeByOrder(order_id);
        if (activeDispute) {
            return res.status(409).json({ success: false, message: 'Un litige actif existe déjà pour cette commande.' });
        }

        const normalizedEvidence = normalizeEvidence(evidence);

        // --- Validation preuves ---
        const photoItems = normalizedEvidence.filter((item) => item.kind === 'photo');
        const videoLinkItems = normalizedEvidence.filter((item) => item.kind === 'video_link');

        if (photoItems.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Minimum 2 photos requises pour ouvrir un litige.',
                required_min: 2,
                provided: photoItems.length
            });
        }

        if (photoItems.length > 5) {
            return res.status(400).json({
                success: false,
                message: 'Maximum 5 photos autorisées.',
                required_max: 5,
                provided: photoItems.length
            });
        }

        // Valider les liens vidéo externes (URL simple)
        for (const vl of videoLinkItems) {
            try { new URL(vl.url); } catch {
                return res.status(400).json({ success: false, message: 'Le lien vidéo fourni n\'est pas une URL valide.' });
            }
        }

        const abuseCheck = await detectDisputeAbuse(customerId);
        const initialStatus = abuseCheck.directReview ? DISPUTE_STATUSES.UNDER_REVIEW : DISPUTE_STATUSES.OPEN;
        const createdAt = new Date().toISOString();

        const { data: dispute, error } = await supabaseAdmin
            .from('disputes')
            .insert({
                order_id: order.id,
                opened_by: customerId,
                customer_id: customerId,
                vendor_id: getOrderVendorId(order),
                reason,
                reason_category: reason,
                description: description.trim(),
                evidence: normalizedEvidence,
                proof_urls: normalizedEvidence.map((item) => item.url),
                status: initialStatus,
                order_status_snapshot: normalizedOrderStatus,
                escrow_frozen_at: createdAt,
                seller_response_due_at: initialStatus === DISPUTE_STATUSES.OPEN ? addHours(createdAt, DISPUTE_SELLER_RESPONSE_HOURS) : null,
                buyer_response_due_at: null,
                review_due_at: initialStatus === DISPUTE_STATUSES.UNDER_REVIEW ? addHours(createdAt, DISPUTE_REVIEW_HOURS) : null,
                expires_at: order.escrow_release_at,
                last_actor_role: 'BUYER'
            })
            .select()
            .single();

        if (error) {
            console.error('Dispute creation failed:', error);
            return res.status(500).json({ success: false, message: 'Erreur lors de la création du litige.' });
        }

        await addDisputeEventMessage(dispute.id, customerId, DISPUTE_MESSAGE_TYPES.EVIDENCE, {
            event: 'OPEN_DISPUTE',
            reason,
            description: description.trim(),
            evidence: normalizedEvidence
        });

        if (!abuseCheck.directReview) {
            await updateDisputeRecord(dispute.id, {
                status: DISPUTE_STATUSES.SELLER_PENDING,
                seller_response_due_at: addHours(createdAt, DISPUTE_SELLER_RESPONSE_HOURS)
            });
        }

        await setOrderDisputeState(order, DISPUTE_STATUSES.OPEN, ESCROW_STATUSES.FROZEN, customerId, 'Dispute opened');
        await createEscrowEvent(supabaseAdmin, {
            orderId: order.id,
            eventType: ESCROW_EVENT_TYPES.FROZEN,
            amount: order.total_amount,
            metadata: {
                dispute_id: dispute.id,
                reason,
                abuse_direct_review: abuseCheck.directReview
            },
            processedAt: createdAt
        });

        const adminEmail = process.env.ADMIN_EMAIL || process.env.GMAIL_USER;
        if (adminEmail) {
            try {
                const { data: customer } = await supabaseAdmin.from('users').select('name').eq('id', customerId).single();
                await EmailService.sendDisputeOpenedAlert({
                    adminEmail,
                    orderId: order.id,
                    customerName: customer?.name || 'Un client',
                    reason
                });
            } catch (emailError) {
                console.error('Dispute email alert failed:', emailError.message);
            }
        }

        const finalDispute = await getDisputeOrNull(dispute.id);
        return res.status(201).json({
            success: true,
            message: 'Litige ouvert et escrow gelé.',
            data: finalDispute
        });
    } catch (error) {
        console.error('createDispute error:', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

export const getDisputes = async (req, res) => {
    try {
        const userId = req.user.id;
        const admin = isAdmin(req.user);

        let query = supabaseAdmin
            .from('disputes')
            .select(`
                *,
                orders!inner (
                    id,
                    total,
                    total_amount,
                    status,
                    escrow_status,
                    escrow_release_at,
                    delivered_at
                )
            `)
            .order('created_at', { ascending: false });

        if (!admin) {
            query = query.or(`customer_id.eq.${userId},vendor_id.eq.${userId},opened_by.eq.${userId}`);
        }

        const { data, error } = await query;
        if (error) {
            console.error('getDisputes error:', error);
            return res.status(500).json({ success: false, message: 'Erreur lors de la récupération des litiges.' });
        }

        return res.status(200).json({ success: true, data: data || [] });
    } catch (error) {
        console.error('getDisputes error:', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

export const getDisputeByOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await getOrderOrNull(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Commande introuvable.' });
        }

        const userId = req.user.id;
        const admin = isAdmin(req.user);
        const isParticipant = admin || getOrderCustomerId(order) === userId || getOrderVendorId(order) === userId;

        if (!isParticipant) {
            return res.status(403).json({ success: false, message: 'Accès non autorisé.' });
        }

        const dispute = await getActiveDisputeByOrder(orderId) || await supabaseAdmin
            .from('disputes')
            .select('*')
            .eq('order_id', orderId)
            .order('created_at', { ascending: false })
            .limit(1)
            .then((result) => result.data?.[0] || null);

        if (!dispute) {
            return res.status(404).json({ success: false, message: 'Litige introuvable.' });
        }

        return res.status(200).json({ success: true, data: dispute });
    } catch (error) {
        console.error('getDisputeByOrder error:', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

export const updateDispute = async (req, res) => {
    try {
        const { id } = req.params;
        const { description_update, new_evidence = [], note } = req.body;
        const userId = req.user.id;

        const dispute = await getDisputeOrNull(id);
        if (!dispute) {
            return res.status(404).json({ success: false, message: 'Litige introuvable.' });
        }

        if (dispute.customer_id !== userId && dispute.vendor_id !== userId && !isAdmin(req.user)) {
            return res.status(403).json({ success: false, message: 'Accès non autorisé.' });
        }

        if ([DISPUTE_STATUSES.RESOLVED, DISPUTE_STATUSES.REJECTED].includes(dispute.status)) {
            return res.status(400).json({ success: false, message: 'Ce litige est déjà clôturé.' });
        }

        const evidenceItems = normalizeEvidence(new_evidence);
        const mergedEvidence = [...(dispute.evidence || []), ...evidenceItems];
        const nextDescription = description_update ? `${dispute.description}\n\nMAJ: ${description_update}` : dispute.description;

        const updatedDispute = await updateDisputeRecord(id, {
            description: nextDescription,
            evidence: mergedEvidence,
            proof_urls: mergedEvidence.map((item) => item.url)
        });

        if (evidenceItems.length > 0) {
            await addDisputeEventMessage(id, userId, DISPUTE_MESSAGE_TYPES.EVIDENCE, {
                event: 'ADD_EVIDENCE',
                note: note || null,
                evidence: evidenceItems
            });
        } else if (description_update || note) {
            await addDisputeEventMessage(id, userId, DISPUTE_MESSAGE_TYPES.MESSAGE, {
                message: note || description_update
            });
        }

        return res.status(200).json({ success: true, data: updatedDispute });
    } catch (error) {
        console.error('updateDispute error:', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

export const vendorRespondToDispute = async (req, res) => {
    try {
        const { id } = req.params;
        const { action, amount = 0, evidence = [], message = '' } = req.body;
        const vendorId = req.user.id;

        if (!Object.values(DISPUTE_VENDOR_ACTIONS).includes(action)) {
            return res.status(400).json({ success: false, message: 'Action vendeur invalide.' });
        }

        const dispute = await getDisputeOrNull(id);
        if (!dispute) {
            return res.status(404).json({ success: false, message: 'Litige introuvable.' });
        }

        if (dispute.vendor_id !== vendorId) {
            return res.status(403).json({ success: false, message: 'Action réservée au vendeur concerné.' });
        }

        if (![DISPUTE_STATUSES.OPEN, DISPUTE_STATUSES.SELLER_PENDING].includes(dispute.status)) {
            return res.status(400).json({ success: false, message: 'Le litige n’attend pas de réponse vendeur.' });
        }

        const order = await getOrderOrNull(dispute.order_id);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Commande liée introuvable.' });
        }

        if (action === DISPUTE_VENDOR_ACTIONS.ACCEPT_REFUND) {
            const updatedDispute = await resolveAndCloseDispute(
                dispute,
                order,
                DISPUTE_RESOLUTIONS.FULL_REFUND,
                Number(order.total_amount || 0),
                vendorId,
                'vendor_accept_refund'
            );

            return res.status(200).json({ success: true, data: updatedDispute });
        }

        if (action === DISPUTE_VENDOR_ACTIONS.OFFER_PARTIAL_REFUND) {
            const partialAmount = Math.max(0, Number(amount || 0));
            const sellerEvidence = normalizeEvidence(evidence).map((item) => ({ ...item, source: 'seller' }));

            const updatedDispute = await updateDisputeRecord(id, {
                status: DISPUTE_STATUSES.BUYER_PENDING,
                proposed_resolution: DISPUTE_RESOLUTIONS.PARTIAL_REFUND,
                proposed_amount: partialAmount,
                buyer_response_due_at: addHours(new Date(), DISPUTE_BUYER_RESPONSE_HOURS),
                seller_response_due_at: null,
                last_actor_role: 'SELLER',
                seller_evidence: [...(dispute.seller_evidence || []), ...sellerEvidence]
            });

            await addDisputeEventMessage(id, vendorId, DISPUTE_MESSAGE_TYPES.OFFER, {
                action,
                amount: partialAmount,
                message,
                evidence: sellerEvidence
            });

            return res.status(200).json({ success: true, data: updatedDispute });
        }

        const sellerEvidence = normalizeEvidence(evidence).map((item) => ({ ...item, source: 'seller' }));
        const updatedDispute = await updateDisputeRecord(id, {
            status: DISPUTE_STATUSES.UNDER_REVIEW,
            review_due_at: addHours(new Date(), DISPUTE_REVIEW_HOURS),
            seller_response_due_at: null,
            last_actor_role: 'SELLER',
            seller_evidence: [...(dispute.seller_evidence || []), ...sellerEvidence]
        });

        await addDisputeEventMessage(id, vendorId, DISPUTE_MESSAGE_TYPES.EVIDENCE, {
            action,
            message,
            evidence: sellerEvidence
        });

        return res.status(200).json({ success: true, data: updatedDispute });
    } catch (error) {
        console.error('vendorRespondToDispute error:', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

export const buyerRespondToDispute = async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body;
        const buyerId = req.user.id;

        if (!Object.values(DISPUTE_BUYER_ACTIONS).includes(action)) {
            return res.status(400).json({ success: false, message: 'Action client invalide.' });
        }

        const dispute = await getDisputeOrNull(id);
        if (!dispute) {
            return res.status(404).json({ success: false, message: 'Litige introuvable.' });
        }

        if (dispute.customer_id !== buyerId) {
            return res.status(403).json({ success: false, message: 'Action réservée au client concerné.' });
        }

        if (dispute.status !== DISPUTE_STATUSES.BUYER_PENDING) {
            return res.status(400).json({ success: false, message: 'Le litige n’attend pas de réponse client.' });
        }

        const order = await getOrderOrNull(dispute.order_id);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Commande liée introuvable.' });
        }

        if (action === DISPUTE_BUYER_ACTIONS.ACCEPT) {
            const resolution = dispute.proposed_resolution || DISPUTE_RESOLUTIONS.PARTIAL_REFUND;
            const amount = Number(dispute.proposed_amount || 0);
            const updatedDispute = await resolveAndCloseDispute(
                dispute,
                order,
                resolution,
                amount,
                buyerId,
                'buyer_accept_offer'
            );

            return res.status(200).json({ success: true, data: updatedDispute });
        }

        const updatedDispute = await updateDisputeRecord(id, {
            status: DISPUTE_STATUSES.UNDER_REVIEW,
            review_due_at: addHours(new Date(), DISPUTE_REVIEW_HOURS),
            buyer_response_due_at: null,
            last_actor_role: 'BUYER'
        });

        await addDisputeEventMessage(id, buyerId, DISPUTE_MESSAGE_TYPES.SYSTEM, {
            event: 'BUYER_REJECT_OFFER'
        });

        return res.status(200).json({ success: true, data: updatedDispute });
    } catch (error) {
        console.error('buyerRespondToDispute error:', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

export const resolveDispute = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            resolution_decision,
            resolution,
            refund_amount = 0,
            action_for_order
        } = req.body;

        if (!isAdmin(req.user)) {
            return res.status(403).json({ success: false, message: 'Réservé aux administrateurs.' });
        }

        const dispute = await getDisputeOrNull(id);
        if (!dispute) {
            return res.status(404).json({ success: false, message: 'Litige introuvable.' });
        }

        const order = await getOrderOrNull(dispute.order_id);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Commande liée introuvable.' });
        }

        let finalResolution = resolution;
        if (!finalResolution && action_for_order === ORDER_STATUSES.COMPLETED) {
            finalResolution = DISPUTE_RESOLUTIONS.RELEASE_TO_SELLER;
        } else if (!finalResolution && action_for_order === ORDER_STATUSES.REFUNDED) {
            finalResolution = DISPUTE_RESOLUTIONS.FULL_REFUND;
        } else if (!finalResolution && action_for_order === 'PARTIAL_REFUND') {
            finalResolution = DISPUTE_RESOLUTIONS.PARTIAL_REFUND;
        }

        if (!Object.values(DISPUTE_RESOLUTIONS).includes(finalResolution)) {
            return res.status(400).json({ success: false, message: 'Résolution finale invalide.' });
        }

        const updatedDispute = await updateDisputeRecord(id, {
            status: DISPUTE_STATUSES.RESOLVED,
            resolution: finalResolution,
            resolution_decision: resolution_decision || null,
            refund_amount: Number(refund_amount || 0),
            resolved_at: new Date().toISOString(),
            seller_response_due_at: null,
            buyer_response_due_at: null,
            review_due_at: null,
            last_actor_role: 'ADMIN'
        });

        await addDisputeEventMessage(id, req.user.id, DISPUTE_MESSAGE_TYPES.SYSTEM, {
            event: 'ADMIN_RESOLUTION',
            decision: resolution_decision,
            resolution: finalResolution,
            refund_amount: Number(refund_amount || 0)
        });

        await applyDisputeResolution({
            dispute: updatedDispute,
            order,
            resolution: finalResolution,
            refundAmount: Number(refund_amount || 0),
            changedBy: req.user.id,
            source: 'admin_resolution'
        });

        return res.status(200).json({
            success: true,
            message: 'Litige résolu avec succès.',
            data: updatedDispute
        });
    } catch (error) {
        console.error('resolveDispute error:', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

export const addDisputeMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { type = DISPUTE_MESSAGE_TYPES.MESSAGE, payload = {}, message = '' } = req.body;
        const userId = req.user.id;

        const dispute = await getDisputeOrNull(id);
        if (!dispute) {
            return res.status(404).json({ success: false, message: 'Litige introuvable.' });
        }

        const isParticipant = isAdmin(req.user) || dispute.customer_id === userId || dispute.vendor_id === userId;
        if (!isParticipant) {
            return res.status(403).json({ success: false, message: 'Accès non autorisé à ce litige.' });
        }

        if (![DISPUTE_MESSAGE_TYPES.MESSAGE, DISPUTE_MESSAGE_TYPES.EVIDENCE].includes(type)) {
            return res.status(400).json({ success: false, message: 'Type de message non autorisé.' });
        }

        const normalizedPayload = type === DISPUTE_MESSAGE_TYPES.EVIDENCE
            ? { ...payload, evidence: normalizeEvidence(payload.evidence || []) }
            : { message: message || payload.message || '' };

        const data = await addDisputeEventMessage(id, userId, type, normalizedPayload);
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

        const dispute = await getDisputeOrNull(id);
        if (!dispute) {
            return res.status(404).json({ success: false, message: 'Litige introuvable.' });
        }

        const isParticipant = isAdmin(req.user) || dispute.customer_id === userId || dispute.vendor_id === userId;
        if (!isParticipant) {
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
        const dispute = await getDisputeOrNull(id);
        if (!dispute) {
            return res.status(404).json({ success: false, message: 'Litige introuvable.' });
        }

        req.body.action = DISPUTE_VENDOR_ACTIONS.ACCEPT_REFUND;
        return vendorRespondToDispute(req, res);
    } catch (error) {
        console.error('vendorResolveAmiable error:', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

export const processDueDisputesJob = async () => {
    const nowIso = new Date().toISOString();
    const { data: activeDisputes, error } = await supabaseAdmin
        .from('disputes')
        .select('*')
        .in('status', [
            DISPUTE_STATUSES.SELLER_PENDING,
            DISPUTE_STATUSES.BUYER_PENDING,
            DISPUTE_STATUSES.UNDER_REVIEW
        ]);

    if (error) {
        console.error('processDueDisputesJob query error:', error);
        return { processed: 0, failed: 0 };
    }

    let processed = 0;
    let failed = 0;

    for (const dispute of activeDisputes || []) {
        try {
            const order = await getOrderOrNull(dispute.order_id);
            if (!order) {
                failed += 1;
                continue;
            }

            if (dispute.status === DISPUTE_STATUSES.SELLER_PENDING && dispute.seller_response_due_at && dispute.seller_response_due_at <= nowIso) {
                await resolveAndCloseDispute(
                    dispute,
                    order,
                    DISPUTE_RESOLUTIONS.FULL_REFUND,
                    Number(order.total_amount || 0),
                    'sla-job',
                    'seller_timeout'
                );
                processed += 1;
                continue;
            }

            if (dispute.status === DISPUTE_STATUSES.BUYER_PENDING && dispute.buyer_response_due_at && dispute.buyer_response_due_at <= nowIso) {
                const resolution = dispute.proposed_resolution || DISPUTE_RESOLUTIONS.PARTIAL_REFUND;
                const amount = Number(dispute.proposed_amount || 0);
                await resolveAndCloseDispute(
                    dispute,
                    order,
                    resolution,
                    amount,
                    'sla-job',
                    'buyer_timeout_auto_accept'
                );
                processed += 1;
                continue;
            }

            if (dispute.status === DISPUTE_STATUSES.UNDER_REVIEW && dispute.review_due_at && dispute.review_due_at <= nowIso) {
                const evidenceScore = approximateEvidenceStrength(dispute);
                let resolution = DISPUTE_RESOLUTIONS.RELEASE_TO_SELLER;
                let amount = 0;

                if (!hasClientEvidence(dispute)) {
                    resolution = DISPUTE_RESOLUTIONS.RELEASE_TO_SELLER;
                } else if (evidenceScore >= 3) {
                    resolution = DISPUTE_RESOLUTIONS.FULL_REFUND;
                    amount = Number(order.total_amount || 0);
                } else {
                    resolution = DISPUTE_RESOLUTIONS.PARTIAL_REFUND;
                    amount = Number(order.total_amount || 0) / 2;
                }

                await resolveAndCloseDispute(
                    dispute,
                    order,
                    resolution,
                    amount,
                    'sla-job',
                    'review_timeout_auto_decision'
                );
                processed += 1;
            }
        } catch (jobError) {
            failed += 1;
            console.error(`processDueDisputesJob failed for dispute ${dispute.id}:`, jobError.message);
        }
    }

    return { processed, failed };
};
