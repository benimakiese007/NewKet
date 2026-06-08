import { supabaseAdmin, supabase } from '../config/supabase.js';
import {
    createNetikashPaymentRequest,
    isNetikashConfigured,
    verifyNetikashSignature
} from '../services/netikash.js';
import NotificationService from '../services/notificationService.js';
import {
    ESCROW_STATUSES,
    ORDER_STATUSES,
    generateOrderId,
    generateTransactionId,
    getOrderCustomerId,
    mapLegacyOrderStatus
} from '../services/order-workflow.js';
import {
    calculateVendorPromoPricing,
    normalizePromoCode,
    recordVendorPromoUsage
} from '../services/vendor-promo.service.js';

const generateTxId = () => generateTransactionId();

function normalizeAmount(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100) / 100;
}

function normalizeCurrency(value) {
    return String(value || '').trim().toUpperCase();
}

function getWebhookAmount(payload) {
    const candidates = [
        payload?.amount,
        payload?.data?.amount,
        payload?.total_amount,
        payload?.data?.total_amount,
        payload?.amount_paid,
        payload?.data?.amount_paid,
        payload?.transaction?.amount,
        payload?.data?.transaction?.amount,
        payload?.request?.amount,
        payload?.data?.request?.amount
    ];

    for (const candidate of candidates) {
        const amount = normalizeAmount(candidate);
        if (amount !== null) return amount;
    }

    return null;
}

function getWebhookCurrency(payload) {
    return normalizeCurrency(
        payload?.currency
        || payload?.data?.currency
        || payload?.request?.currency
        || payload?.data?.request?.currency
        || payload?.transaction?.currency
        || payload?.data?.transaction?.currency
    );
}

function getWebhookSuccessState(payload) {
    const statusRaw = String(payload?.status || payload?.data?.status || '').trim().toLowerCase();
    const eventRaw = String(payload?.event || payload?.type || '').trim().toLowerCase();
    const raw = statusRaw || eventRaw;

    const successStates = new Set([
        'success',
        'successful',
        'completed',
        'paid',
        'approved',
        'payment.success',
        'payment.cashed',
        'charge.success'
    ]);

    const failureStates = new Set([
        'failed',
        'failure',
        'cancelled',
        'canceled',
        'declined',
        'expired',
        'payment.failed',
        'payment.expired',
        'payment.canceled',
        'payment.cancelled',
        'payment.locked'
    ]);

    return {
        raw,
        statusRaw,
        eventRaw,
        isSuccess: successStates.has(raw),
        isFailure: failureStates.has(raw)
    };
}

function getRedirectUrl(req) {
    if (process.env.NETIKASH_REDIRECT_URL) return process.env.NETIKASH_REDIRECT_URL;
    const host = req.headers.host || 'localhost:3001';
    const frontendHost = host.includes('localhost') ? host.replace(':3001', ':5173') : host;
    return `http://${frontendHost}/src/pages/payment-success.html`;
}

function getActivePaymentProvider() {
    return 'netikash';
}

async function loadProductForPayment(client, productId) {
    const { data: product, error } = await client
        .from('products')
        .select('id, price, name, supplier_email, custom_exchange_rate, user_id')
        .eq('id', productId)
        .single();

    if (error || !product) return null;
    return product;
}

async function loadExchangeRate(client) {
    const { data: settings } = await client
        .from('settings')
        .select('exchangeRate')
        .eq('id', 'global-settings')
        .single();

    return parseFloat(settings?.exchangeRate) || 2800;
}

export const initiatePayment = async (req, res) => {
    try {
        const client = supabaseAdmin || supabase;
        const {
            order_id,
            product_id,
            promo_code,
            vendor_id,
            customer_phone,
            customer_name,
            customer_city,
            customer_email
        } = req.body;

        if (!isNetikashConfigured()) {
            return res.status(503).json({
                success: false,
                code: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
                error: 'Paiement indisponible',
                message: 'L agregateur de paiement n est pas encore configure. Ajoute les cles Netikash cote backend puis reessaie.'
            });
        }

        let order = null;
        let orderId = order_id || null;
        let firstItem = null;

        if (orderId) {
            const { data: existingOrder, error: orderError } = await client
                .from('orders')
                .select('*')
                .eq('id', orderId)
                .single();

            if (orderError || !existingOrder) {
                return res.status(404).json({ error: 'Commande introuvable' });
            }

            if (getOrderCustomerId(existingOrder) !== req.user?.id) {
                return res.status(403).json({ error: 'Acces refuse a cette commande.' });
            }

            if (mapLegacyOrderStatus(existingOrder.status) !== ORDER_STATUSES.READY_FOR_PAYMENT) {
                return res.status(400).json({ error: `Paiement impossible depuis le statut ${existingOrder.status}.` });
            }

            order = existingOrder;
            firstItem = Array.isArray(existingOrder.items) ? existingOrder.items[0] : null;
            if (!firstItem?.product_id) {
                return res.status(400).json({ error: 'Commande invalide: produit introuvable.' });
            }
        } else {
            if (!product_id || !vendor_id) {
                return res.status(400).json({ error: 'order_id ou bien product_id et vendor_id sont requis.' });
            }

            firstItem = {
                product_id,
                vendor_id,
                quantity: 1
            };
        }

        const product = await loadProductForPayment(client, firstItem.product_id);
        if (!product) {
            return res.status(404).json({ error: 'Produit introuvable' });
        }

        const pricingResult = await calculateVendorPromoPricing({
            promoCode: normalizePromoCode(promo_code),
            order,
            product,
            quantity: Number(firstItem.quantity || 1),
            vendorId: vendor_id || order?.vendor_id || product.user_id || null,
            customerId: req.user?.id || null,
            dbClient: client
        });

        if (!pricingResult.valid) {
            return res.status(400).json({ error: pricingResult.message });
        }

        const pricing = pricingResult.pricing;
        const appliedPromo = pricingResult.promo;
        const conversionRate = parseFloat(product.custom_exchange_rate) || await loadExchangeRate(client);
        const verifiedAmount = Number(pricing.total_amount || 0);
        const finalAmountUSD = parseFloat((verifiedAmount / conversionRate).toFixed(2));
        const txId = generateTxId();
        const provider = getActivePaymentProvider();

        if (!orderId) {
            const resolvedCustomerEmail = customer_email || req.user?.email;
            if (!resolvedCustomerEmail) {
                return res.status(400).json({ error: 'Une adresse e-mail valide est requise pour initier un paiement.' });
            }

            const resolvedVendorId = vendor_id || product.user_id || null;
            const newOrder = {
                id: generateOrderId(),
                user_id: req.user?.id || null,
                customer_id: req.user?.id || null,
                vendor_id: resolvedVendorId,
                items: [{
                    product_id: product.id,
                    vendor_id: resolvedVendorId,
                    price: Number(product.price || 0),
                    name: product.name,
                    quantity: 1,
                    supplier_email: product.supplier_email || null
                }],
                total: verifiedAmount,
                merchandise_amount: Number(pricing.subtotal_amount || 0),
                delivery_fee_amount: Number(pricing.delivery_fee_amount || 0),
                total_amount: verifiedAmount,
                subtotal_amount: Number(pricing.subtotal_amount || 0),
                final_total_amount: verifiedAmount,
                promo_id: appliedPromo?.id || null,
                promo_code: appliedPromo?.code || null,
                promo_discount_amount: Number(pricing.promo_discount_amount || 0),
                status: ORDER_STATUSES.READY_FOR_PAYMENT,
                payment_status: 'PENDING',
                transaction_id: txId,
                phone_number: customer_phone || null,
                customer_phone: customer_phone || null,
                customer_name: customer_name || req.user?.user_metadata?.full_name || 'Client NewKet',
                customer_city: customer_city || null,
                customer_email: resolvedCustomerEmail,
                escrow_status: ESCROW_STATUSES.NONE,
                proof_status: 'PENDING'
            };

            const { data: createdOrder, error: insertError } = await client
                .from('orders')
                .insert(newOrder)
                .select('*')
                .single();

            if (insertError) throw insertError;
            order = createdOrder;
            orderId = createdOrder.id;
        } else {
            const { error: dbError } = await client
                .from('orders')
                .update({
                    transaction_id: txId,
                    promo_id: appliedPromo?.id || null,
                    promo_code: appliedPromo?.code || null,
                    promo_discount_amount: Number(pricing.promo_discount_amount || 0),
                    subtotal_amount: Number(pricing.subtotal_amount || order?.merchandise_amount || 0),
                    total_amount: verifiedAmount,
                    final_total_amount: verifiedAmount,
                    total: verifiedAmount,
                    payment_status: 'PENDING',
                    updated_at: new Date().toISOString()
                })
                .eq('id', orderId);

            if (dbError) throw dbError;
            order = {
                ...order,
                transaction_id: txId,
                promo_id: appliedPromo?.id || null,
                promo_code: appliedPromo?.code || null,
                promo_discount_amount: Number(pricing.promo_discount_amount || 0),
                subtotal_amount: Number(pricing.subtotal_amount || order?.merchandise_amount || 0),
                total_amount: verifiedAmount,
                final_total_amount: verifiedAmount,
                total: verifiedAmount,
                payment_status: 'PENDING'
            };
        }

        // Server-side source of truth for integrity checks + order locking.
        const nowIso = new Date().toISOString();
        const { error: lockError } = await client
            .from('orders')
            .update({
                payment_status: 'INITIATED',
                payment_provider: provider,
                payment_expected_amount: normalizeAmount(finalAmountUSD),
                payment_expected_currency: 'USD',
                payment_locked_at: nowIso,
                payment_lock_reason: 'PAYMENT_INITIATED',
                updated_at: nowIso
            })
            .eq('id', orderId);

        if (lockError) throw lockError;

        if (!isNetikashConfigured()) {
            throw new Error('Netikash n est pas configure (NETIKASH_CLIENT_ID / NETIKASH_CLIENT_SECRET)');
        }

        const paymentRequestPayload = {
            amount: finalAmountUSD,
            currency: 'USD',
            ref: txId,
            referer_url: getRedirectUrl(req),
            label: `NewKet Marketplace - ${product.name}`
        };

        const netikash = await createNetikashPaymentRequest(paymentRequestPayload);
        const paymentUrl = netikash.payment_url;

        return res.status(200).json({
            success: true,
            order_id: orderId,
            transaction_id: txId,
            provider,
            payment_url: paymentUrl,
            public_key: null
        });
    } catch (error) {
        console.error('Critical initiatePayment error:', {
            message: error.message,
            stack: error.stack,
            details: error.details || null,
            hint: error.hint || null,
            code: error.code || null
        });

        return res.status(500).json({
            success: false,
            error: 'Impossible d\'initialiser le paiement',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const paymentWebhook = async (req, res) => {
    return netikashWebhook(req, res);
};

export const netikashWebhook = async (req, res) => {
    try {
        const signatureValid = verifyNetikashSignature(req);
        if (!signatureValid) {
            console.warn('[NETIKASH Webhook] Invalid signature', {
                signatureHeaderPresent: Boolean(req.headers?.['x-signature']),
                timestampHeader: req.headers?.['x-timestamp'] || null
            });
            return res.status(401).send('Unauthorized');
        }

        const payload = req.body;
        const ourTxId = payload?.ref || payload?.tx_ref || payload?.data?.ref || payload?.transaction_id || payload?.trans || payload?.data?.trans || null;
        const providerTxId = payload?.trx || payload?.trans || payload?.id || payload?.data?.trx || payload?.data?.trans || payload?.payment_id || null;
        const eventType = payload?.event || payload?.type || payload?.status || 'unknown';
        const providerEventId = `${String(providerTxId || 'unknown')}:${String(eventType || 'unknown')}`;

        if (!ourTxId) {
            console.warn('[NETIKASH Webhook] Missing ref/tx_ref/trans in payload', {
                eventType,
                payloadKeys: Object.keys(payload || {})
            });
            return res.status(400).send('ref manquant');
        }

        const client = supabaseAdmin || supabase;
        const nowIso = new Date().toISOString();

        const { error: webhookInsertError } = await client
            .from('payment_webhook_events')
            .insert({
                provider: 'netikash',
                event_type: String(eventType),
                provider_event_id: providerEventId,
                tx_ref: String(ourTxId),
                payload,
                signature_valid: signatureValid,
                received_at: nowIso,
                process_status: 'RECEIVED'
            });

        if (webhookInsertError) {
            if (String(webhookInsertError.code) === '23505') return res.status(200).send('OK');
            console.error('[NETIKASH Webhook] Failed to store webhook event:', webhookInsertError);
            return res.status(500).send('Erreur DB');
        }

        const { data: order, error: orderError } = await client
            .from('orders')
            .select('id, transaction_id, status, payment_status, payment_expected_amount, payment_expected_currency, payment_provider_tx_id')
            .eq('transaction_id', String(ourTxId))
            .maybeSingle();

        if (orderError || !order) {
            await client
                .from('payment_webhook_events')
                .update({
                    process_status: 'ORDER_NOT_FOUND',
                    processing_error: orderError?.message || 'Order not found',
                    processed_at: nowIso
                })
                .eq('provider', 'netikash')
                .eq('provider_event_id', providerEventId);

            return res.status(404).send('Commande introuvable');
        }

        const webhookAmount = getWebhookAmount(payload);
        const webhookCurrency = getWebhookCurrency(payload);
        const expectedAmount = normalizeAmount(order.payment_expected_amount);
        const expectedCurrency = normalizeCurrency(order.payment_expected_currency);
        const providerStatus = getWebhookSuccessState(payload);
        const amountMismatch = expectedAmount !== null && webhookAmount !== null && expectedAmount !== webhookAmount;
        const currencyMismatch = Boolean(expectedCurrency) && Boolean(webhookCurrency) && expectedCurrency !== webhookCurrency;

        const eventUpdate = {
            order_id: order.id,
            processed_at: nowIso
        };

        if (providerTxId) {
            await client
                .from('orders')
                .update({
                    payment_provider: 'netikash',
                    payment_provider_tx_id: String(providerTxId),
                    updated_at: nowIso
                })
                .eq('id', order.id);
        }

        if (amountMismatch || currencyMismatch) {
            eventUpdate.process_status = 'VERIFICATION_FAILED';
            eventUpdate.processing_error = amountMismatch
                ? `Amount mismatch: expected ${expectedAmount}, got ${webhookAmount}`
                : `Currency mismatch: expected ${expectedCurrency}, got ${webhookCurrency}`;

            await client
                .from('payment_webhook_events')
                .update(eventUpdate)
                .eq('provider', 'netikash')
                .eq('provider_event_id', providerEventId);

            return res.status(400).send('Verification failed');
        }

        if (providerStatus.isFailure) {
            await client
                .from('orders')
                .update({
                    payment_status: 'FAILED',
                    payment_provider: 'netikash',
                    payment_provider_tx_id: providerTxId ? String(providerTxId) : order.payment_provider_tx_id,
                    updated_at: nowIso
                })
                .eq('id', order.id);

            eventUpdate.process_status = 'FAILED';
            eventUpdate.processing_error = providerStatus.raw || 'Provider reported failure';

            await client
                .from('payment_webhook_events')
                .update(eventUpdate)
                .eq('provider', 'netikash')
                .eq('provider_event_id', providerEventId);

            return res.status(200).send('OK');
        }

        if (!providerStatus.isSuccess) {
            eventUpdate.process_status = 'IGNORED';
            eventUpdate.processing_error = `Unhandled provider state: status=${providerStatus.statusRaw || 'unknown'} event=${providerStatus.eventRaw || 'unknown'}`;

            await client
                .from('payment_webhook_events')
                .update(eventUpdate)
                .eq('provider', 'netikash')
                .eq('provider_event_id', providerEventId);

            return res.status(200).send('OK');
        }

        const { data: rpcResult, error: rpcError } = await client.rpc('process_order_payment', {
            p_transaction_id: String(ourTxId)
        });

        if (rpcError) {
            eventUpdate.process_status = 'PROCESSING_FAILED';
            eventUpdate.processing_error = rpcError.message || 'RPC process_order_payment failed';

            await client
                .from('payment_webhook_events')
                .update(eventUpdate)
                .eq('provider', 'netikash')
                .eq('provider_event_id', providerEventId);

            return res.status(500).send('Erreur traitement paiement');
        }

        if (rpcResult?.success === false) {
            eventUpdate.process_status = 'PROCESSING_FAILED';
            eventUpdate.processing_error = rpcResult?.message || 'process_order_payment returned success=false';

            await client
                .from('payment_webhook_events')
                .update(eventUpdate)
                .eq('provider', 'netikash')
                .eq('provider_event_id', providerEventId);

            return res.status(400).send('Paiement non applique');
        }

        eventUpdate.process_status = 'PROCESSED';
        eventUpdate.processing_error = null;

        await client
            .from('payment_webhook_events')
            .update(eventUpdate)
            .eq('provider', 'netikash')
            .eq('provider_event_id', providerEventId);

        const { data: paidOrder, error: paidOrderError } = await client
            .from('orders')
            .select('*')
            .eq('transaction_id', String(ourTxId))
            .maybeSingle();

        if (paidOrderError) {
            console.error('[netikashWebhook] Could not reload paid order for OTP notification:', paidOrderError);
        } else {
            if (paidOrder?.promo_id && Number(paidOrder?.promo_discount_amount || 0) > 0) {
                try {
                    await recordVendorPromoUsage({
                        promoId: paidOrder.promo_id,
                        orderId: paidOrder.id,
                        customerId: paidOrder.customer_id || paidOrder.user_id || null,
                        discountAmount: Number(paidOrder.promo_discount_amount || 0),
                        dbClient: client
                    });
                } catch (usageError) {
                    console.error('[netikashWebhook] Could not record promo usage:', usageError);
                }
            }

            if (paidOrder?.otp_code && paidOrder?.customer_email) {
                NotificationService.notifyCustomerOTP(paidOrder)
                    .catch((notifyError) => {
                        console.error('[netikashWebhook] OTP notification failed:', notifyError);
                    });
            }
        }

        return res.status(200).send('OK');
    } catch (error) {
        console.error('netikashWebhook error:', error);
        return res.status(500).send('Erreur interne');
    }
};

export const getPaymentStatus = async (req, res) => {
    try {
        const client = supabaseAdmin || supabase;
        const txRef = req.params.tx_ref;

        const { data: order, error } = await client
            .from('orders')
            .select('id, transaction_id, status, payment_status, escrow_status, payment_provider, payment_provider_tx_id, payment_locked_at, updated_at')
            .eq('transaction_id', txRef)
            .maybeSingle();

        if (error || !order) {
            return res.status(404).json({ error: 'Transaction introuvable.' });
        }

        // If authenticated, enforce customer ownership when possible.
        if (req.user?.id) {
            const { data: orderOwner } = await client
                .from('orders')
                .select('customer_id, user_id')
                .eq('id', order.id)
                .single();

            const customerId = orderOwner?.user_id || orderOwner?.customer_id || null;
            if (customerId && customerId !== req.user.id) {
                return res.status(403).json({ error: 'Accès refusé.' });
            }
        }

        const { data: payment } = await client
            .from('payments')
            .select('status, amount, currency, updated_at, succeeded_at, failed_at, completed_at')
            .eq('order_id', order.id)
            .maybeSingle();

        return res.status(200).json({
            ok: true,
            order,
            payment: payment || null
        });
    } catch (error) {
        console.error('getPaymentStatus error:', error);
        return res.status(500).json({ error: 'Erreur interne' });
    }
};
