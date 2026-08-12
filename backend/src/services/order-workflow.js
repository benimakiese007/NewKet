import crypto from 'crypto';
import { supabaseAdmin, supabase } from '../config/supabase.js';
import NotificationService from './notificationService.js';
import { awardReferralNkToken } from './referral-rewards.js';
import {
    getOperatorFees,
    getMaxPayinRate,
    computeVendorPayout
} from './flexpay-fees.service.js';

export const ORDER_STATUSES = {
    PENDING: 'PENDING',
    QUOTE: 'QUOTE',
    READY_FOR_PAYMENT: 'READY_FOR_PAYMENT',
    PAID_HELD: 'PAID_HELD',
    IN_DELIVERY: 'IN_DELIVERY',
    DELIVERED: 'DELIVERED',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    DISPUTE_OPEN: 'DISPUTE_OPEN',
    FROZEN: 'FROZEN',
    REFUNDED: 'REFUNDED'
};

export const DELIVERY_QUOTE_STATUSES = {
    PENDING: 'PENDING',
    ACCEPTED: 'ACCEPTED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED',
    EXPIRED: 'EXPIRED'
};

export const DELIVERY_STATUSES = {
    PENDING: 'PENDING',
    IN_TRANSIT: 'IN_TRANSIT',
    DELIVERED: 'DELIVERED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
    RESCHEDULED: 'RESCHEDULED'
};

export const ESCROW_STATUSES = {
    NONE: 'NONE',
    HELD: 'HELD',
    RELEASED: 'RELEASED',
    AUTO_RELEASED: 'AUTO_RELEASED',
    FROZEN: 'FROZEN',
    REFUNDED: 'REFUNDED'
};

export const ESCROW_EVENT_TYPES = {
    HELD: 'HELD',
    TIMER_STARTED: 'TIMER_STARTED',
    RELEASED: 'RELEASED',
    AUTO_RELEASED: 'AUTO_RELEASED',
    FROZEN: 'FROZEN',
    REFUNDED: 'REFUNDED',
    PARTIAL: 'PARTIAL',
    MANUAL_OVERRIDE: 'MANUAL_OVERRIDE'
};

export const DISPUTE_STATUSES = {
    OPEN: 'OPEN',
    SELLER_PENDING: 'SELLER_PENDING',
    BUYER_PENDING: 'BUYER_PENDING',
    UNDER_REVIEW: 'UNDER_REVIEW',
    RESOLVED: 'RESOLVED',
    REJECTED: 'REJECTED'
};

export const DISPUTE_REASONS = {
    NOT_RECEIVED: 'NOT_RECEIVED',
    DAMAGED: 'DAMAGED',
    NOT_AS_DESCRIBED: 'NOT_AS_DESCRIBED',
    OTHER: 'OTHER'
};

export const DISPUTE_RESOLUTIONS = {
    FULL_REFUND: 'FULL_REFUND',
    PARTIAL_REFUND: 'PARTIAL_REFUND',
    RELEASE_TO_SELLER: 'RELEASE_TO_SELLER'
};

export const DISPUTE_MESSAGE_TYPES = {
    MESSAGE: 'MESSAGE',
    OFFER: 'OFFER',
    EVIDENCE: 'EVIDENCE',
    SYSTEM: 'SYSTEM'
};

export const DISPUTE_VENDOR_ACTIONS = {
    ACCEPT_REFUND: 'ACCEPT_REFUND',
    OFFER_PARTIAL_REFUND: 'OFFER_PARTIAL_REFUND',
    CONTEST: 'CONTEST'
};

export const DISPUTE_BUYER_ACTIONS = {
    ACCEPT: 'ACCEPT',
    REJECT: 'REJECT'
};

export const DISPUTE_SELLER_RESPONSE_HOURS = 24;
export const DISPUTE_BUYER_RESPONSE_HOURS = 24;
export const DISPUTE_REVIEW_HOURS = 72;

export const MAX_OTP_ATTEMPTS = 5;
export const ESCROW_HOLD_HOURS = 24; // Délai post-livraison : 24h avant libération automatique de l'escrow

export const LEGACY_ORDER_STATUS_MAP = {
    SHIPPED: ORDER_STATUSES.IN_DELIVERY,
    RELEASED: ORDER_STATUSES.COMPLETED,
    DISPUTED: ORDER_STATUSES.DISPUTE_OPEN,
    'PAYÉ': ORDER_STATUSES.PAID_HELD
};

const ORDER_TRANSITIONS = {
    [ORDER_STATUSES.PENDING]: [ORDER_STATUSES.QUOTE, ORDER_STATUSES.CANCELLED],
    [ORDER_STATUSES.QUOTE]: [ORDER_STATUSES.READY_FOR_PAYMENT, ORDER_STATUSES.CANCELLED],
    [ORDER_STATUSES.READY_FOR_PAYMENT]: [ORDER_STATUSES.PAID_HELD, ORDER_STATUSES.CANCELLED],
    [ORDER_STATUSES.PAID_HELD]: [ORDER_STATUSES.IN_DELIVERY, ORDER_STATUSES.DISPUTE_OPEN, ORDER_STATUSES.FROZEN, ORDER_STATUSES.CANCELLED],
    [ORDER_STATUSES.IN_DELIVERY]: [ORDER_STATUSES.DELIVERED, ORDER_STATUSES.CANCELLED, ORDER_STATUSES.DISPUTE_OPEN, ORDER_STATUSES.FROZEN],
    [ORDER_STATUSES.DELIVERED]: [ORDER_STATUSES.COMPLETED, ORDER_STATUSES.DISPUTE_OPEN, ORDER_STATUSES.FROZEN],
    [ORDER_STATUSES.DISPUTE_OPEN]: [ORDER_STATUSES.FROZEN, ORDER_STATUSES.COMPLETED, ORDER_STATUSES.REFUNDED, ORDER_STATUSES.CANCELLED],
    [ORDER_STATUSES.FROZEN]: [ORDER_STATUSES.COMPLETED, ORDER_STATUSES.REFUNDED, ORDER_STATUSES.CANCELLED],
    [ORDER_STATUSES.COMPLETED]: [],
    [ORDER_STATUSES.CANCELLED]: [],
    [ORDER_STATUSES.REFUNDED]: []
};

export function mapLegacyOrderStatus(status) {
    return LEGACY_ORDER_STATUS_MAP[status] || status;
}

export function canTransitionOrder(fromStatus, toStatus) {
    const from = mapLegacyOrderStatus(fromStatus);
    const to = mapLegacyOrderStatus(toStatus);
    return !!ORDER_TRANSITIONS[from]?.includes(to);
}

export function getOrderCustomerId(order) {
    return order?.user_id || order?.customer_id || null;
}

export function getOrderVendorId(order) {
    if (order?.vendor_id) return order.vendor_id;
    const firstVendorId = Array.isArray(order?.items)
        ? order.items.find((item) => item?.vendor_id)?.vendor_id
        : null;
    return firstVendorId || null;
}

export function isCustomerActor(order, user) {
    return !!user?.id && getOrderCustomerId(order) === user.id;
}

export function isVendorActor(order, user) {
    return !!user?.id && getOrderVendorId(order) === user.id;
}

export function generateOrderId() {
    return `ORD_${crypto.randomBytes(5).toString('hex').toUpperCase()}_${Date.now()}`;
}

export function generateTransactionId() {
    return `NK_${crypto.randomBytes(5).toString('hex').toUpperCase()}_${Date.now()}`;
}

export function generateOtpCode() {
    return `${Math.floor(100000 + Math.random() * 900000)}`;
}

export function computeEscrowReleaseAt(fromDate = new Date(), hours = ESCROW_HOLD_HOURS) {
    const h = (Number.isFinite(hours) && hours >= 1) ? hours : ESCROW_HOLD_HOURS;
    return new Date(new Date(fromDate).getTime() + h * 60 * 60 * 1000).toISOString();
}

export function addHours(fromDate, hours) {
    return new Date(new Date(fromDate).getTime() + hours * 60 * 60 * 1000).toISOString();
}

export async function logOrderStatusHistory(client, { orderId, previousStatus, newStatus, changedBy, notes = null }) {
    try {
        await client
            .from('order_status_history')
            .insert({
                order_id: orderId,
                previous_status: previousStatus,
                new_status: newStatus,
                changed_by: changedBy || 'system',
                notes,
                changed_at: new Date().toISOString()
            });
    } catch (error) {
        console.warn('[OrderHistory] Could not log status change:', error.message);
    }
}

export async function createEscrowEvent(client, { orderId, eventType, amount = null, metadata = {}, processedAt = null }) {
    try {
        await client
            .from('escrow_events')
            .insert({
                order_id: orderId,
                event_type: eventType,
                amount,
                metadata,
                processed_at: processedAt
            });
    } catch (error) {
        console.warn('[EscrowEvent] Could not create event:', error.message);
    }
}

async function fetchVendorPayoutDetails(client, vendorId) {
    if (!vendorId) return null;

    // Récupérer les infos du vendeur
    const { data: vendor } = await client
        .from('users')
        .select('id, email, name')
        .eq('id', vendorId)
        .single();

    if (!vendor) return null;

    // Récupérer la méthode de paiement par défaut
    const { data: methods } = await client
        .from('vendor_payout_methods')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('is_default', { ascending: false })
        .limit(1);

    vendor.payout_method = (methods && methods.length > 0) ? methods[0] : null;
    return vendor;
}

export async function getCommissionRate(client) {
    const { data } = await client
        .from('settings')
        .select('platform_commission_rate')
        .eq('id', 'global-settings')
        .single();
    return parseFloat(data?.platform_commission_rate) || 5.0;
}

// Note: getPayoutFeeRate() supprimée — remplacée par flexpay-fees.service.js
// qui lit les taux depuis la table flexpay_operator_fees (par opérateur et devise).

async function attemptVendorPayoutTransfer(vendor, payoutAmount, orderId, currency) {
    if (!vendor?.payout_method) {
        return { status: 'manual', message: 'Aucun compte de réception configuré par le vendeur.' };
    }

    const method = vendor.payout_method;

    // FlexPay ou Mobile Money payout
    if (method.provider === 'FLEXPAY' || method.provider === 'MOBILE_MONEY') {
        try {
            const { isFlexpaieConfigured } = await import('./flexpaie.js');
            
            if (!isFlexpaieConfigured()) {
                return { status: 'manual', message: 'FlexPay API non configurée. Payout manuel requis.' };
            }

            // Ex: FLEXPAY-PAYOUT-ORDER-123
            const externalId = `FLEXPAY-PAYOUT-${orderId}`;
            const description = `Payout Vendeur pour commande ${orderId}`;
            const phone = method.account_id; // numéro de téléphone stocké
            
            // Mapper l'opérateur local vers le code Provider FlexPay attendu
            let flexpayProvider = method.operator.toUpperCase() + "_COD";
            const op = method.operator.toLowerCase();
            if (op === 'vodacom_mpesa' || op === 'mpesa') flexpayProvider = 'VODACOM_MPESA_COD';
            if (op === 'airtel') flexpayProvider = 'AIRTEL_COD';
            if (op === 'orange') flexpayProvider = 'ORANGE_COD';

            // TODO: Appeler l'API FlexPay de transfert quand les clés seront disponibles
            // await flexpaieTransfer({ to: phone, amount: payoutAmount, provider: flexpayProvider, externalId, description });
            return { status: 'manual', message: 'Transfert FlexPay en attente de configuration API.' };
        } catch (error) {
            console.error('[FlexPay Payout Error]', error.message);
            return { status: 'failed', message: `Erreur FlexPay: ${error.message}` };
        }
    }

    // FlexPaie payout (sera activé avec les clés)
    if (method.provider === 'flexpaie') {
        try {
            const { isFlexpaieConfigured } = await import('./flexpaie.js');
            if (!isFlexpaieConfigured()) {
                return { status: 'manual', message: 'FlexPaie non configuré. Payout manuel requis.' };
            }
            // TODO: Appeler l'API FlexPaie de transfert quand les clés seront disponibles
            // await flexpaieTransfer({ to: method.account_id, amount: payoutAmount, name: method.account_name });
            return { status: 'manual', message: 'Transfert FlexPaie en attente de configuration API.' };
        } catch {
            return { status: 'manual', message: 'Erreur lors du transfert FlexPaie.' };
        }
    }


    return { status: 'manual', message: 'Fournisseur de paiement non supporté pour le payout automatique.' };
}

export async function releaseOrderEscrow({
    client = supabaseAdmin || supabase,
    order,
    initiatedBy = 'system',
    autoRelease = false,
    force = false,
    isDeferredPayout = false
}) {
    const normalizedStatus = mapLegacyOrderStatus(order?.status);

    if (normalizedStatus !== ORDER_STATUSES.DELIVERED && !force && !isDeferredPayout) {
        throw new Error('Les fonds ne peuvent être libérés que pour une commande livrée.');
    }

    if (autoRelease && order.escrow_release_at && new Date(order.escrow_release_at) > new Date()) {
        throw new Error('Le délai de séquestre n\'est pas encore expiré.');
    }

    // FlexPay a mis à jour ses payouts : désormais instantanés.
    // Le délai de clearance 72h n'est plus nécessaire.
    const fundsCleared = true;

    const nextEscrowStatus = autoRelease ? ESCROW_STATUSES.AUTO_RELEASED : ESCROW_STATUSES.RELEASED;
    const releaseEventType = autoRelease ? ESCROW_EVENT_TYPES.AUTO_RELEASED : ESCROW_EVENT_TYPES.RELEASED;
    const nowIso = new Date().toISOString();

    // Note: le bloc DEFERRED_CLEARANCE a été supprimé.
    // FlexPay gère maintenant les payouts en temps réel.

    const vendor = await fetchVendorPayoutDetails(client, getOrderVendorId(order));

    // ─── Calcul commission NewKet + frais payout FlexPay (par opérateur vendeur) ───
    const commissionRate  = await getCommissionRate(client);
    const currency        = String(order.payment_expected_currency || 'USD').toUpperCase();

    // Récupérer l'opérateur du vendeur depuis sa méthode de payout par défaut
    const payoutOperator  = vendor?.payout_method?.operator || null;

    // Frais payout : taux exact si opérateur connu, sinon taux max (pire cas)
    let payoutFeeRate = 0;
    if (payoutOperator) {
        const operatorFees = await getOperatorFees(client, currency, payoutOperator);
        payoutFeeRate = operatorFees?.payout_rate ?? 0;
    } else {
        // Opérateur inconnu → taux max pour ne pas absorber de perte
        const maxRate = await getMaxPayinRate(client, currency);
        payoutFeeRate = maxRate.rate;
        console.warn(`[Escrow] Opérateur vendeur inconnu pour commande ${order.id}. Taux max ${payoutFeeRate}% appliqué.`);
    }

    const totalAmount = parseFloat(order.total_amount || order.total || 0);

    // computeVendorPayout : baseAmount - commission - frais payout sur le brut
    const payoutCalc = computeVendorPayout(totalAmount, commissionRate, payoutFeeRate);
    const { commissionAmount, payoutFeeAmount, vendorPayout: payoutAmount } = payoutCalc;

    let transfer = { status: 'manual', message: 'Transfert automatique non disponible.' };

    try {
        transfer = await attemptVendorPayoutTransfer(vendor, payoutAmount, order.id, currency);
    } catch (error) {
        console.error('[Escrow] Transfer error:', error.message);
        transfer = { status: 'failed', message: error.message };
    }

    // ─── Déterminer le statut du payout ───
    const payoutStatus    = transfer.status === 'failed' ? 'FAILED' : (transfer.status === 'success' ? 'SUCCESS' : 'PENDING');
    const currentAttempts = parseInt(order.payout_attempts || 0, 10);

    const updatePayload = {
        updated_at: nowIso,
        platform_commission_amount: commissionAmount,
        payout_withdrawal_fee_amount: payoutFeeAmount,
        payout_fee_rate: payoutFeeRate,
        payout_operator: payoutOperator,
        payout_amount: payoutAmount,
        payout_status: payoutStatus,
        payout_attempts: currentAttempts + 1,
        payout_last_error: transfer.status === 'failed' ? transfer.message : null
    };

    // Si on fait le payout dans le flux normal (pas différé)
    if (!isDeferredPayout) {
        updatePayload.status = ORDER_STATUSES.COMPLETED;
        updatePayload.escrow_status = nextEscrowStatus;
        updatePayload.released_at = nowIso;
        updatePayload.completed_at = nowIso;
    }

    const { data: updatedOrder, error } = await client
        .from('orders')
        .update(updatePayload)
        .eq('id', order.id)
        .select('*')
        .single();

    if (error) throw error;

    if (!isDeferredPayout) {
        await createEscrowEvent(client, {
            orderId: order.id,
            eventType: releaseEventType,
            amount: totalAmount,
            metadata: {
                transfer_status: transfer.status,
                transfer_message: transfer.message,
                initiated_by: initiatedBy,
                currency,
                commission_rate: commissionRate,
                commission_amount: commissionAmount,
                payout_operator: payoutOperator,
                payout_fee_rate: payoutFeeRate,
                payout_fee_amount: payoutFeeAmount,
                payout_gross: payoutCalc.payoutGross,
                payout_amount: payoutAmount
            },
            processedAt: nowIso
        });

        await logOrderStatusHistory(client, {
            orderId: order.id,
            previousStatus: normalizedStatus,
            newStatus: ORDER_STATUSES.COMPLETED,
            changedBy: initiatedBy,
            notes: autoRelease ? 'Auto release after escrow delay' : 'Escrow released'
        });

        try {
            await awardReferralNkToken({
                client,
                inviteeId: updatedOrder.customer_id || updatedOrder.user_id || null,
                orderId: updatedOrder.id,
                rewardAmount: 1
            });
        } catch (rewardError) {
            console.warn('[ReferralReward] Could not grant NKToken reward:', rewardError.message);
        }
    } else {
        // Enregistrement spécifique au traitement différé
        await createEscrowEvent(client, {
            orderId: order.id,
            eventType: 'PAYOUT_PROCESSED',
            amount: totalAmount,
            metadata: {
                transfer_status: transfer.status,
                transfer_message: transfer.message,
                initiated_by: initiatedBy,
                currency,
                commission_rate: commissionRate,
                commission_amount: commissionAmount,
                payout_operator: payoutOperator,
                payout_fee_rate: payoutFeeRate,
                payout_fee_amount: payoutFeeAmount,
                payout_gross: payoutCalc.payoutGross,
                payout_amount: payoutAmount
            },
            processedAt: nowIso
        });
    }

    if (transfer.status === 'manual') {
        await NotificationService.notifyVendorManualPayout(updatedOrder);
    }

    return { order: updatedOrder, transfer };
}

export async function releaseDueEscrowsJob() {
    const client = supabaseAdmin || supabase;
    const nowIso = new Date().toISOString();

    const { data: dueOrders, error } = await client
        .from('orders')
        .select('*')
        .eq('status', ORDER_STATUSES.DELIVERED)
        .lte('escrow_release_at', nowIso);

    if (error) {
        console.error('[EscrowJob] Failed to query due escrows:', error.message);
        return { processed: 0, failed: 0 };
    }

    let processed = 0;
    let failed = 0;

    for (const order of dueOrders || []) {
        try {
            await releaseOrderEscrow({
                client,
                order,
                initiatedBy: 'escrow-job',
                autoRelease: true
            });
            processed += 1;
        } catch (jobError) {
            failed += 1;
            console.error(`[EscrowJob] Failed for order ${order.id}:`, jobError.message);
        }
    }

    return { processed, failed };
}

// processDeferredPayoutsJob supprimé : FlexPay payout est maintenant instantané.
// Le délai de clearance 72h n'est plus nécessaire.
