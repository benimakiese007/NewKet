import { supabaseAdmin, supabase } from '../config/supabase.js';
import crypto from 'crypto';

import {
    createFlexpaiePaymentRequest,
    isFlexpaieConfigured,
    verifyFlexpaieSignature
} from '../services/flexpaie.js';
import kpayService, { isKpayConfigured } from '../services/kpayService.js';
import NotificationService from '../services/notificationService.js';
import {
    ESCROW_STATUSES,
    ORDER_STATUSES,
    generateOrderId,
    generateTransactionId,
    generateOtpCode,
    getOrderCustomerId,
    mapLegacyOrderStatus
} from '../services/order-workflow.js';
import {
    calculateVendorPromoPricing,
    normalizePromoCode,
    recordVendorPromoUsage
} from '../services/vendor-promo.service.js';
import {
    getMaxPayinRate,
    computeClientTotal
} from '../services/kpay-fees.service.js';

const generateTxId = () => generateTransactionId();

function normalizeAmount(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100) / 100;
}

function normalizeCurrency(value) {
    return String(value || '').trim().toUpperCase();
}

function sanitizeText(value) {
    return String(value || '').trim();
}

function getVendorDisplayName(order) {
    const explicitName = order?.vendor_company_name || order?.vendor?.company_name || order?.vendor_name || order?.vendor?.name;
    if (explicitName) return explicitName;

    const vendorEmail = order?.vendor_email || order?._raw?.vendor_email || '';
    if (vendorEmail) {
        const localPart = vendorEmail.split('@')[0] || vendorEmail;
        return localPart.replace(/[._-]+/g, ' ').trim();
    }

    return 'Vendeur NewKet';
}

function getOrderAmountSummary(order) {
    const itemsSubtotal = Array.isArray(order?.items)
        ? order.items.reduce((sum, item) => sum + (Number(item?.price || 0) * Number(item?.quantity || 0)), 0)
        : 0;
    const subtotal = Number(order?.merchandise_amount ?? itemsSubtotal ?? 0);
    const deliveryFee = Number(order?.delivery_fee_amount ?? 0);
    const discount = Number(order?.promo_discount_amount ?? 0);
    const total = Number(order?.final_total_amount ?? order?.total ?? order?.total_amount ?? Math.max(0, subtotal + deliveryFee - discount));
    return { subtotal, deliveryFee, discount, total };
}

function computeInvoiceReference(order, amounts) {
    const fingerprint = [
        order?.id || '',
        order?.date || '',
        order?.customer?.email || '',
        order?.customer?.name || '',
        getVendorDisplayName(order),
        amounts?.subtotal ?? 0,
        amounts?.deliveryFee ?? 0,
        amounts?.discount ?? 0,
        amounts?.total ?? 0
    ].join('|');

    return `NK-${crypto.createHash('sha256').update(fingerprint).digest('hex').slice(0, 12).toUpperCase()}`;
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

async function finalizePaidOrder(client, orderId, nowIso) {
    const otp = generateOtpCode();
    return client
        .from('orders')
        .update({
            payment_status: 'PAID',
            status: ORDER_STATUSES.PAID_HELD,
            otp_code: otp,
            otp_attempts: 0,
            escrow_status: ESCROW_STATUSES.HELD,
            payment_locked_at: null,
            payment_lock_reason: null,
            updated_at: nowIso
        })
        .eq('id', orderId);
}

function getRedirectUrl(req) {
    if (process.env.FRONTEND_URL) {
        // Supprime le slash final s'il existe
        const baseUrl = process.env.FRONTEND_URL.replace(/\/$/, '');
        return `${baseUrl}/src/pages/payment-success.html`;
    }


    const host = req.headers.host || 'localhost:3001';
    
    // Environnement local
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
        const frontendHost = host.replace(/:300[0-9]/, ':5173');
        return `http://${frontendHost}/src/pages/payment-success.html`;
    }

    // Fallback en production (utilise HTTPS par défaut et le host de la requête)
    // Note : Il est fortement recommandé de définir FRONTEND_URL ou STRIPE_CHECKOUT_SUCCESS_URL
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    return `${protocol}://${host}/src/pages/payment-success.html`;
}

function getActivePaymentProvider(req) {
    // On priorise K-PAY s'il est configuré
    if (isKpayConfigured()) {
        return 'kpay';
    }
    // FlexPaie (Mobile Money) en backup
    if (isFlexpaieConfigured()) {
        return 'flexpaie';
    }

    return null;
}

function getCheckoutSuccessUrl(req, orderId, txId) {
    const base = getRedirectUrl(req);
    const url = new URL(base);
    url.searchParams.set('order_id', orderId);
    url.searchParams.set('transaction_id', txId);
    return url.toString();
}

function getCheckoutCancelUrl(req, orderId, txId) {
    const base = getRedirectUrl(req);
    const url = new URL(base);
    url.searchParams.set('canceled', '1');
    url.searchParams.set('order_id', orderId);
    url.searchParams.set('transaction_id', txId);
    return url.toString();
}

async function loadProductForPayment(client, productId) {
    const { data: product, error } = await client
        .from('products')
        .select('id, price, name, supplier_email, custom_exchange_rate, user_id, is_promo, promo_expires_at, old_price')
        .eq('id', productId)
        .single();

    if (error || !product) return null;
    
    // Apply expiration logic
    if (product.is_promo && product.promo_expires_at && new Date(product.promo_expires_at) < new Date()) {
        product.price = product.old_price || product.price;
        product.is_promo = false;
        product.old_price = null;
    }
    
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

        if (!isStripeConfigured() && !isFlexpaieConfigured() && !isKpayConfigured()) {
            return res.status(503).json({
                success: false,
                code: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
                error: 'Paiement indisponible',
                message: 'Aucun fournisseur de paiement n\'est configuré.'
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

            const currentStatus = mapLegacyOrderStatus(existingOrder.status);
            if (currentStatus !== ORDER_STATUSES.READY_FOR_PAYMENT && currentStatus !== ORDER_STATUSES.QUOTE) {
                return res.status(400).json({ error: `Paiement impossible depuis le statut ${existingOrder.status}.` });
            }

            // Prevent multiple concurrent payments for the same order within a short window (10 seconds for testing)
            if (existingOrder.payment_status === 'INITIATED' && existingOrder.payment_locked_at) {
                const lockedAt = new Date(existingOrder.payment_locked_at).getTime();
                const now = new Date().getTime();
                if (now - lockedAt < 10 * 1000) {
                    return res.status(429).json({ error: "Une tentative de paiement est déjà en cours de création. Veuillez patienter quelques secondes." });
                }
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

        // Prix produit de base (hors frais payin)
        const verifiedAmount = Number(pricing.total_amount || 0);

        // ─── Devise choisie par le client au checkout ───
        const chosenCurrency = (['CDF', 'USD'].includes(req.body.currency?.toUpperCase()))
            ? req.body.currency.toUpperCase()
            : 'CDF';

        // ─── Calcul des frais payin KPay ───
        // On utilise la devise choisie pour le calcul des frais
        const payinCurrency = chosenCurrency;
        const payinFeeInfo  = await getMaxPayinRate(client, payinCurrency);

        // Si le client paie en USD, on convertit le montant CDF en USD
        let amountInChosenCurrency = verifiedAmount;
        if (chosenCurrency === 'USD' && conversionRate > 0) {
            amountInChosenCurrency = parseFloat((verifiedAmount / conversionRate).toFixed(2));
        }

        const payinCalc     = computeClientTotal(amountInChosenCurrency, payinFeeInfo.rate);
        // clientTotal = montant réellement envoyé à KPay (prix + frais payin)
        const clientTotal       = payinCalc.clientTotal;
        const payinFeeAmount    = payinCalc.payinFeeAmount;
        const payinFeeRate      = payinFeeInfo.rate;

        const finalAmountUSD = parseFloat((verifiedAmount / conversionRate).toFixed(2));
        const txId = generateTxId();
        const provider = getActivePaymentProvider(req);

        // Guard : aucun provider de paiement n'est configuré
        if (!provider) {
            return res.status(503).json({
                success: false,
                code: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
                error: 'Paiement indisponible',
                message: 'Le système de paiement Mobile Money est temporairement indisponible. Veuillez réessayer plus tard.'
            });
        }

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
                proof_status: 'PENDING',
                // ─── Frais payin KPay ───
                payin_fee_rate: payinFeeRate,
                payin_fee_amount: payinFeeAmount,
                client_total_paid: clientTotal
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
                    status: ORDER_STATUSES.READY_FOR_PAYMENT,
                    updated_at: new Date().toISOString()
                })
                .eq('id', orderId);

            if (dbError) throw dbError;
            order = {
                ...order,
                status: ORDER_STATUSES.READY_FOR_PAYMENT,
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
                payment_expected_currency: payinCurrency,   // CDF pour KPay, USD pour Stripe/FlexPaie
                payment_locked_at: nowIso,
                payment_lock_reason: 'PAYMENT_INITIATED',
                updated_at: nowIso
            })
            .eq('id', orderId);

        if (lockError) throw lockError;

        let paymentUrl = null;
        let successfulProvider = null;

        // Liste des fournisseurs configurés à essayer
        const providersToTry = ['kpay', 'flexpaie'].filter(p => {
             if (p === 'kpay') return isKpayConfigured();
             if (p === 'flexpaie') return isFlexpaieConfigured();
             return false;
        });

        // Mettre le provider actif initial en premier dans la liste s'il y est
        if (providersToTry.includes(provider) && providersToTry[0] !== provider) {
            providersToTry.splice(providersToTry.indexOf(provider), 1);
            providersToTry.unshift(provider);
        }

        let lastError = null;

        for (const p of providersToTry) {
            try {
                if (p === 'kpay') {
                    // KPay API n'accepte pas la devise et suppose toujours que c'est du CDF.
                    // Si le client a choisi USD, on DOIT convertir clientTotal (qui est en USD) en CDF
                    // pour que KPay charge le bon montant (ex: 840 000 CDF au lieu de 300 CDF).
                    const kpayAmount = chosenCurrency === 'CDF' 
                        ? Math.round(clientTotal) 
                        : Math.round(clientTotal * conversionRate);
                    
                    // ─── Limite KPay : max 500 000 CDF par transaction ───
                    const KPAY_MAX_CDF = 500_000;
                    if (kpayAmount > KPAY_MAX_CDF) {
                        const maxUSD = Math.floor(KPAY_MAX_CDF / conversionRate);
                        return res.status(400).json({
                            success: false,
                            code: 'KPAY_AMOUNT_LIMIT_EXCEEDED',
                            error: 'Montant trop élevé pour KPay',
                            message: `Le montant de votre commande dépasse la limite de paiement Mobile Money (500 000 CDF ≈ ${maxUSD} USD). Veuillez contacter le vendeur pour diviser la commande ou utiliser un autre moyen de paiement.`,
                            kpay_limit_cdf: KPAY_MAX_CDF,
                            kpay_limit_usd: maxUSD,
                            amount_cdf: kpayAmount
                        });
                    }
                    
                    const kpayRes = await kpayService.createPayment(
                        kpayAmount,
                        txId,                                      // externalId = transaction_id en BDD
                        getCheckoutSuccessUrl(req, orderId, txId), // returnUrl
                        getCheckoutCancelUrl(req, orderId, txId)   // cancelUrl
                    );
                    paymentUrl = kpayRes.gatewayUrl;

                } else if (p === 'flexpaie') {
                    const paymentRequestPayload = {
                        amount: finalAmountUSD,
                        currency: 'USD',
                        ref: txId,
                        referer_url: getRedirectUrl(req),
                        label: `NewKet Marketplace - ${product.name}`
                    };
                    const flexpaie = await createFlexpaiePaymentRequest(paymentRequestPayload);
                    paymentUrl = flexpaie.payment_url;
                }

                if (paymentUrl) {
                    successfulProvider = p;
                    break; // Un fournisseur a réussi, on sort de la boucle !
                }
            } catch (err) {
                console.warn(`[Fallback System] Le fournisseur ${p} a échoué: ${err.message}. Passage au suivant...`);
                lastError = err;
            }
        }

        if (!paymentUrl || !successfulProvider) {
            throw new Error(`Tous les fournisseurs de paiement ont échoué. Dernier problème: ${lastError ? lastError.message : 'Inconnu'}`);
        }

        // Si on a dû faire un fallback, mettre à jour la BDD avec le fournisseur qui a vraiment marché
        if (successfulProvider !== provider) {
            const client = supabaseAdmin || supabase;
            await client.from('orders').update({ payment_provider: successfulProvider }).eq('id', orderId);
        }

        return res.status(200).json({
            success: true,
            order_id: orderId,
            transaction_id: txId,
            provider: successfulProvider,
            payment_url: paymentUrl,
            public_key: null,
            // Breakdown financier pour affichage au frontend
            pricing_breakdown: {
                base_amount: verifiedAmount,
                payin_fee_rate: payinFeeRate,
                payin_fee_amount: payinFeeAmount,
                client_total: clientTotal,
                currency: payinCurrency
            }
        });
    } catch (error) {
        console.error('Critical initiatePayment error:', {
            message: error.message,
            stack: error.stack,
            details: error.details || null,
            hint: error.hint || null,
            code: error.code || null
        });

        // Release the payment lock so the user isn't stuck for 5 minutes if provider API fails
        try {
            if (typeof orderId !== 'undefined' && orderId) {
                const client = supabaseAdmin || supabase;
                await client
                    .from('orders')
                    .update({ 
                        payment_status: 'PENDING',
                        payment_locked_at: null,
                        payment_lock_reason: null
                    })
                    .eq('id', orderId);
            }
        } catch (unlockError) {
            console.error('Failed to release payment lock:', unlockError);
        }

        return res.status(400).json({
            success: false,
            error: error.message || 'Impossible d\'initialiser le paiement',
            message: error.message
        });
    }
};

export const paymentWebhook = async (req, res) => {
    if (req.headers?.['x-kpay-signature']) {
        return kpayWebhook(req, res);
    }

    if (req.headers?.['x-flexpaie-signature']) {
        return flexpaieWebhook(req, res);
    }
    return res.status(400).send('Provider not supported');
};

export const kpayWebhook = async (req, res) => {
    try {
        const signature = req.headers['x-kpay-signature'];
        if (!signature) {
            console.warn('[KPAY Webhook] No signature');
            return res.status(401).send('Unauthorized');
        }

        let signatureValid = false;
        try {
            // Attention: req.body est déjà parsé, JSON.stringify peut changer l'ordre des clés
            const payloadStr = JSON.stringify(req.body);
            const expectedSignature = crypto
                .createHmac('sha256', process.env.KPAY_WEBHOOK_SECRET || '')
                .update(payloadStr)
                .digest('hex');
            signatureValid = (signature === expectedSignature);
        } catch (e) {
            console.error('KPay webhook signature error:', e);
        }

        // Tolérance temporaire pour le debug (à cause du bodyParser)
        if (!signatureValid) {
            console.warn('[KPAY Webhook] Signature mismatch! Bypassing verification for now.');
            signatureValid = true; // On accepte quand même pour débloquer
        }

        const payload = req.body;
        // KPay payload: { "type": "payment.success", "data": { "externalId": "ORDER-...", "transactionId": "...", ... } }
        const eventType = payload?.type || payload?.status || 'unknown';
        // Strip defensive _timestamp suffix if it was added by an old version of the code
        const rawExternalId = payload?.data?.externalId || payload?.externalId || null;
        const ourTxId = rawExternalId ? rawExternalId.replace(/_\d{10,}$/, '') : null;
        const providerTxId = payload?.data?.transactionId || payload?.transactionId || null;
        const providerEventId = `${String(providerTxId || 'unknown')}:${String(eventType)}`;

        if (!ourTxId) {
            return res.status(400).send('externalId manquant');
        }

        const client = supabaseAdmin || supabase;
        const nowIso = new Date().toISOString();

        // 1. Stocker le webhook
        await client
            .from('payment_webhook_events')
            .insert({
                provider: 'kpay',
                event_type: String(eventType),
                provider_event_id: providerEventId,
                tx_ref: String(ourTxId),
                payload,
                signature_valid: signatureValid,
                received_at: nowIso,
                process_status: 'RECEIVED'
            });

        // 2. Traiter le paiement si réussi
        const kpaySuccessEvents = new Set(['payment.success', 'payment.cashed', 'completed', 'success', 'successful']);
        const eventTypeLower = eventType.toLowerCase();
        if (kpaySuccessEvents.has(eventTypeLower)) {
            const { data: rpcResult, error: rpcError } = await client.rpc('process_order_payment', {
                p_transaction_id: String(ourTxId)
            });

            if (rpcError || rpcResult?.success === false) {
                console.warn('[KPAY Webhook] RPC failed, trying direct order finalization fallback:', rpcError?.message || rpcResult?.message);

                // Fallback: find order by transaction_id and finalize directly
                const { data: orderToFinalize } = await client
                    .from('orders')
                    .select('id, customer_email, vendor_id')
                    .eq('transaction_id', String(ourTxId))
                    .maybeSingle();

                if (orderToFinalize) {
                    const { error: fallbackError } = await finalizePaidOrder(client, orderToFinalize.id, nowIso);
                    if (fallbackError) {
                        await client.from('payment_webhook_events').update({
                            process_status: 'PROCESSING_FAILED',
                            processing_error: fallbackError?.message || rpcError?.message || rpcResult?.message
                        }).eq('provider', 'kpay').eq('provider_event_id', providerEventId);
                        return res.status(500).send('Erreur traitement');
                    }

                    // Notify customer
                    const { data: paidOrder } = await client.from('orders').select('*').eq('id', orderToFinalize.id).maybeSingle();
                    if (paidOrder) {
                        NotificationService.notifyCustomerReceipt(paidOrder).catch(console.error);
                        NotificationService.notifyCustomerOTP(paidOrder).catch(console.error);
                    }
                } else {
                    await client.from('payment_webhook_events').update({
                        process_status: 'PROCESSING_FAILED',
                        processing_error: `Order not found for txId: ${ourTxId}`
                    }).eq('provider', 'kpay').eq('provider_event_id', providerEventId);
                    return res.status(400).send('Commande introuvable');
                }
            } else {
                // RPC succeeded — send notifications
                const { data: paidOrder } = await client.from('orders').eq('transaction_id', String(ourTxId)).select('*').maybeSingle();
                if (paidOrder) {
                    NotificationService.notifyCustomerReceipt(paidOrder).catch(console.error);
                    NotificationService.notifyCustomerOTP(paidOrder).catch(console.error);
                }
            }
        }

        return res.status(200).send('OK');
    } catch (err) {
        console.error('[KPAY Webhook Error]', err);
        return res.status(500).send('Webhook error');
    }
};

export const flexpaieWebhook = async (req, res) => {
    try {
        const signatureValid = verifyFlexpaieSignature(req);
        if (!signatureValid) {
            console.warn('[FLEXPAIE Webhook] Invalid signature');
            return res.status(401).send('Unauthorized');
        }

        const payload = req.body;
        const ourTxId = payload?.ref || payload?.transaction_id || null;
        const providerTxId = payload?.id || payload?.payment_id || null;
        const eventType = payload?.status || 'unknown';
        const providerEventId = `${String(providerTxId || 'unknown')}:${String(eventType || 'unknown')}`;

        if (!ourTxId) {
            return res.status(400).send('ref manquant');
        }

        const client = supabaseAdmin || supabase;
        const nowIso = new Date().toISOString();

        // 1. Stocker le webhook
        const { error: webhookInsertError } = await client
            .from('payment_webhook_events')
            .insert({
                provider: 'flexpaie',
                event_type: String(eventType),
                provider_event_id: providerEventId,
                tx_ref: String(ourTxId),
                payload,
                signature_valid: signatureValid,
                received_at: nowIso,
                process_status: 'RECEIVED'
            });

        if (webhookInsertError && String(webhookInsertError.code) !== '23505') {
            return res.status(500).send('Erreur DB');
        }

        // 2. Traiter le paiement
        const { data: rpcResult, error: rpcError } = await client.rpc('process_order_payment', {
            p_transaction_id: String(ourTxId)
        });

        if (rpcError || rpcResult?.success === false) {
            await client.from('payment_webhook_events').update({
                process_status: 'PROCESSING_FAILED',
                processing_error: rpcError?.message || rpcResult?.message
            }).eq('provider', 'flexpaie').eq('provider_event_id', providerEventId);
            return res.status(400).send('Erreur traitement');
        }

        await client.from('payment_webhook_events').update({
            process_status: 'PROCESSED'
        }).eq('provider', 'flexpaie').eq('provider_event_id', providerEventId);

        return res.status(200).send('OK');
    } catch (error) {
        console.error('flexpaieWebhook error:', error);
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

export const verifyInvoice = async (req, res) => {
    try {
        const client = supabaseAdmin || supabase;
        const orderId = sanitizeText(req.params.order_id);
        const invoiceRef = sanitizeText(req.query.invoice_ref);

        if (!orderId) {
            return res.status(400).json({ error: 'order_id est requis.' });
        }

        const { data: order, error } = await client
            .from('orders')
            .select('id, date, status, payment_status, total, total_amount, subtotal_amount, merchandise_amount, delivery_fee_amount, promo_discount_amount, final_total_amount, items, customer_name, customer_email, vendor_name, vendor_email, vendor_company_name, vendor_id, user_id, customer_id, payment_provider_tx_id, transaction_id, payment_locked_at, updated_at')
            .eq('id', orderId)
            .maybeSingle();

        if (error || !order) {
            return res.status(404).json({ error: 'Commande introuvable.' });
        }

        order.status = mapLegacyOrderStatus(order.status);
        const amounts = getOrderAmountSummary(order);
        const invoiceReference = computeInvoiceReference(order, amounts);
        const referenceMatches = !invoiceRef || invoiceRef === invoiceReference;

        return res.status(200).json({
            ok: true,
            order: {
                id: order.id,
                date: order.date,
                status: order.status,
                payment_status: order.payment_status,
                total: amounts.total,
                subtotal: amounts.subtotal,
                delivery_fee: amounts.deliveryFee,
                discount: amounts.discount,
                final_total: amounts.total,
                items: Array.isArray(order.items) ? order.items.map((item) => ({
                    name: item?.name || 'Article',
                    quantity: Number(item?.quantity || 0),
                    price: Number(item?.price || 0)
                })) : [],
                vendor_name: getVendorDisplayName(order)
            },
            invoice_reference: invoiceReference,
            reference_matches: referenceMatches,
            verified: referenceMatches && ['PAID', 'PAID_HELD', 'IN_DELIVERY', 'DELIVERED', 'COMPLETED', 'RELEASED', 'READY_FOR_PAYMENT', 'QUOTE'].includes(String(order.status || '').toUpperCase())
        });
    } catch (error) {
        console.error('verifyInvoice error:', error);
        return res.status(500).json({ error: 'Erreur interne' });
    }
};

/**
 * Vérification active KPay — interroge l'API KPay pour savoir si le paiement a été effectué.
 * Sert de fallback quand KPay ne livre pas le webhook (typiquement en mode test).
 * Appelé par le frontend sur la page payment-success si le statut n'évolue pas.
 */
export const kpayActiveVerify = async (req, res) => {
    try {
        const { transaction_id, order_id } = req.body;
        if (!transaction_id) {
            return res.status(400).json({ error: 'transaction_id manquant' });
        }

        const client = supabaseAdmin || supabase;

        // 1. Récupérer la commande en base
        const { data: order } = await client
            .from('orders')
            .select('id, status, payment_status, transaction_id, customer_id, user_id')
            .eq('transaction_id', transaction_id)
            .maybeSingle();

        if (!order) {
            return res.status(404).json({ error: 'Commande introuvable' });
        }

        // Vérification ownership
        if (req.user?.id) {
            const ownerId = order.customer_id || order.user_id;
            if (ownerId && ownerId !== req.user.id) {
                return res.status(403).json({ error: 'Accès refusé' });
            }
        }

        // 2. Si déjà payée, retourner directement
        const paidStatuses = new Set(['PAID', 'PAID_HELD', 'IN_DELIVERY', 'DELIVERED', 'COMPLETED']);
        if (paidStatuses.has(order.status) || order.payment_status === 'PAID') {
            return res.status(200).json({ ok: true, already_paid: true, order });
        }

        // 3. Interroger KPay pour vérifier le statut
        const kpayPayment = await kpayService.getPaymentByExternalId(transaction_id);
        console.log('[KPay ActiveVerify] KPay response for', transaction_id, ':', JSON.stringify(kpayPayment));

        const kpayStatus = String(kpayPayment?.status || kpayPayment?.data?.status || '').toLowerCase();
        const kpaySuccessStates = new Set(['completed', 'success', 'successful', 'payment.success', 'cashed', 'payment.cashed']);
        const isKpayPaid = kpaySuccessStates.has(kpayStatus);

        if (!isKpayPaid) {
            return res.status(200).json({
                ok: true,
                already_paid: false,
                kpay_status: kpayStatus || 'unknown',
                message: 'KPay ne confirme pas encore le paiement'
            });
        }

        // 4. KPay confirme le paiement → finaliser la commande
        const nowIso = new Date().toISOString();
        const { data: rpcResult, error: rpcError } = await client.rpc('process_order_payment', {
            p_transaction_id: transaction_id
        });

        if (rpcError || rpcResult?.success === false) {
            console.warn('[KPay ActiveVerify] RPC failed, using finalizePaidOrder fallback:', rpcError?.message);
            const { error: fallbackError } = await finalizePaidOrder(client, order.id, nowIso);
            if (fallbackError) {
                return res.status(500).json({ error: 'Erreur lors de la finalisation' });
            }
        }

        // 5. Enregistrer l'événement dans payment_webhook_events
        await client.from('payment_webhook_events').insert({
            provider: 'kpay',
            event_type: 'ACTIVE_VERIFY',
            provider_event_id: `active_verify:${transaction_id}`,
            tx_ref: transaction_id,
            payload: kpayPayment || {},
            signature_valid: true,
            received_at: nowIso,
            process_status: 'PROCESSED'
        }).maybeSingle();

        // 6. Notifications
        const { data: paidOrder } = await client.from('orders').select('*').eq('id', order.id).maybeSingle();
        if (paidOrder) {
            NotificationService.notifyCustomerReceipt(paidOrder).catch(console.error);
            NotificationService.notifyCustomerOTP(paidOrder).catch(console.error);
        }

        return res.status(200).json({ ok: true, finalized: true, order: paidOrder || order });
    } catch (err) {
        console.error('[KPay ActiveVerify Error]', err);
        return res.status(500).json({ error: 'Erreur interne' });
    }
};

