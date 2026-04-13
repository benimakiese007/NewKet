import { supabaseAdmin, supabase } from '../config/supabase.js';
import crypto from 'crypto';

/**
 * Génère un ID de transaction unique
 */
const generateTxId = () => {
    return 'NK_' + Math.random().toString(36).substr(2, 9).toUpperCase() + '_' + Date.now();
};

/**
 * Valide la signature envoyée par CinetPay (Sécurité)
 */
const verifyCinetPaySignature = (token, signature, secretKey) => {
    // La documentation CinetPay précise que la signature est générée avec HMAC SHA256
    // du token de paiement avec la clé secrète.
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(token);
    const expectedSignature = hmac.digest('hex');
    return expectedSignature === signature;
};

/**
 * Initialise un paiement et renvoie le token au Frontend.
 * Ce endpoint enregistre la commande "En attente" en BD.
 */
export const initiatePayment = async (req, res) => {
    try {
        const { product_id, vendor_id, amount, customer_phone, customer_name, customer_city } = req.body;

        if (!product_id || !vendor_id || !amount) {
            return res.status(400).json({ error: 'Informations incomplètes pour le paiement' });
        }

        const client = supabaseAdmin || supabase;
        const txId = generateTxId();

        // 1. Sauvegarder la commande en base de données avec statut PENDING
        const { data: orderData, error: dbError } = await client
            .from('orders')
            .insert({
                items: [{ product_id, vendor_id, price: amount, quantity: 1 }],
                total: amount,
                total_amount: amount,
                status: 'PENDING',
                payment_status: 'PENDING',
                transaction_id: txId,
                customer_phone,
                customer_name,
                customer_city
            })
            .select('*')
            .single();

        if (dbError) throw dbError;

        // 2. Préparer les données pour l'API CinetPay (si on n'utilise pas le SDK Seamless client-side complet)
        // Note: Dans une intégration Seamless, on peut aussi simplement renvoyer l'ID de transaction 
        // et laisser le frontend faire le paiement, mais initialiser le token côté serveur est plus sûr.

        const apiKey = process.env.CINETPAY_API_KEY;
        const siteId = process.env.CINETPAY_SITE_ID;
        const notifyUrl = process.env.CINETPAY_NOTIFY_URL;
        const returnUrl = process.env.CINETPAY_RETURN_URL;

        // Appel à l'API CinetPay (ex: /v1/payment)
        const response = await fetch('https://api-checkout.cinetpay.com/v2/payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                apikey: apiKey,
                site_id: siteId,
                transaction_id: txId,
                amount: amount,
                currency: 'XOF', // Adapter selon la devise du produit
                description: `Achat produit #${product_id} sur NewKet`,
                notify_url: notifyUrl,
                return_url: returnUrl,
                channels: 'ALL',
                customer_name: customer_name || 'Client',
                customer_surname: 'NewKet',
                customer_phone_number: customer_phone || '',
                // Champs optionnels...
            })
        });

        const cinetpayData = await response.json();

        if (cinetpayData.code !== '201') {
            throw new Error('Erreur CinetPay : ' + cinetpayData.message);
        }

        const paymentToken = cinetpayData.data.payment_token;
        const paymentUrl = cinetpayData.data.payment_url;

        // Renvoyer le token et l'URL au frontend
        return res.status(200).json({
            success: true,
            transaction_id: txId,
            payment_token: paymentToken,
            payment_url: paymentUrl,
            apikey: apiKey,
            site_id: siteId
        });

    } catch (err) {
        console.error('❌ Erreur initiatePayment:', err);
        return res.status(500).json({ error: 'Impossible d\'initialiser le paiement' });
    }
};

/**
 * Webhook CinetPay. Appelé silencieusement par CinetPay lors du paiement.
 */
export const cinetpayWebhook = async (req, res) => {
    try {
        const { cpm_trans_id, cpm_site_id, cpm_result, cpm_amount, signature, cpm_custom, cpm_payid } = req.body;
        
        console.log(`[CinetPay Webhook] Reçu pour TX: ${cpm_trans_id}, Statut: ${cpm_result}`);

        // Vérification de sécurité avec la signature
        const secretKey = process.env.CINETPAY_SECRET_KEY;
        
        // Pour CinetPay, la notification IPN nécessite souvent de faire une requête de vérification 
        // explicite vers leur serveur (Checking payment status).
        
        const apiKey = process.env.CINETPAY_API_KEY;
        const siteId = process.env.CINETPAY_SITE_ID;

        // On interroge CinetPay pour obtenir le statut RÉEL du paiement
        const checkResponse = await fetch('https://api-checkout.cinetpay.com/v2/payment/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apikey: apiKey,
                site_id: siteId,
                transaction_id: cpm_trans_id
            })
        });

        const checkData = await checkResponse.json();

        if (checkData.code !== '00') {
            console.error('[CinetPay Webhook] Paiement non valide ou non trouvé');
            return res.status(400).send('Transaction non trouvée/non valide');
        }

        const txStatus = checkData.data.status; // ex: ACCEPTED, REFUSED
        const client = supabaseAdmin || supabase;

        // Mise à jour de la table orders
        let newPaymentStatus = 'PENDING';
        let newOrderStatus = 'PENDING';

        if (txStatus === 'ACCEPTED') {
            newPaymentStatus = 'PAID';
            newOrderStatus = 'PAYÉ';
            
            // TODO: Déclencher une notification au vendeur ici en utilisant le NotificationService
        } else {
            newPaymentStatus = 'FAILED';
            newOrderStatus = 'ANNULÉ';
        }

        const { error: dbUpdateError } = await client
            .from('orders')
            .update({
                payment_status: newPaymentStatus,
                status: newOrderStatus
                // on pourrait aussi sauvegarder l'ID de paiement cinetpay : cpm_payid
            })
            .eq('transaction_id', cpm_trans_id);

        if (dbUpdateError) {
            console.error('[CinetPay Webhook] Erreur mise à jour de DB:', dbUpdateError);
            return res.status(500).send('Erreur DB');
        }

        // Répondre 200 à CinetPay pour qu'ils arrêtent d'envoyer la notification
        return res.status(200).send('OK');

    } catch (err) {
        console.error('❌ Erreur cinetpayWebhook:', err);
        return res.status(500).send('Erreur interne');
    }
};
