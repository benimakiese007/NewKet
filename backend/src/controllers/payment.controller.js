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
        if (!verifyFlutterwaveSignature(req)) {
            console.warn('[FLW Webhook] Signature invalide');
            return res.status(401).send('Unauthorized');
        }

        const payload = req.body;
        if (payload.event !== 'charge.completed') {
            return res.status(200).send('Event ignoré');
        }

        const flwTxId = payload.data?.id;
        const ourTxId = payload.data?.tx_ref;
        const verifiedPayment = await verifyFlutterwavePayment(flwTxId);

        if (!verifiedPayment) {
            return res.status(400).send('Paiement non vérifiable');
        }

        const client = supabaseAdmin || supabase;

        if (verifiedPayment.status === 'successful') {
            const { data: rpcData, error: rpcError } = await client.rpc('process_order_payment', {
                p_transaction_id: ourTxId
            });

            if (rpcError || (rpcData && !rpcData.success)) {
                console.error('[FLW Webhook] process_order_payment failed:', rpcError || rpcData?.message);
                return res.status(500).send('Erreur lors de la validation atomique');
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
        } else {
            const { error: dbUpdateError } = await client
                .from('orders')
                .update({
                    payment_status: 'FAILED',
                    status: 'CANCELLED',
                    updated_at: new Date().toISOString()
                })
                .eq('transaction_id', ourTxId);

            if (dbUpdateError) {
                console.error('[FLW Webhook] Failed to mark order as cancelled:', dbUpdateError);
                return res.status(500).send('Erreur DB');
            }
        }

        return res.status(200).send('OK');
    } catch (error) {
        console.error('flutterwaveWebhook error:', error);
        return res.status(500).send('Erreur interne');
    }
};
