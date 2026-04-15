import { supabaseAdmin, supabase } from '../config/supabase.js';
import NotificationService from '../services/notificationService.js';
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

        if (!product_id || !vendor_id) {
            return res.status(400).json({ error: 'Informations incomplètes pour le paiement' });
        }

        const client = supabaseAdmin || supabase;

        // ─── SÉCURITÉ : Vérification du prix en base de données ────────────────
        // On ne fait PAS confiance au 'amount' envoyé par le frontend.
        const { data: product, error: prodError } = await client
            .from('products')
            .select('price, name, supplier_email')
            .eq('id', product_id)
            .single();

        if (prodError || !product) {
            console.error('❌ Produit non trouvé pour paiement:', product_id);
            return res.status(404).json({ error: 'Produit introuvable' });
        }

        const verifiedAmount = product.price;
        // On peut vérifier si l'écart entre verifiedAmount et amount est trop grand,
        // mais le plus sûr est d'utiliser systématiquement verifiedAmount pour CinetPay.
        
        // ─── TRANSACTION ID ──────────────────────────────────────────────────
        const txId = generateTxId();

        // ─── SAUVEGARDE DE LA COMMANDE ───────────────────────────────────────
        const { data: orderData, error: dbError } = await client
            .from('orders')
            .insert({
                user_id: req.user?.id, // ID de l'acheteur authentifié
                items: [{ 
                    product_id, 
                    vendor_id, 
                    price: verifiedAmount, 
                    name: product.name,
                    quantity: 1 
                }],
                total: verifiedAmount,
                total_amount: verifiedAmount,
                status: 'PENDING',
                payment_status: 'PENDING',
                transaction_id: txId,
                customer_phone,
                customer_name,
                customer_city,
                vendor_email: product.supplier_email
            })
            .select('*')
            .single();

        if (dbError) throw dbError;

        // 2. Préparer les données pour l'API CinetPay
        const apiKey = process.env.CINETPAY_API_KEY;
        const siteId = process.env.CINETPAY_SITE_ID;
        const notifyUrl = process.env.CINETPAY_NOTIFY_URL;
        const returnUrl = process.env.CINETPAY_RETURN_URL;

        const response = await fetch('https://api-checkout.cinetpay.com/v2/payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apikey: apiKey,
                site_id: siteId,
                transaction_id: txId,
                amount: verifiedAmount, // UTILISATION DU PRIX VÉRIFIÉ
                currency: 'XOF', 
                description: `Achat ${product.name} sur NewKet`,
                notify_url: notifyUrl,
                return_url: returnUrl,
                channels: 'ALL',
                customer_name: customer_name || 'Client',
                customer_surname: 'NewKet',
                customer_phone_number: customer_phone || '',
            })
        });

        const cinetpayData = await response.json();

        if (cinetpayData.code !== '201') {
            throw new Error('Erreur CinetPay : ' + cinetpayData.message);
        }

        return res.status(200).json({
            success: true,
            transaction_id: txId,
            payment_token: cinetpayData.data.payment_token,
            payment_url: cinetpayData.data.payment_url,
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

        // Mise à jour de la table orders via RPC (Atomique: Stock + Statut)
        if (txStatus === 'ACCEPTED') {
            const { data: rpcData, error: rpcError } = await client.rpc('process_order_payment', { 
                p_transaction_id: cpm_trans_id 
            });

            if (rpcError || (rpcData && !rpcData.success)) {
                console.error('[CinetPay Webhook] Erreur RPC process_order_payment:', rpcError || rpcData.message);
                return res.status(500).send('Erreur lors de la validation atomique du stock et de la commande');
            }

            console.log(`[CinetPay Webhook] Commande ${cpm_trans_id} validée avec succès (Stock décrémenté)`);
            
            // Déclencher une notification au vendeur
            // On récupère l'ID de la commande à partir du transaction_id pour la notification
            const { data: orderInfo } = await client
                .from('orders')
                .select('id')
                .eq('transaction_id', cpm_trans_id)
                .single();

            if (orderInfo) {
                NotificationService.notifyOrderSuccess(orderInfo.id);
            }
        } else {
            // Pour les échecs, on fait une mise à jour simple sans toucher au stock
            const { error: dbUpdateError } = await client
                .from('orders')
                .update({
                    payment_status: 'FAILED',
                    status: 'ANNULÉ'
                })
                .eq('transaction_id', cpm_trans_id);

            if (dbUpdateError) {
                console.error('[CinetPay Webhook] Erreur mise à jour de DB (Echec):', dbUpdateError);
                return res.status(500).send('Erreur DB');
            }
        }

        // Répondre 200 à CinetPay pour qu'ils arrêtent d'envoyer la notification
        return res.status(200).send('OK');

    } catch (err) {
        console.error('❌ Erreur cinetpayWebhook:', err);
        return res.status(500).send('Erreur interne');
    }
};
