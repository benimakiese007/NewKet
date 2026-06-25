import crypto from 'crypto';
import { supabaseAdmin, supabase } from '../config/supabase.js';
import NotificationService from './notificationService.js';
import { awardReferralNkToken } from './referral-rewards.js';

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

export function computeEscrowReleaseAt(fromDate = new Date()) {
    return new Date(new Date(fromDate).getTime() + ESCROW_HOLD_HOURS * 60 * 60 * 1000).toISOString();
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

async function getCommissionRate(client) {
    const { data } = await client
        .from('settings')
        .select('platform_commission_rate')
        .eq('id', 'global-settings')
        .single();
    return parseFloat(data?.platform_commission_rate) || 5.0;
}

async function attemptVendorPayoutTransfer(vendor, payoutAmount) {
    if (!vendor?.payout_method) {
        return { status: 'manual', message: 'Aucun compte de réception configuré par le vendeur.' };
    }

    const method = vendor.payout_method;

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

    // Stripe Connect payout
    if (method.provider === 'stripe') {
        try {
            const { isStripeConfigured } = await import('./stripe.js');
            if (!isStripeConfigured()) {
                return { status: 'manual', message: 'Stripe non configuré. Payout manuel requis.' };
            }
            // TODO: Utiliser Stripe Connect Transfer quand les comptes Connect seront configurés
            return { status: 'manual', message: 'Stripe Connect payout en attente de configuration.' };
        } catch {
            return { status: 'manual', message: 'Erreur lors du transfert Stripe.' };
        }
    }

    return { status: 'manual', message: 'Fournisseur de paiement non supporté pour le payout.' };
}

export async function releaseOrderEscrow({
    client = supabaseAdmin || supabase,
    order,
    initiatedBy = 'system',
    autoRelease = false,
    force = false
}) {
    const normalizedStatus = mapLegacyOrderStatus(order?.status);

    if (normalizedStatus !== ORDER_STATUSES.DELIVERED && !force) {
        throw new Error('Les fonds ne peuvent être libérés que pour une commande livrée.');
    }

    if (autoRelease && order.escrow_release_at && new Date(order.escrow_release_at) > new Date()) {
        throw new Error('Le délai de séquestre n\'est pas encore expiré.');
    }

    const vendor = await fetchVendorPayoutDetails(client, getOrderVendorId(order));

    // ─── Calcul de la commission ───
    const commissionRate = await getCommissionRate(client);
    const totalAmount = parseFloat(order.total_amount || order.total || 0);
    const commissionAmount = Math.round(totalAmount * commissionRate) / 100;
    const payoutAmount = Math.round((totalAmount - commissionAmount) * 100) / 100;

    let transfer = { status: 'manual', message: 'Transfert automatique non disponible.' };

    try {
        transfer = await attemptVendorPayoutTransfer(vendor, payoutAmount);
    } catch (error) {
        console.error('[Escrow] Transfer error:', error.message);
        transfer = { status: 'failed', message: error.message };
    }

    // ─── Déterminer le statut du payout ───
    const payoutStatus = transfer.status === 'failed' ? 'FAILED' : (transfer.status === 'success' ? 'SUCCESS' : 'PENDING');
    const currentAttempts = parseInt(order.payout_attempts || 0, 10);

    const nextEscrowStatus = autoRelease ? ESCROW_STATUSES.AUTO_RELEASED : ESCROW_STATUSES.RELEASED;
    const releaseEventType = autoRelease ? ESCROW_EVENT_TYPES.AUTO_RELEASED : ESCROW_EVENT_TYPES.RELEASED;
    const nowIso = new Date().toISOString();

    const { data: updatedOrder, error } = await client
        .from('orders')
        .update({
            status: ORDER_STATUSES.COMPLETED,
            escrow_status: nextEscrowStatus,
            released_at: nowIso,
            completed_at: nowIso,
            updated_at: nowIso,
            platform_commission_amount: commissionAmount,
            payout_amount: payoutAmount,
            payout_status: payoutStatus,
            payout_attempts: currentAttempts + 1,
            payout_last_error: transfer.status === 'failed' ? transfer.message : null
        })
        .eq('id', order.id)
        .select('*')
        .single();

    if (error) throw error;

    await createEscrowEvent(client, {
        orderId: order.id,
        eventType: releaseEventType,
        amount: totalAmount,
        metadata: {
            transfer_status: transfer.status,
            transfer_message: transfer.message,
            initiated_by: initiatedBy,
            commission_rate: commissionRate,
            commission_amount: commissionAmount,
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
