import { supabaseAdmin, supabase } from '../config/supabase.js';
import {
    createAvadaPayCheckoutLink,
    isAvadaPayConfigured,
    verifyAvadaPaySignature
} from '../services/avadapay.js';
import {
    ESCROW_STATUSES,
    ORDER_STATUSES,
    generateOrderId,
    generateTransactionId,
    getOrderCustomerId,
    mapLegacyOrderStatus
} from '../services/order-workflow.js';

const generateTxId = () => generateTransactionId();

function normalizeAmount(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100) / 100;
}

function getRedirectUrl(req) {
    if (process.env.AVADAPAY_REDIRECT_URL) return process.env.AVADAPAY_REDIRECT_URL;
    const host = req.headers.host || 'localhost:3001';
    const frontendHost = host.includes('localhost') ? host.replace(':3001', ':5173') : host;
    return `http://${frontendHost}/src/pages/payment-success.html`;
}

function getPaymentLogoUrl() {
    const frontendUrl = process.env.FRONTEND_URL || 'https://newket.vercel.app';
    return `${frontendUrl.replace(/\/$/, '')}/Images/Logo_Header_Officiel_PNG.png`;
}

function getActivePaymentProvider() {
    return 'avadapay';
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
            vendor_id,
            customer_phone,
            customer_name,
            customer_city,
            customer_email
        } = req.body;

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
                return res.status(403).json({ error: 'Accès refusé à cette commande.' });
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

        const conversionRate = parseFloat(product.custom_exchange_rate) || await loadExchangeRate(client);
        const verifiedAmount = orderId
            ? Number(order.total_amount || order.total || 0)
            : Number(product.price || 0) * Number(firstItem.quantity || 1);
        const finalAmountUSD = parseFloat((verifiedAmount / conversionRate).toFixed(2));
        const txId = generateTxId();
        const provider = getActivePaymentProvider();

        if (!orderId) {
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
                merchandise_amount: verifiedAmount,
                delivery_fee_amount: 0,
                total_amount: verifiedAmount,
                status: ORDER_STATUSES.READY_FOR_PAYMENT,
                payment_status: 'PENDING',
                transaction_id: txId,
                phone_number: customer_phone || null,
                customer_phone: customer_phone || null,
                customer_name: customer_name || req.user?.user_metadata?.full_name || 'Client NewKet',
                customer_city: customer_city || null,
                customer_email: customer_email || req.user?.email || 'client@newket.cd',
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
                    payment_status: 'PENDING',
                    updated_at: new Date().toISOString()
                })
                .eq('id', orderId);

            if (dbError) throw dbError;
            order = {
                ...order,
                transaction_id: txId,
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

        if (!isAvadaPayConfigured()) {
            throw new Error('AvadaPay n’est pas configuré (AVADAPAY_API_BASE_URL / AVADAPAY_SECRET_KEY)');
        }

        const avadaPayload = {
            tx_ref: txId,
            amount: finalAmountUSD,
            currency: 'USD',
            redirect_url: getRedirectUrl(req),
            customer: {
                email: order.customer_email || req.user?.email || 'client@newket.cd',
                phonenumber: order.customer_phone || order.phone_number || '',
                name: order.customer_name || 'Client NewKet'
            },
            customizations: {
                title: 'NewKet Marketplace',
                description: `Achat : ${product.name}`,
                logo: getPaymentLogoUrl()
            },
            meta: {
                order_id: orderId,
                transaction_id: txId,
                product_id: firstItem.product_id,
                vendor_id: order.vendor_id || firstItem.vendor_id || null
            }
        };

        const avada = await createAvadaPayCheckoutLink(avadaPayload);
        const paymentUrl = avada.payment_url;
        const providerPublicKey = process.env.AVADAPAY_PUBLIC_KEY || null;

        return res.status(200).json({
            success: true,
            order_id: orderId,
            transaction_id: txId,
            provider,
            payment_url: paymentUrl,
            public_key: providerPublicKey
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
    return avadaPayWebhook(req, res);
};

export const avadaPayWebhook = async (req, res) => {
    try {
        const signatureValid = verifyAvadaPaySignature(req);
        if (!signatureValid) return res.status(401).send('Unauthorized');

        const payload = req.body;
        const ourTxId = payload?.tx_ref || payload?.data?.tx_ref || payload?.transaction_id || null;
        const providerTxId = payload?.id || payload?.data?.id || payload?.payment_id || null;
        const eventType = payload?.event || payload?.type || payload?.status || 'unknown';
        const providerEventId = `${String(providerTxId || 'unknown')}:${String(eventType || 'unknown')}`;

        if (!ourTxId) return res.status(400).send('tx_ref manquant');

        const client = supabaseAdmin || supabase;

        const { error: webhookInsertError } = await client
            .from('payment_webhook_events')
            .insert({
                provider: 'avadapay',
                event_type: String(eventType),
                provider_event_id: providerEventId,
                tx_ref: String(ourTxId),
                payload,
                signature_valid: signatureValid,
                received_at: new Date().toISOString(),
                process_status: 'RECEIVED'
            });

        if (webhookInsertError) {
            if (String(webhookInsertError.code) === '23505') return res.status(200).send('OK');
            console.error('[AVADAPAY Webhook] Failed to store webhook event:', webhookInsertError);
            return res.status(500).send('Erreur DB');
        }

        // TODO: when you have AvadaPay docs/keys for verification, add:
        // - verify transaction server-side
        // - amount/currency integrity checks
        // - atomic `process_order_payment` call
        await client
            .from('payment_webhook_events')
            .update({
                process_status: 'PENDING_VERIFICATION',
                processed_at: new Date().toISOString()
            })
            .eq('provider', 'avadapay')
            .eq('provider_event_id', providerEventId);

        return res.status(200).send('OK');
    } catch (error) {
        console.error('avadaPayWebhook error:', error);
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
