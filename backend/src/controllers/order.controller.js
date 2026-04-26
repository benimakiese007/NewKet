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
    computeEscrowReleaseAt,
    createEscrowEvent,
    generateOrderId,
    getOrderCustomerId,
    getOrderVendorId,
    isCustomerActor,
    isVendorActor,
    logOrderStatusHistory,
    mapLegacyOrderStatus,
    releaseOrderEscrow
} from '../services/order-workflow.js';

const client = supabaseAdmin || supabase;

function isAdminActor(user) {
    const email = String(user?.email || '').toLowerCase();
    const role = user?.app_metadata?.role || user?.user_metadata?.role || '';
    return role === 'admin' || email === 'benimakiese1234@gmail.com';
}

async function restoreStockIfNeeded(order) {
    const items = order?.items || [];
    for (const item of items) {
        if (!item?.product_id) continue;
        try {
            const { data: product } = await client
                .from('products')
                .select('stock')
                .eq('id', item.product_id)
                .single();

            if (product && product.stock !== undefined) {
                await client
                    .from('products')
                    .update({ stock: product.stock + (item.quantity || 1) })
                    .eq('id', item.product_id);
            }
        } catch (error) {
            console.error('[Order] Stock restore error:', error.message);
        }
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
        const {
            product_id,
            vendor_id,
            quantity: requestedQuantity,
            customer_phone,
            customer_name,
            customer_city,
            customer_email,
            customer_lat,
            customer_lng
        } = req.body;

        if (!product_id || !vendor_id) {
            return res.status(400).json({ error: 'product_id et vendor_id sont requis.' });
        }

        const quantity = Math.max(1, Math.min(100, parseInt(requestedQuantity, 10) || 1));
        const { data: product, error: productError } = await client
            .from('products')
            .select('id, name, price, supplier_email, user_id')
            .eq('id', product_id)
            .single();

        if (productError || !product) {
            return res.status(404).json({ error: 'Produit introuvable' });
        }

        const vendorId = vendor_id || product.user_id;
        const merchandiseAmount = Number(product.price || 0) * quantity;
        const orderId = generateOrderId();
        const customerId = req.user?.id || null;

        const { data: order, error } = await client
            .from('orders')
            .insert({
                id: orderId,
                user_id: customerId,
                customer_id: customerId,
                vendor_id: vendorId,
                items: [{
                    product_id: product.id,
                    vendor_id: vendorId,
                    price: product.price,
                    name: product.name,
                    quantity,
                    supplier_email: product.supplier_email
                }],
                total: merchandiseAmount,
                merchandise_amount: merchandiseAmount,
                delivery_fee_amount: 0,
                total_amount: merchandiseAmount,
                status: ORDER_STATUSES.PENDING,
                payment_status: 'UNPAID',
                phone_number: customer_phone || null,
                customer_phone: customer_phone || null,
                customer_name: customer_name || null,
                customer_city: customer_city || null,
                customer_email: customer_email || req.user?.email || null,
                customer_lat: customer_lat || null,
                customer_lng: customer_lng || null,
                escrow_status: ESCROW_STATUSES.NONE,
                proof_status: 'PENDING'
            })
            .select('*')
            .single();

        if (error) throw error;

        await logOrderStatusHistory(client, {
            orderId,
            previousStatus: null,
            newStatus: ORDER_STATUSES.PENDING,
            changedBy: customerId
        });

        NotificationService.notifyVendorOrderRequest(order);

        return res.status(201).json({ success: true, order });
    } catch (error) {
        console.error('❌ Erreur createOrder:', error.message);
        return res.status(500).json({ error: 'Impossible de créer la commande.' });
    }
};

export const getOrders = async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * parseInt(limit, 10);
        const userId = req.user?.id || null;

        let query = client
            .from('orders')
            .select('id, status, created_at, total, total_amount, merchandise_amount, delivery_fee_amount, customer_name, customer_email, customer_phone, customer_city, customer_lat, customer_lng, phone_number, items, payment_status, transaction_id, user_id, customer_id, vendor_id, escrow_status, escrow_release_at, proof_status, otp_code, accepted_delivery_quote_id')
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit, 10) - 1);

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
        let quotesByOrderId = new Map();

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
            updatePayload.total_amount = Number(order.merchandise_amount || order.total || 0) + Number(quote.delivery_fee_amount || 0);
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

        const nowIso = new Date().toISOString();
        await createOrUpdateDeliveryRecord(id, getOrderVendorId(order), {
            status: DELIVERY_STATUSES.DELIVERED,
            otp_attempts: 0,
            delivered_at: nowIso,
            otp_validated_at: nowIso,
            proof_status: 'OTP_VALIDATED'
        });

        const { data: updatedOrder, error } = await client
            .from('orders')
            .update({
                status: ORDER_STATUSES.DELIVERED,
                delivered_at: nowIso,
                proof_status: 'OTP_VALIDATED',
                escrow_status: ESCROW_STATUSES.HELD,
                escrow_release_at: computeEscrowReleaseAt(nowIso),
                updated_at: nowIso
            })
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw error;

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

        return res.status(200).json({ success: true, message: 'Livraison validée avec succès', order: updatedOrder });
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
