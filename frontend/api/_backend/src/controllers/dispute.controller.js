import { supabaseAdmin } from '../config/supabase.js';
import EmailService from '../services/emailService.js';
import {
    ORDER_STATUSES,
    ESCROW_EVENT_TYPES,
    ESCROW_STATUSES,
    DISPUTE_STATUSES,
    DISPUTE_REASONS,
    DISPUTE_REASON_DEFAULTS,
    DISPUTE_RESOLUTIONS,
    DISPUTE_MESSAGE_TYPES,
    DISPUTE_VENDOR_ACTIONS,
    DISPUTE_BUYER_ACTIONS,
    DISPUTE_SELLER_RESPONSE_HOURS,
    DISPUTE_BUYER_RESPONSE_HOURS,
    DISPUTE_REVIEW_HOURS,
    DISPUTE_RETURN_HOURS,
    MAX_RETURN_OTP_ATTEMPTS,
    ESCROW_HOLD_HOURS,
    addHours,
    createEscrowEvent,
    getOrderCustomerId,
    getOrderVendorId,
    logOrderStatusHistory,
    mapLegacyOrderStatus,
    releaseOrderEscrow,
    getCommissionRate
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
    
    // ─── Calcul de la commission ───
    const totalAmount = parseFloat(order.total_amount || order.total || 0);
    let commissionAmount = parseFloat(order.platform_commission_amount || 0);
    
    if (!order.platform_commission_amount && order.platform_commission_amount !== 0) {
        const commissionRate = await getCommissionRate(supabaseAdmin);
        commissionAmount = Math.round(totalAmount * commissionRate) / 100;
    }
    
    const maxPayoutAmount = Math.round((totalAmount - commissionAmount) * 100) / 100;

    if (resolution === DISPUTE_RESOLUTIONS.FULL_REFUND) {
        const actualRefundAmount = maxPayoutAmount; // Le client reçoit tout sauf la commission
        
        await supabaseAdmin
            .from('orders')
            .update({
                status: ORDER_STATUSES.REFUNDED,
                escrow_status: ESCROW_STATUSES.REFUNDED,
                completed_at: nowIso,
                released_at: nowIso,
                updated_at: nowIso,
                refund_status: 'APPROVED',
                refund_amount: actualRefundAmount,
                refunded_at: nowIso,
                platform_commission_amount: commissionAmount,
                payout_amount: 0 // Le vendeur ne reçoit rien
            })
            .eq('id', order.id);

        await createEscrowEvent(supabaseAdmin, {
            orderId: order.id,
            eventType: ESCROW_EVENT_TYPES.REFUNDED,
            amount: totalAmount,
            metadata: {
                dispute_id: dispute.id,
                source,
                refund_amount: actualRefundAmount,
                commission_amount: commissionAmount,
                seller_amount: 0
            },
            processedAt: nowIso
        });
    } else if (resolution === DISPUTE_RESOLUTIONS.PARTIAL_REFUND) {
        // Sécurité : le remboursement partiel ne peut pas dépasser ce qui est distribuable
        const safeRefundAmount = Math.min(parseFloat(refundAmount || 0), maxPayoutAmount);
        const sellerAmount = Math.max(0, maxPayoutAmount - safeRefundAmount);

        await supabaseAdmin
            .from('orders')
            .update({
                status: ORDER_STATUSES.COMPLETED,
                escrow_status: ESCROW_STATUSES.RELEASED,
                completed_at: nowIso,
                released_at: nowIso,
                updated_at: nowIso,
                refund_status: 'APPROVED',
                refund_amount: safeRefundAmount,
                refunded_at: nowIso,
                platform_commission_amount: commissionAmount,
                payout_amount: sellerAmount
            })
            .eq('id', order.id);

        await createEscrowEvent(supabaseAdmin, {
            orderId: order.id,
            eventType: ESCROW_EVENT_TYPES.PARTIAL,
            amount: totalAmount,
            metadata: {
                dispute_id: dispute.id,
                source,
                refund_amount: safeRefundAmount,
                commission_amount: commissionAmount,
                seller_amount: sellerAmount
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

    // Calcul du vrai statut final selon la résolution
    const finalOrderStatus = resolution === DISPUTE_RESOLUTIONS.FULL_REFUND
        ? ORDER_STATUSES.REFUNDED
        : ORDER_STATUSES.COMPLETED;

    await logOrderStatusHistory(supabaseAdmin, {
        orderId: order.id,
        previousStatus: ORDER_STATUSES.DISPUTE_OPEN,
        newStatus: finalOrderStatus,
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

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function initiateReturn(dispute, order, changedBy, source, refundAmount) {
    const returnOtp = generateOtp();
    
    // Set order back to IN_DELIVERY equivalent? Or just update otp_code.
    await supabaseAdmin
        .from('orders')
        .update({
            otp_code: returnOtp,
            otp_attempts: 0,
            updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

    const updatedDispute = await updateDisputeRecord(dispute.id, {
        status: DISPUTE_STATUSES.AWAITING_RETURN,
        resolution: DISPUTE_RESOLUTIONS.REFUND_WITH_RETURN,
        refund_amount: Number(refundAmount || order.total_amount || 0),
        review_due_at: null,
        seller_response_due_at: null,
        buyer_response_due_at: addHours(new Date(), DISPUTE_RETURN_HOURS),
        last_actor_role: changedBy === dispute.customer_id ? 'BUYER' : (changedBy === dispute.vendor_id ? 'SELLER' : 'SYSTEM')
    });

    await addDisputeEventMessage(dispute.id, changedBy === 'system' ? null : changedBy, DISPUTE_MESSAGE_TYPES.SYSTEM, {
        event: 'AWAITING_RETURN',
        message: `Remboursement accepté sous condition de retour. Le vendeur détient le code OTP. L'acheteur a ${DISPUTE_RETURN_HOURS}h pour ramener le produit et saisir l'OTP remis par le vendeur pour déclencher le remboursement, sous peine de clôture du litige au profit du vendeur.`,
        source
    });

    return updatedDispute;
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

export const createDispute = async (req, res, next) => {
    try {
        const { order_id, reason, description, evidence = [] } = req.body;
        const customerId = req.user.id;

        if (!order_id || !reason || !description?.trim()) {
            return res.status(400).json({ success: false, message: 'order_id, reason et description sont requis.' });
        }

        if (!Object.values(DISPUTE_REASONS).includes(reason)) {
            return res.status(400).json({ success: false, message: 'Motif de litige invalide.' });
        }

        // --- Logique spécifique par raison ---
        const reasonDefaults = DISPUTE_REASON_DEFAULTS[reason];

        // Validation longueur de description selon la raison
        if (description.trim().length < reasonDefaults.minDescriptionLen) {
            return res.status(400).json({
                success: false,
                message: `La description doit contenir au moins ${reasonDefaults.minDescriptionLen} caractères pour ce motif (${description.trim().length} fournis).`,
                required_min_length: reasonDefaults.minDescriptionLen,
                provided_length: description.trim().length
            });
        }

        const order = await getOrderOrNull(order_id);
        if (!order || getOrderCustomerId(order) !== customerId) {
            return res.status(404).json({ success: false, message: 'Commande introuvable ou accès refusé.' });
        }

        const normalizedOrderStatus = mapLegacyOrderStatus(order.status);
        // On accepte DELIVERED (livraison validée) et COMPLETED (escrow auto-libéré ou confirmé par le client)
        const disputeEligibleStatuses = [ORDER_STATUSES.DELIVERED, ORDER_STATUSES.COMPLETED];
        if (!disputeEligibleStatuses.includes(normalizedOrderStatus)) {
            return res.status(400).json({ success: false, message: 'Le litige ne peut être ouvert qu\'après livraison validée.' });
        }

        // Pour les commandes DELIVERED : bloquer si la fenêtre de litige est expirée.
        // Pour les commandes COMPLETED (auto-release) : on autorise toujours — l'escrow_release_at
        // est déjà dans le passé par définition, mais le client conserve son droit au litige.
        if (normalizedOrderStatus === ORDER_STATUSES.DELIVERED &&
            order.escrow_release_at && new Date(order.escrow_release_at) <= new Date()) {
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

        // --- Détermination du statut initial ---
        // COUNTERFEIT et OTHER → UNDER_REVIEW direct (par définition de la raison)
        // Client abusif → UNDER_REVIEW direct (détection d'abus)
        // Tous les autres → OPEN → SELLER_PENDING
        const abuseCheck = await detectDisputeAbuse(customerId);
        const forceDirectReview = reasonDefaults.directReview || abuseCheck.directReview;
        const initialStatus = forceDirectReview
            ? DISPUTE_STATUSES.UNDER_REVIEW
            : DISPUTE_STATUSES.OPEN;

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
                // Flag interne : 'FRAUD_ALERT' pour COUNTERFEIT, 'ADMIN_ONLY' pour OTHER
                reason_flag: reasonDefaults.reasonFlag,
                // Résolution conseillée : pré-remplie dans l'interface admin
                suggested_resolution: reasonDefaults.suggestedResolution,
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
            return next(error);
        }

        await addDisputeEventMessage(dispute.id, customerId, DISPUTE_MESSAGE_TYPES.EVIDENCE, {
            event: 'OPEN_DISPUTE',
            reason,
            description: description.trim(),
            evidence: normalizedEvidence,
            // Metadata contextuelle pour l'admin
            reason_flag: reasonDefaults.reasonFlag,
            suggested_resolution: reasonDefaults.suggestedResolution,
            requires_return: reasonDefaults.requiresReturn,
            direct_review: forceDirectReview,
            direct_review_cause: abuseCheck.directReview ? 'abuse_detected' : (reasonDefaults.directReview ? 'reason_policy' : null)
        });

        if (!forceDirectReview) {
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
                reason_flag: reasonDefaults.reasonFlag,
                abuse_direct_review: abuseCheck.directReview,
                reason_direct_review: reasonDefaults.directReview
            },
            processedAt: createdAt
        });

        // Alerte email admin — priorité haute pour COUNTERFEIT
        const adminEmail = process.env.ADMIN_EMAIL || process.env.GMAIL_USER;
        if (adminEmail) {
            try {
                const { data: customer } = await supabaseAdmin.from('users').select('name').eq('id', customerId).single();
                await EmailService.sendDisputeOpenedAlert({
                    adminEmail,
                    orderId: order.id,
                    customerName: customer?.name || 'Un client',
                    reason,
                    // Permet à l'email template d'afficher un bandeau d'urgence pour COUNTERFEIT
                    urgent: reason === DISPUTE_REASONS.COUNTERFEIT
                });
            } catch (emailError) {
                console.error('Dispute email alert failed:', emailError.message);
            }
        }

        const finalDispute = await getDisputeOrNull(dispute.id);
        return res.status(201).json({
            success: true,
            message: forceDirectReview
                ? 'Litige escaladé directement en révision admin (motif ou politique de détection).'
                : 'Litige ouvert et escrow gelé.',
            data: finalDispute,
            // Informations utiles pour le frontend
            meta: {
                initial_status: initialStatus,
                reason_flag: reasonDefaults.reasonFlag,
                suggested_resolution: reasonDefaults.suggestedResolution,
                requires_return: reasonDefaults.requiresReturn
            }
        });
    } catch (error) {
        console.error('createDispute error:', error);
        return next(error);
    }
};

export const getDisputes = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const admin = isAdmin(req.user);

        let query = supabaseAdmin
            .from('disputes')
            .select('*')
            .order('created_at', { ascending: false });

        if (!admin) {
            query = query.or(`customer_id.eq.${userId},vendor_id.eq.${userId},opened_by.eq.${userId}`);
        }

        const { data: disputesData, error } = await query;
        if (error) {
            console.error('getDisputes error:', error);
            return next(error);
        }

        // Handle missing foreign key between disputes and orders manually
        const orderIds = [...new Set((disputesData || []).map(d => d.order_id).filter(Boolean))];
        let ordersMap = {};
        if (orderIds.length > 0) {
            const { data: ordersData, error: ordersError } = await supabaseAdmin
                .from('orders')
                .select('id, total, total_amount, platform_commission_amount, payout_amount, status, escrow_status, escrow_release_at, delivered_at')
                .in('id', orderIds);
            
            if (!ordersError && ordersData) {
                ordersData.forEach(o => {
                    ordersMap[o.id] = o;
                });
            } else if (ordersError) {
                console.error('getDisputes orders fetch error:', ordersError);
            }
        }

        const data = (disputesData || []).map(d => ({
            ...d,
            orders: ordersMap[d.order_id] || null
        })).filter(d => d.orders !== null); // Inner join behavior

        return res.status(200).json({ success: true, data: data || [] });
    } catch (error) {
        console.error('getDisputes error:', error);
        return next(error);
    }
};

export const getDisputeByOrder = async (req, res, next) => {
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

        // Pour l'admin uniquement : inclure l'OTP de retour si le litige est en attente de retour
        let responseData = { ...dispute };
        if (admin && dispute.status === 'AWAITING_RETURN') {
            const freshOrder = await getOrderOrNull(orderId);
            if (freshOrder?.otp_code) {
                responseData._return_otp = freshOrder.otp_code;
                responseData._return_otp_attempts_left = Math.max(0, MAX_RETURN_OTP_ATTEMPTS - (freshOrder.otp_attempts || 0));
            }
        }

        return res.status(200).json({ success: true, data: responseData });
    } catch (error) {
        console.error('getDisputeByOrder error:', error);
        return next(error);
    }
};

export const updateDispute = async (req, res, next) => {
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
        return next(error);
    }
};

export const vendorRespondToDispute = async (req, res, next) => {
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

        // ACCEPT_REFUND et OFFER_PARTIAL_REFUND sont autorisés même en UNDER_REVIEW
        // (le vendeur peut changer d'avis après contestation et proposer un compromis)
        const allowedForSettlement = [
            DISPUTE_STATUSES.OPEN,
            DISPUTE_STATUSES.SELLER_PENDING,
            DISPUTE_STATUSES.UNDER_REVIEW
        ];
        const allowedForContest = [
            DISPUTE_STATUSES.OPEN,
            DISPUTE_STATUSES.SELLER_PENDING
        ];

        const isSettlementAction = [
            DISPUTE_VENDOR_ACTIONS.ACCEPT_REFUND,
            DISPUTE_VENDOR_ACTIONS.ACCEPT_REFUND_WITH_RETURN,
            DISPUTE_VENDOR_ACTIONS.OFFER_PARTIAL_REFUND
        ].includes(action);

        const allowedStatuses = isSettlementAction ? allowedForSettlement : allowedForContest;

        if (!allowedStatuses.includes(dispute.status)) {
            return res.status(400).json({
                success: false,
                message: isSettlementAction
                    ? 'Ce litige ne peut plus être résolu par le vendeur dans son état actuel.'
                    : 'Le litige n\'attend pas de réponse vendeur pour une contestation.'
            });
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

        if (action === DISPUTE_VENDOR_ACTIONS.ACCEPT_REFUND_WITH_RETURN) {
            const updatedDispute = await initiateReturn(
                dispute,
                order,
                vendorId,
                'vendor_accept_refund_with_return',
                Number(order.total_amount || 0)
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
        return next(error);
    }
};

export const buyerRespondToDispute = async (req, res, next) => {
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
        return next(error);
    }
};

export const resolveDispute = async (req, res, next) => {
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

        if (finalResolution === DISPUTE_RESOLUTIONS.REFUND_WITH_RETURN) {
            const updatedDispute = await initiateReturn(
                dispute,
                order,
                req.user.id,
                'admin_resolution',
                refund_amount
            );

            // Optionnel : ajouter le message de décision de l'admin
            if (resolution_decision) {
                await addDisputeEventMessage(id, req.user.id, DISPUTE_MESSAGE_TYPES.MESSAGE, {
                    message: `[DÉCISION ADMIN] : ${resolution_decision}`
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Le litige est passé en attente de retour. L\'OTP a été généré.',
                data: updatedDispute
            });
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
        return next(error);
    }
};

/**
 * Rejet d'un litige par l'admin — litige non fondé ou abusif.
 * Libère l'escrow au vendeur + alerte les deux parties.
 * Route : PATCH /api/disputes/:id/reject
 */
export const rejectDispute = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { rejection_reason } = req.body;

        if (!isAdmin(req.user)) {
            return res.status(403).json({ success: false, message: 'Réservé aux administrateurs.' });
        }

        if (!rejection_reason?.trim()) {
            return res.status(400).json({ success: false, message: 'Une raison de rejet est obligatoire.' });
        }

        const dispute = await getDisputeOrNull(id);
        if (!dispute) {
            return res.status(404).json({ success: false, message: 'Litige introuvable.' });
        }

        // Un litige déjà clôturé ne peut pas être rejeté
        if ([DISPUTE_STATUSES.RESOLVED, DISPUTE_STATUSES.REJECTED].includes(dispute.status)) {
            return res.status(400).json({ success: false, message: 'Ce litige est déjà clôturé.' });
        }

        const order = await getOrderOrNull(dispute.order_id);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Commande liée introuvable.' });
        }

        const nowIso = new Date().toISOString();

        // 1. Marquer le litige comme REJECTED
        const updatedDispute = await updateDisputeRecord(id, {
            status: DISPUTE_STATUSES.REJECTED,
            resolution: DISPUTE_RESOLUTIONS.RELEASE_TO_SELLER,
            resolution_decision: rejection_reason.trim(),
            resolved_at: nowIso,
            seller_response_due_at: null,
            buyer_response_due_at: null,
            review_due_at: null,
            last_actor_role: 'ADMIN'
        });

        // 2. Message système visible par les deux parties
        await addDisputeEventMessage(id, req.user.id, DISPUTE_MESSAGE_TYPES.SYSTEM, {
            event: 'DISPUTE_REJECTED',
            message: `Ce litige a été rejeté par l'administration. Motif : ${rejection_reason.trim()}`,
            resolution: DISPUTE_RESOLUTIONS.RELEASE_TO_SELLER
        });

        // 3. Libérer l'escrow au vendeur
        await releaseOrderEscrow({
            client: supabaseAdmin,
            order,
            initiatedBy: req.user.id,
            autoRelease: false,
            force: true
        });

        // 4. Historique du statut commande
        await logOrderStatusHistory(supabaseAdmin, {
            orderId: order.id,
            previousStatus: ORDER_STATUSES.DISPUTE_OPEN,
            newStatus: ORDER_STATUSES.COMPLETED,
            changedBy: req.user.id,
            notes: `Litige rejeté par admin — ${rejection_reason.trim()}`
        });

        // 5. Notifier l'acheteur et le vendeur par email (non bloquant)
        try {
            const [{ data: buyer }, { data: vendor }] = await Promise.all([
                supabaseAdmin.from('users').select('name, email').eq('id', dispute.customer_id).maybeSingle(),
                supabaseAdmin.from('users').select('name, email').eq('id', dispute.vendor_id).maybeSingle()
            ]);

            if (buyer?.email) {
                await EmailService.sendEmail({
                    to: buyer.email,
                    subject: `[NewKet] Votre litige a été rejeté (commande #${order.id.substring(0, 8)})`,
                    text: `Bonjour ${buyer.name || ''},\n\nVotre litige concernant la commande #${order.id.substring(0, 8)} a été examiné et rejeté par notre équipe.\n\nMotif : ${rejection_reason.trim()}\n\nLes fonds ont été libérés au vendeur.\n\nL'équipe NewKet`
                });
            }

            if (vendor?.email) {
                await EmailService.sendEmail({
                    to: vendor.email,
                    subject: `[NewKet] Litige rejeté — fonds libérés (commande #${order.id.substring(0, 8)})`,
                    text: `Bonjour ${vendor.name || ''},\n\nLe litige ouvert contre vous concernant la commande #${order.id.substring(0, 8)} a été rejeté par notre équipe.\n\nMotif : ${rejection_reason.trim()}\n\nLes fonds vous ont été libérés.\n\nL'équipe NewKet`
                });
            }
        } catch (emailError) {
            console.warn('[rejectDispute] Email notifications failed:', emailError.message);
        }

        return res.status(200).json({
            success: true,
            message: 'Litige rejeté. L\'escrow a été libéré au vendeur.',
            data: updatedDispute
        });
    } catch (error) {
        console.error('rejectDispute error:', error);
        return next(error);
    }
};

export const addDisputeMessage = async (req, res, next) => {
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
        return next(error);
    }
};

export const getDisputeMessages = async (req, res, next) => {
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
            .select('*, users (name, avatar, role)')
            .eq('dispute_id', id)
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Enrichit chaque message avec un sender_role calculé
        const enriched = (data || []).map((msg) => {
            let sender_role = 'SYSTEM';
            if (msg.sender_id) {
                if (msg.sender_id === dispute.customer_id) {
                    sender_role = 'CUSTOMER';
                } else if (msg.sender_id === dispute.vendor_id) {
                    sender_role = 'VENDOR';
                } else if (msg.users?.role === 'admin' || msg.users?.role === 'ADMIN') {
                    sender_role = 'ADMIN';
                } else {
                    sender_role = 'ADMIN'; // fallback: tout autre user authentifié = admin/support
                }
            }
            return { ...msg, sender_role };
        });

        return res.status(200).json({ success: true, data: enriched });
    } catch (error) {
        console.error('getDisputeMessages error:', error);
        return next(error);
    }
};

export const vendorResolveAmiable = async (req, res, next) => {
    try {
        const { id } = req.params;
        const dispute = await getDisputeOrNull(id);
        if (!dispute) {
            return res.status(404).json({ success: false, message: 'Litige introuvable.' });
        }

        req.body.action = DISPUTE_VENDOR_ACTIONS.ACCEPT_REFUND;
        return vendorRespondToDispute(req, res, next);
    } catch (error) {
        console.error('vendorResolveAmiable error:', error);
        return next(error);
    }
};

/**
 * Escalade manuelle à l'admin — bouton "Faire intervenir l'Admin"
 * Accessible par l'acheteur OU le vendeur si le litige est OPEN, SELLER_PENDING ou BUYER_PENDING.
 * Met le litige en UNDER_REVIEW et notifie l'équipe.
 */
export const escalateToAdmin = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const dispute = await getDisputeOrNull(id);
        if (!dispute) {
            return res.status(404).json({ success: false, message: 'Litige introuvable.' });
        }

        const isParticipant = dispute.customer_id === userId || dispute.vendor_id === userId;
        if (!isParticipant && !isAdmin(req.user)) {
            return res.status(403).json({ success: false, message: 'Accès non autorisé.' });
        }

        const escalatableStatuses = [
            DISPUTE_STATUSES.OPEN,
            DISPUTE_STATUSES.SELLER_PENDING,
            DISPUTE_STATUSES.BUYER_PENDING,
            DISPUTE_STATUSES.AWAITING_RETURN
        ];
        if (!escalatableStatuses.includes(dispute.status)) {
            return res.status(400).json({ success: false, message: `Le litige ne peut pas être escaladé depuis le statut ${dispute.status}.` });
        }

        const nowIso = new Date().toISOString();

        await updateDisputeRecord(id, {
            status: DISPUTE_STATUSES.UNDER_REVIEW,
            review_due_at: addHours(nowIso, DISPUTE_REVIEW_HOURS),
            last_actor_role: dispute.customer_id === userId ? 'BUYER' : 'VENDOR'
        });

        // Poster un message système dans le chat pour informer les deux parties
        const actorLabel = dispute.customer_id === userId ? 'l\'acheteur' : 'le vendeur';
        await addDisputeEventMessage(id, null, DISPUTE_MESSAGE_TYPES.SYSTEM, {
            event: 'ADMIN_ESCALATION',
            message: `L'administration a été sollicitée par ${actorLabel}. Le litige est maintenant sous révision. Une décision sera prise dans les 72h.`
        });

        // Notifier l'admin par email
        const adminEmail = process.env.ADMIN_EMAIL || process.env.GMAIL_USER;
        if (adminEmail) {
            try {
                await EmailService.sendEmail({
                    to: adminEmail,
                    subject: `[NewKet] Intervention demandée sur litige #${id.substring(0, 8)}`,
                    text: `Un participant (${actorLabel}) a demandé une intervention admin sur le litige ${id} (commande ${dispute.order_id}). Connectez-vous au tableau de bord admin pour trancher.`
                });
            } catch (emailError) {
                console.warn('[EscalateToAdmin] Email notification failed:', emailError.message);
            }
        }

        const updatedDispute = await getDisputeOrNull(id);
        return res.status(200).json({
            success: true,
            message: 'L\'administration a été notifiée. Le litige est sous révision.',
            data: updatedDispute
        });
    } catch (error) {
        console.error('escalateToAdmin error:', error);
        return next(error);
    }
};

/**
 * Récupération de l'OTP de retour — RÉSERVÉ AU VENDEUR et à l'Admin.
 * L'acheteur ne doit JAMAIS recevoir ce code directement.
 */
export const getReturnOtp = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const dispute = await getDisputeOrNull(id);
        if (!dispute) {
            return res.status(404).json({ success: false, message: 'Litige introuvable.' });
        }

        if (dispute.status !== DISPUTE_STATUSES.AWAITING_RETURN) {
            return res.status(400).json({ success: false, message: 'Le litige n\'est pas en attente de retour.' });
        }

        // Seul le vendeur ou l'admin peut voir l'OTP
        const isVendor = dispute.vendor_id === userId;
        if (!isVendor && !isAdmin(req.user)) {
            return res.status(403).json({ success: false, message: 'Seul le vendeur peut récupérer le code OTP de retour.' });
        }

        const order = await getOrderOrNull(dispute.order_id);
        if (!order || !order.otp_code) {
            return res.status(404).json({ success: false, message: 'Code OTP non trouvé pour cette commande.' });
        }

        return res.status(200).json({
            success: true,
            otp: order.otp_code,
            attempts_left: Math.max(0, 5 - (order.otp_attempts || 0))
        });
    } catch (error) {
        console.error('getReturnOtp error:', error);
        return next(error);
    }
};

/**
 * Confirmation du retour physique par l'acheteur via l'OTP fourni par le vendeur.
 */
export const confirmReturn = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { otp } = req.body;
        const userId = req.user.id;

        if (!otp) {
            return res.status(400).json({ success: false, message: 'Le code OTP est requis.' });
        }

        const dispute = await getDisputeOrNull(id);
        if (!dispute) {
            return res.status(404).json({ success: false, message: 'Litige introuvable.' });
        }

        if (dispute.customer_id !== userId) {
            return res.status(403).json({ success: false, message: 'Seul l\'acheteur peut confirmer le retour.' });
        }

        if (dispute.status !== DISPUTE_STATUSES.AWAITING_RETURN) {
            return res.status(400).json({ success: false, message: 'Le litige n\'est pas en attente de retour.' });
        }

        const order = await getOrderOrNull(dispute.order_id);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Commande liée introuvable.' });
        }

        const MAX_ATTEMPTS = MAX_RETURN_OTP_ATTEMPTS;
        const currentAttempts = order.otp_attempts || 0;

        if (currentAttempts >= MAX_ATTEMPTS) {
            return res.status(429).json({ success: false, message: 'Nombre maximum de tentatives atteint. Le litige a été verrouillé et escaladé.' });
        }

        if (order.otp_code !== otp) {
            const newAttempts = currentAttempts + 1;
            await supabaseAdmin.from('orders').update({ otp_attempts: newAttempts }).eq('id', order.id);

            if (newAttempts >= MAX_ATTEMPTS) {
                // Bloquer et escalader à l'admin
                await updateDisputeRecord(id, {
                    status: DISPUTE_STATUSES.UNDER_REVIEW,
                    review_due_at: new Date().toISOString(),
                    last_actor_role: 'SYSTEM'
                });
                await addDisputeEventMessage(id, null, DISPUTE_MESSAGE_TYPES.SYSTEM, {
                    event: 'ADMIN_ESCALATION',
                    message: "Le litige a été automatiquement transmis à l'administration suite à de multiples tentatives échouées de saisie du code OTP de retour."
                });
                return res.status(429).json({ success: false, message: 'Code OTP incorrect. Le litige a été transmis à l\'administration par sécurité.' });
            }

            const remaining = MAX_ATTEMPTS - newAttempts;
            return res.status(400).json({ success: false, message: `Code OTP incorrect. Il vous reste ${remaining} essai(s).` });
        }

        // Le code est bon ! On résout le litige en FULL_REFUND (ou le montant défini dans refund_amount)
        const updatedDispute = await resolveAndCloseDispute(
            dispute,
            order,
            DISPUTE_RESOLUTIONS.FULL_REFUND,
            Number(dispute.refund_amount || order.total_amount || 0),
            userId,
            'buyer_confirm_return'
        );

        // Vider le code OTP pour des raisons de sécurité
        await supabaseAdmin
            .from('orders')
            .update({ otp_code: null, updated_at: new Date().toISOString() })
            .eq('id', order.id);

        return res.status(200).json({
            success: true,
            message: 'Retour confirmé avec succès. Le remboursement va être effectué.',
            data: updatedDispute
        });
    } catch (error) {
        console.error('confirmReturn error:', error);
        return next(error);
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
            DISPUTE_STATUSES.UNDER_REVIEW,
            DISPUTE_STATUSES.AWAITING_RETURN
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

            if (dispute.status === DISPUTE_STATUSES.AWAITING_RETURN && dispute.buyer_response_due_at && dispute.buyer_response_due_at <= nowIso) {
                // Acheteur n'a pas validé l'OTP dans les 48h, l'argent va au vendeur
                await resolveAndCloseDispute(
                    dispute,
                    order,
                    DISPUTE_RESOLUTIONS.RELEASE_TO_SELLER,
                    0,
                    'sla-job',
                    'buyer_return_timeout'
                );
                
                // Vider l'OTP par sécurité
                await supabaseAdmin
                    .from('orders')
                    .update({ otp_code: null, updated_at: new Date().toISOString() })
                    .eq('id', order.id);

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
