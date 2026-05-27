import crypto from 'crypto';
import { supabaseAdmin, supabase } from '../config/supabase.js';
import NotificationService from './notificationService.js';

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
export const ESCROW_HOLD_HOURS = 72;

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
    const { data } = await client
        .from('users')
        .select('id, email, name, bank_code, account_number, mobile_money_number')
        .eq('id', vendorId)
        .single();
    return data || null;
}

async function attemptVendorPayoutTransfer(vendor) {
    // Provider payout is still not wired: keep escrow release working with manual payout until NewKet decides to automate vendor transfers.
    if (!vendor || (!vendor.account_number && !vendor.mobile_money_number)) {
        return { status: 'manual', message: 'Transfert automatique non disponible (coordonnées vendeur manquantes).' };
    }

    return { status: 'manual', message: 'Transfert automatique non activé. Paiement vendeur à traiter manuellement.' };
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
    let transfer = { status: 'manual', message: 'Transfert automatique non disponible.' };

    try {
        transfer = await attemptVendorPayoutTransfer(vendor);
    } catch (error) {
        console.error('[Escrow] Transfer error:', error.message);
        transfer = { status: 'manual', message: 'Erreur transfert automatique, traitement manuel requis.' };
    }

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
            updated_at: nowIso
        })
        .eq('id', order.id)
        .select('*')
        .single();

    if (error) throw error;

    await createEscrowEvent(client, {
        orderId: order.id,
        eventType: releaseEventType,
        amount: order.total_amount,
        metadata: {
            transfer_status: transfer.status,
            transfer_message: transfer.message,
            initiated_by: initiatedBy
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
