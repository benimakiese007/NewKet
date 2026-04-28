import { supabaseAdmin, supabase } from '../config/supabase.js';
import NotificationService from '../services/notificationService.js';
import crypto from 'crypto';
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

const verifyFlutterwaveSignature = (req) => {
    const webhookSecret = process.env.FLW_WEBHOOK_SECRET;
    const incomingHash = req.headers['verif-hash'];

    if (!webhookSecret || !incomingHash) return false;

    try {
        const secretBuf = Buffer.from(webhookSecret, 'utf8');
        const incomingBuf = Buffer.from(incomingHash, 'utf8');

        if (secretBuf.length !== incomingBuf.length) {
            crypto.timingSafeEqual(secretBuf, Buffer.alloc(secretBuf.length));
            return false;
        }

        return crypto.timingSafeEqual(secretBuf, incomingBuf);
    } catch (error) {
        console.error('Flutterwave signature verification failed:', error);
        return false;
    }
};

const verifyFlutterwavePayment = async (transactionId) => {
    try {
        const response = await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        if (data.status === 'success' && data.data) {
            return data.data;
        }
        return null;
    } catch (error) {
        console.error('Flutterwave payment verification failed:', error);
        return null;
    }
};

function getRedirectUrl(req) {
    if (process.env.FLW_REDIRECT_URL) return process.env.FLW_REDIRECT_URL;
    const host = req.headers.host || 'localhost:3001';
    const frontendHost = host.includes('localhost') ? host.replace(':3001', ':5173') : host;
    return `http://${frontendHost}/src/pages/payment-success.html`;
}

function getPaymentLogoUrl() {
    const frontendUrl = process.env.FRONTEND_URL || 'https://newket.vercel.app';
    return `${frontendUrl.replace(/\/$/, '')}/Images/Logo_Header_Officiel_PNG.png`;
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

        const { error: webhookInsertError } = await client
            .from('payment_webhook_events')
            .insert({
                provider: 'flutterwave',
                event_type: payload.event,
                provider_event_id: providerEventId,
                tx_ref: ourTxId || null,
                payload,
                signature_valid: signatureValid,
                received_at: new Date().toISOString(),
                process_status: 'RECEIVED'
            });

        if (webhookInsertError) {
            if (String(webhookInsertError.code) === '23505') {
                return res.status(200).send('OK');
            }
            console.error('[FLW Webhook] Failed to store webhook event:', webhookInsertError);
            return res.status(500).send('Erreur DB');
        }

        const { data: orderRow, error: orderLookupError } = await client
            .from('orders')
            .select('id, payment_expected_amount, payment_expected_currency')
            .eq('transaction_id', ourTxId)
            .maybeSingle();

        if (orderLookupError || !orderRow) {
            await client
                .from('payment_webhook_events')
                .update({
                    process_status: 'FAILED',
                    process_error: 'ORDER_NOT_FOUND',
                    processed_at: new Date().toISOString()
                })
                .eq('provider', 'flutterwave')
                .eq('provider_event_id', providerEventId);
            return res.status(404).send('Order not found');
        }

        const expectedAmount = normalizeAmount(orderRow.payment_expected_amount);
        const expectedCurrency = String(orderRow.payment_expected_currency || '').toUpperCase();
        const gotAmount = normalizeAmount(verifiedPayment.amount);
        const gotCurrency = String(verifiedPayment.currency || '').toUpperCase();

        if (expectedAmount !== null && gotAmount !== null && expectedAmount !== gotAmount) {
            await client
                .from('payment_webhook_events')
                .update({
                    process_status: 'FAILED',
                    process_error: `AMOUNT_MISMATCH expected=${expectedAmount} got=${gotAmount}`,
                    order_id: orderRow.id,
                    processed_at: new Date().toISOString()
                })
                .eq('provider', 'flutterwave')
                .eq('provider_event_id', providerEventId);
            return res.status(400).send('Montant invalide');
        }

        if (expectedCurrency && gotCurrency && expectedCurrency !== gotCurrency) {
            await client
                .from('payment_webhook_events')
                .update({
                    process_status: 'FAILED',
                    process_error: `CURRENCY_MISMATCH expected=${expectedCurrency} got=${gotCurrency}`,
                    order_id: orderRow.id,
                    processed_at: new Date().toISOString()
                })
                .eq('provider', 'flutterwave')
                .eq('provider_event_id', providerEventId);
            return res.status(400).send('Devise invalide');
        }
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

        const flwPayload = {
            tx_ref: txId,
            amount: finalAmountUSD,
            currency: 'USD',
            redirect_url: getRedirectUrl(req),
            payment_options: 'mobilemoney,card,ussd',
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

        // Server-side source of truth for integrity checks + order locking.
        const nowIso = new Date().toISOString();
        const { error: lockError } = await client
            .from('orders')
            .update({
                payment_status: 'INITIATED',
                payment_provider: 'flutterwave',
                payment_expected_amount: normalizeAmount(finalAmountUSD),
                payment_expected_currency: 'USD',
                payment_locked_at: nowIso,
                payment_lock_reason: 'PAYMENT_INITIATED',
                updated_at: nowIso
            })
            .eq('id', orderId);

        if (lockError) throw lockError;

        const flwResponse = await fetch('https://api.flutterwave.com/v3/payments', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(flwPayload)
        });

        const flwData = await flwResponse.json();

        if (flwData.status !== 'success' || !flwData.data?.link) {
            console.error('Flutterwave initiatePayment failed:', flwData);
            throw new Error(flwData.message || 'Impossible de créer le lien de paiement');
        }

        return res.status(200).json({
            success: true,
            order_id: orderId,
            transaction_id: txId,
            payment_url: flwData.data.link,
            public_key: process.env.FLW_PUBLIC_KEY
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

export const flutterwaveWebhook = async (req, res) => {
    try {
        const signatureValid = verifyFlutterwaveSignature(req);
        if (!signatureValid) {
            console.warn('[FLW Webhook] Signature invalide');
            return res.status(401).send('Unauthorized');
        }

        const payload = req.body;
        if (payload.event !== 'charge.completed') {
            return res.status(200).send('Event ignoré');
        }

        const flwTxId = payload.data?.id;
        const ourTxId = payload.data?.tx_ref;
        const providerEventId = `${String(flwTxId || 'unknown')}:${String(payload.event || 'unknown')}`;
        const verifiedPayment = await verifyFlutterwavePayment(flwTxId);

        if (!verifiedPayment) {
            return res.status(400).send('Paiement non vérifiable');
        }

        const client = supabaseAdmin || supabase;

        if (verifiedPayment.status === 'successful') {
            await client
                .from('orders')
                .update({
                    payment_provider: 'flutterwave',
                    payment_provider_tx_id: String(flwTxId || ''),
                    updated_at: new Date().toISOString()
                })
                .eq('id', orderRow.id);

            const { data: rpcData, error: rpcError } = await client.rpc('process_order_payment', {
                p_transaction_id: ourTxId
            });

            if (rpcError || (rpcData && !rpcData.success)) {
                console.error('[FLW Webhook] process_order_payment failed:', rpcError || rpcData?.message);
                await client
                    .from('payment_webhook_events')
                    .update({
                        process_status: 'FAILED',
                        process_error: String(rpcError?.message || rpcData?.message || 'RPC_FAILED'),
                        order_id: orderRow.id,
                        processed_at: new Date().toISOString()
                    })
                    .eq('provider', 'flutterwave')
                    .eq('provider_event_id', providerEventId);
                return res.status(500).send('Erreur lors de la validation atomique');
            }

            const { data: paymentRow } = await client
                .from('payments')
                .select('id, currency, amount')
                .eq('order_id', orderRow.id)
                .maybeSingle();

            if (paymentRow?.id) {
                await client
                    .from('financial_ledger_entries')
                    .insert({
                        order_id: orderRow.id,
                        payment_id: paymentRow.id,
                        entry_type: 'CUSTOMER_CHARGE',
                        amount: normalizeAmount(paymentRow.amount) ?? normalizeAmount(verifiedPayment.amount) ?? 0,
                        currency: String(paymentRow.currency || verifiedPayment.currency || 'USD'),
                        metadata: {
                            provider: 'flutterwave',
                            provider_tx_id: flwTxId || null,
                            tx_ref: ourTxId || null
                        }
                    });
            }

            const { data: orderInfo } = await client
                .from('orders')
                .select('id, otp_code, customer_email, customer_name, transaction_id')
                .eq('transaction_id', ourTxId)
                .single();

            if (orderInfo) {
                NotificationService.notifyOrderSuccess(orderInfo.id);
                if (orderInfo.customer_email && orderInfo.otp_code) {
                    NotificationService.notifyCustomerOTP(orderInfo);
                }
            }

            await client
                .from('payment_webhook_events')
                .update({
                    process_status: 'PROCESSED',
                    order_id: orderRow.id,
                    processed_at: new Date().toISOString()
                })
                .eq('provider', 'flutterwave')
                .eq('provider_event_id', providerEventId);
        } else {
            const { error: dbUpdateError } = await client
                .from('orders')
                .update({
                    payment_status: 'FAILED',
                    status: 'CANCELLED',
                    payment_lock_reason: 'PAYMENT_FAILED',
                    updated_at: new Date().toISOString()
                })
                .eq('transaction_id', ourTxId);

            if (dbUpdateError) {
                console.error('[FLW Webhook] Failed to mark order as cancelled:', dbUpdateError);
                return res.status(500).send('Erreur DB');
            }

            await client
                .from('payment_webhook_events')
                .update({
                    process_status: 'PROCESSED',
                    order_id: orderRow.id,
                    processed_at: new Date().toISOString()
                })
                .eq('provider', 'flutterwave')
                .eq('provider_event_id', providerEventId);
        }

        return res.status(200).send('OK');
    } catch (error) {
        console.error('flutterwaveWebhook error:', error);
        return res.status(500).send('Erreur interne');
    }
};

export const reverifyFlutterwaveTransaction = async (req, res) => {
    try {
        const client = supabaseAdmin || supabase;
        const { flw_transaction_id, tx_ref } = req.body || {};

        if (!flw_transaction_id || !tx_ref) {
            return res.status(400).json({ error: 'flw_transaction_id et tx_ref sont requis.' });
        }

        const verifiedPayment = await verifyFlutterwavePayment(flw_transaction_id);
        if (!verifiedPayment) {
            return res.status(400).json({ error: 'Paiement non vérifiable' });
        }

        const { data: orderRow, error: orderLookupError } = await client
            .from('orders')
            .select('id, payment_expected_amount, payment_expected_currency')
            .eq('transaction_id', tx_ref)
            .maybeSingle();

        if (orderLookupError || !orderRow) {
            return res.status(404).json({ error: 'Commande introuvable pour ce tx_ref.' });
        }

        const expectedAmount = normalizeAmount(orderRow.payment_expected_amount);
        const expectedCurrency = String(orderRow.payment_expected_currency || '').toUpperCase();
        const gotAmount = normalizeAmount(verifiedPayment.amount);
        const gotCurrency = String(verifiedPayment.currency || '').toUpperCase();

        if (expectedAmount !== null && gotAmount !== null && expectedAmount !== gotAmount) {
            return res.status(400).json({ error: `Montant invalide (expected=${expectedAmount}, got=${gotAmount}).` });
        }

        if (expectedCurrency && gotCurrency && expectedCurrency !== gotCurrency) {
            return res.status(400).json({ error: `Devise invalide (expected=${expectedCurrency}, got=${gotCurrency}).` });
        }

        await client
            .from('orders')
            .update({
                payment_provider: 'flutterwave',
                payment_provider_tx_id: String(flw_transaction_id),
                updated_at: new Date().toISOString()
            })
            .eq('id', orderRow.id);

        if (verifiedPayment.status === 'successful') {
            const { data: rpcData, error: rpcError } = await client.rpc('process_order_payment', {
                p_transaction_id: tx_ref
            });

            if (rpcError || (rpcData && !rpcData.success)) {
                return res.status(500).json({ error: 'process_order_payment échec', details: rpcError?.message || rpcData?.message });
            }

            return res.status(200).json({ success: true, message: 'Paiement revalidé et commande mise à jour.' });
        }

        await client
            .from('orders')
            .update({
                payment_status: 'FAILED',
                status: 'CANCELLED',
                payment_lock_reason: 'PAYMENT_FAILED',
                updated_at: new Date().toISOString()
            })
            .eq('id', orderRow.id);

        return res.status(200).json({ success: true, message: 'Paiement non-successful: commande annulée.' });
    } catch (error) {
        console.error('reverifyFlutterwaveTransaction error:', error);
        return res.status(500).json({ error: 'Erreur interne' });
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
