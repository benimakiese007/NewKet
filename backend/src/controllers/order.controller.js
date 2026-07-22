import { supabaseAdmin, supabase } from '../config/supabase.js';
import NotificationService from '../services/notificationService.js';
import {
    ORDER_STATUSES,
    DELIVERY_QUOTE_STATUSES,
    DELIVERY_STATUSES,
    ESCROW_STATUSES,
    ESCROW_EVENT_TYPES,
    MAX_OTP_ATTEMPTS,
    canTransitionOrder,
    createEscrowEvent,
    generateOrderId,
    generateOtpCode,
    getOrderCustomerId,
    getOrderVendorId,
    isCustomerActor,
    isVendorActor,
    logOrderStatusHistory,
    mapLegacyOrderStatus,
    releaseOrderEscrow,
    addHours
} from '../services/order-workflow.js';
import { awardReferralNkToken } from '../services/referral-rewards.js';

const client = supabaseAdmin || supabase;

function isAdminActor(user) {
    const role = user?.app_metadata?.role || user?.user_metadata?.role || '';
    return role === 'admin';
}

function toFiniteNumber(value, fallback = 0) {
    const normalized = typeof value === 'string' ? value.replace(',', '.').trim() : value;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableNumber(value) {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function assertOrderMutableOrFail({ order, user, res, actionLabel }) {
    if (!order) return false;

    if (order.payment_locked_at) {
        if (isAdminActor(user)) return true;
        res.status(409).json({ error: `Commande verrouill\u00E9e (paiement en cours): action "${actionLabel}" impossible.` });
        return false;
    }

    if (order.status === ORDER_STATUSES.CANCELLED) {
        if (isAdminActor(user)) return true;
        res.status(409).json({ error: `Commande annul\u00E9e: action "${actionLabel}" impossible.` });
        return false;
    }

    return true;
}

async function restoreStockIfNeeded(order) {
    if (!order?.stock_deducted_at) return;

    const items = order?.items || [];
    const validItems = items.filter(i => i?.product_id);
    if (validItems.length === 0) return;

    try {
        const productIds = validItems.map(i => i.product_id);
        const { data: products } = await client
            .from('products')
            .select('id, stock')
            .in('id', productIds);

        if (!products || products.length === 0) return;

        const updates = products.map(product => {
            const item = validItems.find(i => i.product_id === product.id);
            if (!item || product.stock === undefined || product.stock === null) return null;
            return client
                .from('products')
                .update({ stock: product.stock + (item.quantity || 1) })
                .eq('id', product.id);
        }).filter(Boolean);

        await Promise.allSettled(updates);
    } catch (error) {
        console.error('[Order] Stock restore error:', error.message);
    }
}

async function fetchOrderOr404(orderId, res) {
    const { data: order, error } = await client
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

    if (error || !order) {
        res.status(404).json({ error: 'Commande introuvable' });
        return null;
    }

    order.status = mapLegacyOrderStatus(order.status);

    if (order.status === ORDER_STATUSES.PAID_HELD && !String(order.otp_code || '').trim()) {
        const otpCode = generateOtpCode();
        const { error: otpUpdateError } = await client
            .from('orders')
            .update({
                otp_code: otpCode,
                otp_attempts: 0,
                updated_at: new Date().toISOString()
            })
            .eq('id', order.id);

        if (!otpUpdateError) {
            order.otp_code = otpCode;
        } else {
            console.warn('[Order] Could not backfill OTP code:', otpUpdateError.message);
        }
    }

    return order;
}

async function createOrUpdateDeliveryRecord(orderId, vendorId, patch = {}) {
    const { data: existing } = await client
        .from('deliveries')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();

    if (existing?.id) {
        const { data } = await client
            .from('deliveries')
            .update({
                ...patch,
                vendor_id: vendorId || existing.vendor_id,
                updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)
            .select('*')
            .single();
        return data;
    }

    const { data } = await client
        .from('deliveries')
        .insert({
            order_id: orderId,
            vendor_id: vendorId,
            ...patch
        })
        .select('*')
        .single();

    return data;
}

export const createOrder = async (req, res) => {
    try {
        const productId = String(req.body?.product_id || '').trim();
        const vendorIdFromBody = String(req.body?.vendor_id || '').trim();
        const quantity = Math.max(1, parseInt(req.body?.quantity, 10) || 1);
        const customerPhone = String(req.body?.customer_phone || '').trim() || null;
        const customerName = String(req.body?.customer_name || req.user?.user_metadata?.full_name || req.user?.user_metadata?.name || 'Client NewKet').trim();
        const customerEmail = String(req.body?.customer_email || req.user?.email || '').trim() || null;
        const customerCity = String(req.body?.customer_city || '').trim() || null;
        const customerLat = toNullableNumber(req.body?.customer_lat);
        const customerLng = toNullableNumber(req.body?.customer_lng);

        if (!productId) {
            return res.status(400).json({ success: false, error: 'product_id est requis.' });
        }

        const { data: product, error: productError } = await client
            .from('products')
            .select('id, name, price, old_price, image, category, user_id, supplier_email')
            .eq('id', productId)
            .maybeSingle();

        if (productError) throw productError;
        if (!product) {
            return res.status(404).json({ success: false, error: 'Produit introuvable.' });
        }

        if (!customerEmail) {
            return res.status(400).json({ success: false, error: 'customer_email est requis.' });
        }

        const vendorId = vendorIdFromBody || product.user_id || null;
        const unitPrice = toFiniteNumber(product.price ?? req.body?.price ?? product.old_price, 0);
        const totalAmount = Number((unitPrice * quantity).toFixed(2));
        const nowIso = new Date().toISOString();

        const orderPayload = {
            id: generateOrderId(),
            status: ORDER_STATUSES.PENDING,
            payment_status: 'N/A',
            payment_provider: null,
            payment_expected_amount: null,
            payment_expected_currency: null,
            payment_locked_at: null,
            payment_lock_reason: null,
            transaction_id: null,
            user_id: req.user?.id || null,
            customer_id: req.user?.id || null,
            vendor_id: vendorId,
            items: [{
                product_id: product.id,
                vendor_id: vendorId,
                price: unitPrice,
                name: product.name,
                quantity,
                category: product.category || null,
                image: String(product.image || '').split(',')[0] || null,
                supplier_email: product.supplier_email || null
            }],
            total: totalAmount,
            total_amount: totalAmount,
            merchandise_amount: totalAmount,
            subtotal_amount: totalAmount,
            delivery_fee_amount: 0,
            final_total_amount: totalAmount,
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone,
            customer_city: customerCity,
            customer_lat: customerLat,
            customer_lng: customerLng,
            phone_number: customerPhone,
            escrow_status: ESCROW_STATUSES.NONE,
            proof_status: 'PENDING',
            updated_at: nowIso
        };

        const { data: createdOrder, error: insertError } = await client
            .from('orders')
            .insert(orderPayload)
            .select('*')
            .single();

        if (insertError) throw insertError;

        await logOrderStatusHistory(client, {
            orderId: createdOrder.id,
            previousStatus: null,
            newStatus: ORDER_STATUSES.PENDING,
            changedBy: req.user?.id || 'system',
            notes: 'Order created from checkout'
        });

        NotificationService.notifyVendorOrderRequest(createdOrder).catch((error) => {
            console.error('[OrderController] notifyVendorOrderRequest error:', error.message);
        });

        return res.status(201).json({
            success: true,
            order_id: createdOrder.id,
            order: createdOrder
        });
    } catch (error) {
        console.error('❌ Erreur createOrder:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Impossible de créer la commande.'
        });
    }
};

export const getOrders = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.max(1, Math.min(60, parseInt(req.query.limit, 10) || 50));
        const offset = (page - 1) * limit;
        const userId = req.user?.id || null;

        let query = client
            .from('orders')
            .select(`
                id, status, created_at, total, total_amount, merchandise_amount, subtotal_amount,
                delivery_fee_amount, promo_id, promo_code, promo_discount_amount, final_total_amount,
                customer_name, customer_email, customer_phone, 
                customer_city, customer_lat, customer_lng, phone_number, items, 
                payment_status, transaction_id, user_id, customer_id, vendor_id, 
                escrow_status, escrow_release_at, proof_status, otp_code, 
                accepted_delivery_quote_id,
                customer:users!customer_id(id, name, avatar)
            `)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (!isAdminActor(req.user)) {
            const role = req.user?.app_metadata?.role || req.user?.user_metadata?.role || 'customer';
            if (role === 'supplier') {
                // A vendor can also buy: return both vendor-side and customer-side orders.
                query = query.or(
                    `vendor_id.eq.${userId},customer_id.eq.${userId},user_id.eq.${userId},customer_email.eq.${req.user?.email || ''}`
                );
            } else {
                query = query.or(`customer_id.eq.${userId},user_id.eq.${userId},customer_email.eq.${req.user?.email || ''}`);
            }
        }

        const { data, error } = await query;

        if (error) {
            console.warn('⚠️ orders table query failed:', error.message);
            return res.status(200).json([]);
        }

        const orderIds = (data || []).map((order) => order.id);
        const vendorIds = [...new Set((data || []).map((order) => order.vendor_id).filter(Boolean))];
        let quotesByOrderId = new Map();
        let vendorsById = new Map();

        if (vendorIds.length > 0) {
            const { data: vendors, error: vendorsError } = await client
                .from('users')
                .select('id, name, company_name, email')
                .in('id', vendorIds);

            if (vendorsError) {
                console.warn('⚠️ vendor users query failed:', vendorsError.message);
            } else {
                vendorsById = new Map((vendors || []).map((vendor) => [vendor.id, vendor]));
            }
        }

        if (orderIds.length > 0) {
            const { data: quotes } = await client
                .from('delivery_quotes')
                .select('*')
                .in('order_id', orderIds)
                .order('created_at', { ascending: false });

            for (const quote of quotes || []) {
                if (!quotesByOrderId.has(quote.order_id)) {
                    quotesByOrderId.set(quote.order_id, quote);
                }
            }
        }

        return res.status(200).json((data || []).map((order) => ({
            ...order,
            vendor: vendorsById.get(order.vendor_id) || null,
            status: mapLegacyOrderStatus(order.status),
            latest_delivery_quote: quotesByOrderId.get(order.id) || null
        })));
    } catch (error) {
        console.error('❌ Erreur getOrders:', error.message);
        return res.status(200).json([]);
    }
};

export const createDeliveryQuote = async (req, res) => {
    try {
        const { id } = req.params;
        const { delivery_fee_amount, estimated_delay_hours, note, expires_at } = req.body;

        if (delivery_fee_amount === undefined || !estimated_delay_hours) {
            return res.status(400).json({ error: 'delivery_fee_amount et estimated_delay_hours sont requis.' });
        }

        const order = await fetchOrderOr404(id, res);
        if (!order) return;
        if (!assertOrderMutableOrFail({ order, user: req.user, res, actionLabel: 'verify-delivery-otp' })) return;
        if (!assertOrderMutableOrFail({ order, user: req.user, res, actionLabel: 'respond-delivery-quote' })) return;
        if (!assertOrderMutableOrFail({ order, user: req.user, res, actionLabel: 'create-delivery-quote' })) return;

        if (!isVendorActor(order, req.user)) {
            return res.status(403).json({ error: 'Seul le vendeur de cette commande peut proposer la livraison.' });
        }

        if (![ORDER_STATUSES.PENDING, ORDER_STATUSES.QUOTE].includes(order.status)) {
            return res.status(400).json({ error: `Impossible de proposer une livraison depuis le statut ${order.status}.` });
        }

        await client
            .from('delivery_quotes')
            .update({
                status: DELIVERY_QUOTE_STATUSES.CANCELLED,
                responded_at: new Date().toISOString()
            })
            .eq('order_id', id)
            .eq('status', DELIVERY_QUOTE_STATUSES.PENDING);

        const { data: quote, error: quoteError } = await client
            .from('delivery_quotes')
            .insert({
                order_id: id,
                vendor_id: getOrderVendorId(order),
                delivery_fee_amount: Number(delivery_fee_amount),
                estimated_delay_hours: parseInt(estimated_delay_hours, 10),
                note: note || null,
                expires_at: expires_at || null
            })
            .select('*')
            .single();

        if (quoteError) throw quoteError;

        const previousStatus = order.status;
        const { data: updatedOrder, error: updateError } = await client
            .from('orders')
            .update({
                status: ORDER_STATUSES.QUOTE,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select('*')
            .single();

        if (updateError) throw updateError;

        await logOrderStatusHistory(client, {
            orderId: id,
            previousStatus,
            newStatus: ORDER_STATUSES.QUOTE,
            changedBy: req.user.id,
            notes: 'Delivery quote proposed'
        });

        NotificationService.notifyCustomerQuoteAvailable(updatedOrder, quote);

        return res.status(201).json({ success: true, order: updatedOrder, quote });
    } catch (error) {
        console.error('❌ Erreur createDeliveryQuote:', error.message);
        return res.status(500).json({ error: 'Impossible de créer le devis de livraison.' });
    }
};

export const respondToDeliveryQuote = async (req, res) => {
    try {
        const { id } = req.params;
        const { action, quote_id } = req.body;

        if (!['ACCEPT', 'REJECT'].includes(action)) {
            return res.status(400).json({ error: 'action doit être ACCEPT ou REJECT.' });
        }

        const order = await fetchOrderOr404(id, res);
        if (!order) return;

        if (!isCustomerActor(order, req.user)) {
            return res.status(403).json({ error: 'Seul le client peut répondre au devis.' });
        }

        const quoteQuery = client
            .from('delivery_quotes')
            .select('*')
            .eq('order_id', id)
            .eq('status', DELIVERY_QUOTE_STATUSES.PENDING)
            .order('created_at', { ascending: false })
            .limit(1);

        const { data: quotes, error: quoteError } = quote_id
            ? await quoteQuery.eq('id', quote_id)
            : await quoteQuery;

        const quote = Array.isArray(quotes) ? quotes[0] : quotes;

        if (quoteError || !quote) {
            return res.status(404).json({ error: 'Aucun devis de livraison en attente.' });
        }

        const nowIso = new Date().toISOString();
        const quoteStatus = action === 'ACCEPT' ? DELIVERY_QUOTE_STATUSES.ACCEPTED : DELIVERY_QUOTE_STATUSES.REJECTED;

        await client
            .from('delivery_quotes')
            .update({ status: quoteStatus, responded_at: nowIso })
            .eq('id', quote.id);

        let nextStatus = ORDER_STATUSES.CANCELLED;
        const updatePayload = {
            status: nextStatus,
            updated_at: nowIso,
            cancelled_at: action === 'REJECT' ? nowIso : null
        };

        if (action === 'ACCEPT') {
            nextStatus = ORDER_STATUSES.READY_FOR_PAYMENT;
            updatePayload.status = nextStatus;
            updatePayload.accepted_delivery_quote_id = quote.id;
            updatePayload.delivery_fee_amount = Number(quote.delivery_fee_amount || 0);
            updatePayload.subtotal_amount = Number(order.merchandise_amount || order.subtotal_amount || order.total || 0);
            updatePayload.promo_discount_amount = Number(order.promo_discount_amount || 0);
            updatePayload.total_amount = Math.max(
                0,
                updatePayload.subtotal_amount + Number(quote.delivery_fee_amount || 0) - updatePayload.promo_discount_amount
            );
            updatePayload.final_total_amount = updatePayload.total_amount;
            updatePayload.total = updatePayload.total_amount;
            updatePayload.cancelled_at = null;
        }

        const { data: updatedOrder, error: updateError } = await client
            .from('orders')
            .update(updatePayload)
            .eq('id', id)
            .select('*')
            .single();

        if (updateError) throw updateError;

        if (action === 'ACCEPT') {
            await createOrUpdateDeliveryRecord(id, getOrderVendorId(order), {
                status: DELIVERY_STATUSES.PENDING
            });
        }

        await logOrderStatusHistory(client, {
            orderId: id,
            previousStatus: order.status,
            newStatus: nextStatus,
            changedBy: req.user.id,
            notes: action === 'ACCEPT' ? 'Delivery quote accepted' : 'Delivery quote rejected'
        });

        return res.status(200).json({ success: true, order: updatedOrder, quote_status: quoteStatus });
    } catch (error) {
        console.error('❌ Erreur respondToDeliveryQuote:', error.message);
        return res.status(500).json({ error: 'Impossible de traiter la réponse au devis.' });
    }
};

export const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, force = false } = req.body;

        if (!Object.values(ORDER_STATUSES).includes(status)) {
            return res.status(400).json({ error: `Statut invalide. Valeurs autorisées : ${Object.values(ORDER_STATUSES).join(', ')}` });
        }

        const order = await fetchOrderOr404(id, res);
        if (!order) return;

        const previousStatus = order.status;
        const adminActor = isAdminActor(req.user);
        const vendorActor = isVendorActor(order, req.user);

        if (previousStatus === ORDER_STATUSES.CANCELLED && !adminActor) {
            return res.status(409).json({ error: 'Commande annulée: aucune modification possible.' });
        }

        if (!adminActor) {
            const vendorCanCancel = vendorActor
                && status === ORDER_STATUSES.CANCELLED
                && [ORDER_STATUSES.PENDING, ORDER_STATUSES.QUOTE, ORDER_STATUSES.READY_FOR_PAYMENT].includes(previousStatus);

            if (!vendorCanCancel) {
                return res.status(403).json({ error: 'Action non autorisée sur cette commande.' });
            }
        }

        if (!force && !canTransitionOrder(previousStatus, status)) {
            return res.status(400).json({ error: `Transition interdite: ${previousStatus} -> ${status}` });
        }

        const { data: updatedOrder, error } = await client
            .from('orders')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw error;

        if ([ORDER_STATUSES.CANCELLED, ORDER_STATUSES.REFUNDED].includes(status) &&
            ![ORDER_STATUSES.CANCELLED, ORDER_STATUSES.REFUNDED].includes(previousStatus)) {
            await restoreStockIfNeeded(order);
        }

        if (status === ORDER_STATUSES.COMPLETED && previousStatus !== ORDER_STATUSES.COMPLETED && previousStatus !== ORDER_STATUSES.REFUNDED) {
            try {
                await awardReferralNkToken({
                    client,
                    inviteeId: updatedOrder.customer_id || updatedOrder.user_id || getOrderCustomerId(updatedOrder),
                    orderId: updatedOrder.id,
                    rewardAmount: 1
                });
            } catch (rewardError) {
                console.warn('[ReferralReward] Could not grant NKToken reward on manual completion:', rewardError.message);
            }
        }

        await logOrderStatusHistory(client, {
            orderId: id,
            previousStatus,
            newStatus: status,
            changedBy: req.user?.id || 'system',
            notes: force ? 'Forced admin transition' : adminActor ? null : 'Vendor initiated transition'
        });

        return res.status(200).json({ success: true, order: updatedOrder });
    } catch (error) {
        console.error('❌ Erreur updateOrderStatus:', error.message);
        return res.status(500).json({ error: 'Failed to update order status' });
    }
};

export const markOrderInDelivery = async (req, res) => {
    try {
        const { id } = req.params;
        const { external_courier_name, external_courier_phone } = req.body;

        const order = await fetchOrderOr404(id, res);
        if (!order) return;
        if (!assertOrderMutableOrFail({ order, user: req.user, res, actionLabel: 'start-delivery' })) return;

        if (!isVendorActor(order, req.user)) {
            return res.status(403).json({ error: 'Seul le vendeur peut démarrer la livraison.' });
        }

        if (order.status !== ORDER_STATUSES.PAID_HELD) {
            return res.status(400).json({ error: `La commande doit être en ${ORDER_STATUSES.PAID_HELD} pour lancer la livraison.` });
        }

        const nowIso = new Date().toISOString();
        await createOrUpdateDeliveryRecord(id, getOrderVendorId(order), {
            status: DELIVERY_STATUSES.IN_TRANSIT,
            external_courier_name: external_courier_name || null,
            external_courier_phone: external_courier_phone || null,
            started_at: nowIso
        });

        const { data: updatedOrder, error } = await client
            .from('orders')
            .update({
                status: ORDER_STATUSES.IN_DELIVERY,
                in_delivery_at: nowIso,
                updated_at: nowIso
            })
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw error;

        await logOrderStatusHistory(client, {
            orderId: id,
            previousStatus: order.status,
            newStatus: ORDER_STATUSES.IN_DELIVERY,
            changedBy: req.user.id,
            notes: 'Delivery started'
        });

        return res.status(200).json({ success: true, order: updatedOrder });
    } catch (error) {
        console.error('❌ Erreur markOrderInDelivery:', error.message);
        return res.status(500).json({ error: 'Impossible de démarrer la livraison.' });
    }
};

export const verifyDelivery = async (req, res) => {
    try {
        const { id } = req.params;
        const { otp } = req.body;

        if (!otp) {
            return res.status(400).json({ error: 'Le code OTP est requis' });
        }

        const order = await fetchOrderOr404(id, res);
        if (!order) return;

        if (!isCustomerActor(order, req.user) && !isVendorActor(order, req.user)) {
            return res.status(403).json({ error: 'Accès non autorisé pour cette commande.' });
        }

        if (order.status !== ORDER_STATUSES.IN_DELIVERY) {
            return res.status(400).json({ error: `La commande n'est pas en cours de livraison (${ORDER_STATUSES.IN_DELIVERY}).` });
        }

        const { data: delivery, error: deliveryError } = await client
            .from('deliveries')
            .select('*')
            .eq('order_id', id)
            .maybeSingle();

        if (deliveryError) throw deliveryError;

        const currentAttempts = delivery?.otp_attempts || 0;
        const maxAttempts = delivery?.max_otp_attempts || MAX_OTP_ATTEMPTS;

        if (currentAttempts >= maxAttempts) {
            return res.status(429).json({ error: 'Nombre maximum de tentatives atteint. Contactez le support.' });
        }

        if (order.otp_code !== otp) {
            await createOrUpdateDeliveryRecord(id, getOrderVendorId(order), {
                otp_attempts: currentAttempts + 1,
                proof_status: currentAttempts + 1 >= maxAttempts ? 'FAILED' : 'PENDING'
            });

            const remaining = maxAttempts - currentAttempts - 1;
            return res.status(400).json({ error: `Code OTP invalide. ${remaining} tentative(s) restante(s).` });
        }

        const { data: rpcResult, error: rpcError } = await client.rpc('finalize_delivery_confirmation', {
            p_order_id: id,
            p_otp: otp
        });

        if (rpcError) throw rpcError;
        if (rpcResult?.success === false) {
            return res.status(400).json({ error: rpcResult.message || 'Impossible de confirmer la livraison.' });
        }

        const updatedOrder = rpcResult?.order || order;
        const nowIso = updatedOrder?.delivered_at || new Date().toISOString();

        await createOrUpdateDeliveryRecord(id, getOrderVendorId(order), {
            status: DELIVERY_STATUSES.DELIVERED,
            otp_attempts: 0,
            delivered_at: nowIso,
            otp_validated_at: nowIso,
            proof_status: 'OTP_VALIDATED'
        });

        await createEscrowEvent(client, {
            orderId: id,
            eventType: ESCROW_EVENT_TYPES.TIMER_STARTED,
            amount: updatedOrder.total_amount,
            metadata: { release_at: updatedOrder.escrow_release_at },
            processedAt: nowIso
        });

        await logOrderStatusHistory(client, {
            orderId: id,
            previousStatus: order.status,
            newStatus: ORDER_STATUSES.DELIVERED,
            changedBy: req.user.id,
            notes: 'OTP validated'
        });

        // Envoyer la demande d'avis à l'acheteur
        NotificationService.notifyCustomerReview(updatedOrder).catch(console.error);

        // T+0 : Notif escrow timer démarré (client + vendeur)
        NotificationService.notifyEscrowTimerStarted(updatedOrder).catch((err) => {
            console.error('[Order] notifyEscrowTimerStarted error:', err.message);
        });

        // T+12h : Planifier le rappel mi-timer (email + notif DB) via push_notification_jobs
        // Le cron pickup existant (toutes les 15min) traitera ce job au bon moment.
        const reminderAt = addHours(updatedOrder.delivered_at || nowIso, 12);
        supabaseAdmin
            .from('push_notification_jobs')
            .insert({
                notification: {
                    _type: 'escrow_reminder',
                    order_id: updatedOrder.id
                },
                status: 'queued',
                available_at: reminderAt
            })
            .then(({ error }) => {
                if (error) console.warn('[Order] Could not schedule escrow reminder job:', error.message);
                else console.log(`[Order] Escrow reminder scheduled at ${reminderAt} for order ${updatedOrder.id}`);
            })
            .catch((err) => {
                console.warn('[Order] Could not schedule escrow reminder job:', err.message);
            });

        return res.status(200).json({ success: true, message: 'Livraison valid\u00E9e avec succ\u00E8s', order: updatedOrder });
    } catch (error) {
        console.error('❌ Erreur verifyDelivery:', error.message);
        return res.status(500).json({ error: 'Failed to verify delivery' });
    }
};

export const confirmOrderCompletion = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await fetchOrderOr404(id, res);
        if (!order) return;
        if (!assertOrderMutableOrFail({ order, user: req.user, res, actionLabel: 'confirm-completion' })) return;

        if (!isCustomerActor(order, req.user)) {
            return res.status(403).json({ error: 'Seul le client peut confirmer la commande.' });
        }

        if (order.status !== ORDER_STATUSES.DELIVERED) {
            return res.status(400).json({ error: `La commande doit être en ${ORDER_STATUSES.DELIVERED} pour être confirmée.` });
        }

        const result = await releaseOrderEscrow({
            client,
            order,
            initiatedBy: req.user.id,
            autoRelease: false,
            force: true
        });

        return res.status(200).json({
            success: true,
            message: 'Commande confirmée et fonds libérés.',
            order: result.order,
            transfer: result.transfer
        });
    } catch (error) {
        console.error('❌ Erreur confirmOrderCompletion:', error.message);
        return res.status(500).json({ error: 'Impossible de confirmer la commande.' });
    }
};

export const releaseEscrow = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await fetchOrderOr404(id, res);
        if (!order) return;
        if (!assertOrderMutableOrFail({ order, user: req.user, res, actionLabel: 'admin-release-escrow' })) return;

        const result = await releaseOrderEscrow({
            client,
            order,
            initiatedBy: req.user?.id || 'admin',
            autoRelease: false,
            force: !!req.body.force_release
        });

        return res.status(200).json({
            success: true,
            message: 'Fonds libérés avec succès',
            order: result.order,
            transfer: result.transfer
        });
    } catch (error) {
        console.error('❌ Erreur releaseEscrow:', error.message);
        return res.status(500).json({ error: 'Failed to release escrow' });
    }
};
