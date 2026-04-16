import { supabaseAdmin, supabase } from '../config/supabase.js';
import NotificationService from '../services/notificationService.js';
import crypto from 'crypto';

/**
 * Génère un ID de transaction unique NewKet
 */
const generateTxId = () => {
    return 'NK_' + Math.random().toString(36).substr(2, 9).toUpperCase() + '_' + Date.now();
};

/**
 * Vérifie la signature du webhook Flutterwave.
 * Flutterwave envoie un header "verif-hash" qu'on compare
 * à notre secret configuré en variable d'environnement.
 */
const verifyFlutterwaveSignature = (req) => {
    const webhookSecret = process.env.FLW_WEBHOOK_SECRET;
    const incomingHash = req.headers['verif-hash'];
    if (!webhookSecret || !incomingHash) return false;
    return incomingHash === webhookSecret;
};

/**
 * Vérifie un paiement auprès de l'API Flutterwave.
 * Retourne les données du paiement si valide, null sinon.
 */
const verifyFlutterwavePayment = async (transactionId) => {
    try {
        const response = await fetch(
            `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${process.env.FLW_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        const data = await response.json();
        if (data.status === 'success' && data.data) {
            return data.data;
        }
        return null;
    } catch (err) {
        console.error('❌ Erreur vérification Flutterwave:', err);
        return null;
    }
};

/**
 * Initialise un paiement Flutterwave et renvoie le payment_link au Frontend.
 * La commande est enregistrée en BD avec le statut "PENDING".
 */
export const initiatePayment = async (req, res) => {
    try {
        const { product_id, vendor_id, amount, customer_phone, customer_name, customer_city, customer_email } = req.body;

        if (!product_id || !vendor_id) {
            return res.status(400).json({ error: 'Informations incomplètes pour le paiement' });
        }

        const client = supabaseAdmin || supabase;

        // ─── SÉCURITÉ : Vérification du prix en base de données ────────────────
        // Ne jamais faire confiance au 'amount' envoyé par le frontend.
        const { data: product, error: prodError } = await client
            .from('products')
            .select('price, name, supplier_email, custom_exchange_rate')
            .eq('id', product_id)
            .single();

        if (prodError || !product) {
            console.error('❌ Produit non trouvé pour paiement:', product_id);
            return res.status(404).json({ error: 'Produit introuvable' });
        }

        // ─── RÉCUPÉRATION DES PARAMÈTRES GLOBAUX (DEVISE, ETC.) ──────────────
        const { data: settings } = await client
            .from('settings')
            .select('currencySymbol, exchangeRate')
            .eq('id', 'global-settings')
            .single();

        // ─── CALCUL DU TAUX ET CONVERSION VERS USD ──────────────────────────
        // On utilise la priorité : Taux Vendeur > Taux Global > 2800 (fallback)
        // La plupart des passerelles préfèrent USD pour les paiements cartes globaux.
        const conversionRate = parseFloat(product.custom_exchange_rate) || parseFloat(settings?.exchangeRate) || 2800;
        const verifiedAmount = product.price; // Toujours le montant CDF original pour la BD
        const finalAmountUSD = parseFloat((verifiedAmount / conversionRate).toFixed(2));

        console.log(`[Payment] Conversion : ${verifiedAmount} CDF -> ${finalAmountUSD} USD (Taux: ${conversionRate})`);

        // ─── TRANSACTION ID ──────────────────────────────────────────────────
        const txId = generateTxId();

        // ─── SAUVEGARDE DE LA COMMANDE EN ATTENTE ───────────────────────────
        const { data: orderData, error: dbError } = await client
            .from('orders')
            .insert({
                id: txId,
                user_id: req.user?.id || null,
                items: [{
                    product_id,
                    vendor_id,
                    price: verifiedAmount,
                    name: product.name,
                    quantity: 1,
                    supplier_email: product.supplier_email
                }],
                total: verifiedAmount,
                total_amount: verifiedAmount,
                status: 'PENDING',
                payment_status: 'PENDING',
                transaction_id: txId,
                phone_number: customer_phone || null,
                customer_phone: customer_phone || null,
                customer_name,
                customer_city,
                customer_email
            })
            .select('*')
            .single();

        if (dbError) throw dbError;

        // ─── CRÉATION DU LIEN DE PAIEMENT FLUTTERWAVE (EN USD) ───────────────
        const flwPayload = {
            tx_ref: txId,
            amount: finalAmountUSD,
            currency: 'USD',
            redirect_url: process.env.FLW_REDIRECT_URL || 'http://localhost:5173/pages/payment-success.html',
            payment_options: 'mobilemoney,card,ussd',
            customer: {
                email: customer_email || 'client@newket.cd',
                phonenumber: customer_phone || '',
                name: customer_name || 'Client NewKet'
            },
            customizations: {
                title: 'NewKet Marketplace',
                description: `Achat : ${product.name}`,
                logo: 'https://kuygjocnnlvjtoaquicq.supabase.co/storage/v1/object/public/newket-logo/logo.png'
            },
            meta: {
                transaction_id: txId,
                product_id,
                vendor_id
            }
        };

        const flwResponse = await fetch('https://api.flutterwave.com/v3/payments', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.FLW_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(flwPayload)
        });

        const flwData = await flwResponse.json();

        if (flwData.status !== 'success' || !flwData.data?.link) {
            console.error('❌ Erreur Flutterwave initiatePayment:', flwData);
            throw new Error(flwData.message || 'Erreur Flutterwave : impossible de créer le lien de paiement');
        }

        console.log(`✅ Paiement Flutterwave initié : ${txId} → ${flwData.data.link}`);

        return res.status(200).json({
            success: true,
            transaction_id: txId,
            payment_url: flwData.data.link,
            public_key: process.env.FLW_PUBLIC_KEY
        });

    } catch (err) {
        console.error('❌ Erreur critique initiatePayment:', {
            message: err.message,
            stack: err.stack,
            details: err.details || 'Pas de détails Supabase',
            hint: err.hint,
            code: err.code
        });
        
        return res.status(500).json({ 
            success: false,
            error: 'Impossible d\'initialiser le paiement',
            message: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

/**
 * Webhook Flutterwave.
 * Appelé par Flutterwave après chaque transaction (succès ou échec).
 * Sécurisé via le header "verif-hash".
 */
export const flutterwaveWebhook = async (req, res) => {
    try {
        // 1. Vérification de la signature du webhook
        if (!verifyFlutterwaveSignature(req)) {
            console.warn('[FLW Webhook] Signature invalide — requête rejetée');
            return res.status(401).send('Unauthorized');
        }

        const payload = req.body;
        const event = payload.event;

        // On ne traite que les événements de paiement
        if (event !== 'charge.completed') {
            return res.status(200).send('Event ignoré');
        }

        const flwTxId = payload.data?.id;           // ID Flutterwave de la transaction
        const ourTxId = payload.data?.tx_ref;        // Notre tx_ref (= txId NewKet)
        const status  = payload.data?.status;         // 'successful', 'failed', 'pending'

        console.log(`[FLW Webhook] Événement: ${event} | TX: ${ourTxId} | Statut: ${status}`);

        // 2. Double vérification auprès de l'API Flutterwave (sécurité)
        const verifiedPayment = await verifyFlutterwavePayment(flwTxId);

        if (!verifiedPayment) {
            console.error('[FLW Webhook] Paiement non vérifiable via API Flutterwave');
            return res.status(400).send('Paiement non vérifiable');
        }

        const client = supabaseAdmin || supabase;

        if (verifiedPayment.status === 'successful') {
            // ─── VALIDATION ATOMIQUE : Stock + Statut commande ────────────────
            const { data: rpcData, error: rpcError } = await client.rpc('process_order_payment', {
                p_transaction_id: ourTxId
            });

            if (rpcError || (rpcData && !rpcData.success)) {
                console.error('[FLW Webhook] Erreur RPC process_order_payment:', rpcError || rpcData?.message);
                return res.status(500).send('Erreur lors de la validation atomique');
            }

            console.log(`✅ [FLW Webhook] Commande ${ourTxId} validée (stock décrémenté)`);

            // Notification au vendeur
            const { data: orderInfo } = await client
                .from('orders')
                .select('id')
                .eq('transaction_id', ourTxId)
                .single();

            if (orderInfo) {
                NotificationService.notifyOrderSuccess(orderInfo.id);
            }

        } else {
            // Paiement échoué ou annulé
            const { error: dbUpdateError } = await client
                .from('orders')
                .update({
                    payment_status: 'FAILED',
                    status: 'ANNULÉ'
                })
                .eq('transaction_id', ourTxId);

            if (dbUpdateError) {
                console.error('[FLW Webhook] Erreur mise à jour DB (Échec):', dbUpdateError);
                return res.status(500).send('Erreur DB');
            }

            console.log(`[FLW Webhook] Commande ${ourTxId} marquée comme ANNULÉE`);
        }

        // Répondre 200 pour que Flutterwave arrête de renvoyer la notification
        return res.status(200).send('OK');

    } catch (err) {
        console.error('❌ Erreur flutterwaveWebhook:', err);
        return res.status(500).send('Erreur interne');
    }
};
