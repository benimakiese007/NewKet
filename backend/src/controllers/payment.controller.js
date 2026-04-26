import { supabaseAdmin, supabase } from '../config/supabase.js';
import NotificationService from '../services/notificationService.js';
import crypto from 'crypto';
import {
    ORDER_STATUSES,
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

export const initiatePayment = async (req, res) => {
    try {
        const { order_id } = req.body;
        if (!order_id) {
            return res.status(400).json({ error: 'order_id requis pour initier le paiement.' });
        }

        const client = supabaseAdmin || supabase;
        const { data: order, error: orderError } = await client
            .from('orders')
            .select('*')
            .eq('id', order_id)
            .single();

        if (orderError || !order) {
            return res.status(404).json({ error: 'Commande introuvable' });
        }

        if (getOrderCustomerId(order) !== req.user?.id) {
            return res.status(403).json({ error: 'Accès refusé à cette commande.' });
        }

        if (mapLegacyOrderStatus(order.status) !== ORDER_STATUSES.READY_FOR_PAYMENT) {
            return res.status(400).json({ error: `Paiement impossible depuis le statut ${order.status}.` });
        }

        const firstItem = Array.isArray(order.items) ? order.items[0] : null;
        if (!firstItem?.product_id) {
            return res.status(400).json({ error: 'Commande invalide: produit introuvable.' });
        }

        const { data: product, error: productError } = await client
            .from('products')
            .select('price, name, custom_exchange_rate')
            .eq('id', firstItem.product_id)
            .single();

        if (productError || !product) {
            return res.status(404).json({ error: 'Produit introuvable' });
        }

        const { data: settings } = await client
            .from('settings')
            .select('exchangeRate')
            .eq('id', 'global-settings')
            .single();

        const conversionRate = parseFloat(product.custom_exchange_rate) || parseFloat(settings?.exchangeRate) || 2800;
        const verifiedAmount = Number(order.total_amount || order.total || 0);
        const finalAmountUSD = parseFloat((verifiedAmount / conversionRate).toFixed(2));
        const txId = generateTxId();

        const { error: dbError } = await client
            .from('orders')
            .update({
                transaction_id: txId,
                payment_status: 'PENDING',
                updated_at: new Date().toISOString()
            })
            .eq('id', order_id);

        if (dbError) throw dbError;

        const flwPayload = {
            tx_ref: txId,
            amount: finalAmountUSD,
            currency: 'USD',
            redirect_url: process.env.FLW_REDIRECT_URL || 'http://localhost:5173/pages/payment-success.html',
            payment_options: 'mobilemoney,card,ussd',
            customer: {
                email: order.customer_email || req.user?.email || 'client@newket.cd',
                phonenumber: order.customer_phone || order.phone_number || '',
                name: order.customer_name || 'Client NewKet'
            },
            customizations: {
                title: 'NewKet Marketplace',
                description: `Achat : ${product.name}`,
                logo: 'https://kuygjocnnlvjtoaquicq.supabase.co/storage/v1/object/public/newket-logo/logo.png'
            },
            meta: {
                order_id,
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
            order_id,
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
