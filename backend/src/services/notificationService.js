import { supabaseAdmin } from '../config/supabase.js';
import EmailService from './emailService.js';
import { enqueuePushNotification } from './push-queue.service.js';

function getFrontendBaseUrl() {
    return (process.env.FRONTEND_URL || 'https://newket.vercel.app').replace(/\/+$/, '');
}

async function createDbNotification(payload) {
    const { error } = await supabaseAdmin
        .from('notifications')
        .insert(payload);

    if (error) {
        console.error('[NotificationService] Error creating DB notification:', error);
        return;
    }

    try {
        const job = await enqueuePushNotification(payload);
        if (job?.id) {
            console.log(`[NotificationService] Web push queued: ${job.id}`);
        }
    } catch (err) {
        console.error('[NotificationService] Web push error:', err);
    }
}

async function fetchOrder(orderId) {
    const { data, error } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

    if (error || !data) {
        console.error('[NotificationService] Order not found:', error);
        return null;
    }

    return data;
}

async function fetchUserById(userId) {
    if (!userId) return null;

    const { data, error } = await supabaseAdmin
        .from('users')
        .select('id, email, name, role')
        .eq('id', userId)
        .single();

    if (error || !data) {
        console.error(`[NotificationService] User ${userId} not found:`, error);
        return null;
    }

    return data;
}

const NotificationService = {
    async notifyVendorOrderRequest(order) {
        if (!order?.id || !order?.vendor_id) return;

        try {
            const vendor = await fetchUserById(order.vendor_id);
            if (!vendor?.email) return;

            const firstItem = Array.isArray(order.items) ? order.items[0] : null;
            const productName = firstItem?.name || 'Produit NewKet';
            const locationText = order.customer_city || 'Localisation non precisee';
            const gpsText = order.customer_lat && order.customer_lng
                ? `${order.customer_lat}, ${order.customer_lng}`
                : 'Non capture';

            await createDbNotification({
                id: `notif-order-request-${order.id}-${vendor.id}`,
                user_id: vendor.id,
                user_email: vendor.email,
                title: 'Nouvelle demande client',
                message: `${order.customer_name || 'Un client'} demande ${productName}. Ville: ${locationText}.`,
                type: 'info',
                target_role: 'supplier',
                read: false,
                date: new Date().toISOString()
            });

            EmailService.sendMail({
                to: vendor.email,
                subject: `Nouvelle demande client pour ${productName}`,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
                        <h2 style="color: #111827;">Nouvelle demande recue</h2>
                        <p>Bonjour <b>${vendor.name || 'Vendeur'}</b>,</p>
                        <p>Un client vient d'envoyer une fiche de commande pour <b>${productName}</b>.</p>
                        <div style="background: #f9fafb; padding: 15px; border-radius: 10px; margin: 20px 0;">
                            <p><b>Client :</b> ${order.customer_name || 'Client NewKet'}</p>
                            <p><b>Telephone :</b> ${order.customer_phone || 'Non renseigne'}</p>
                            <p><b>Ville :</b> ${locationText}</p>
                            <p><b>GPS :</b> ${gpsText}</p>
                        </div>
                        <p>Definissez maintenant votre devis de livraison selon la localisation et le jour convenu.</p>
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="${getFrontendBaseUrl()}/pages/vendor-dashboard.html" style="background-color: #000; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 10px; font-weight: bold;">Ouvrir mon tableau vendeur</a>
                        </div>
                    </div>
                `
            }).catch(err => console.error('[NotificationService] Lead email error:', err));
        } catch (error) {
            console.error('[NotificationService] notifyVendorOrderRequest error:', error);
        }
    },

    async notifyCustomerQuoteAvailable(order, quote) {
        if (!order?.customer_email || !quote) return;

        try {
            const customerId = order.user_id || order.customer_id || null;
            await createDbNotification({
                id: `notif-order-quote-${order.id}-${quote.id}`,
                ...(customerId ? { user_id: customerId } : {}),
                user_email: order.customer_email,
                title: 'Votre devis de livraison est pret',
                message: `Le vendeur a propose ${Number(quote.delivery_fee_amount || 0)} CDF de livraison pour la commande ${order.id}.`,
                type: 'info',
                target_role: 'customer',
                read: false,
                date: new Date().toISOString()
            });

            EmailService.sendMail({
                to: order.customer_email,
                subject: 'Votre devis de livraison NewKet est disponible',
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
                        <h2 style="color: #111827;">Votre devis est pret</h2>
                        <p>Bonjour <b>${order.customer_name || 'Client'}</b>,</p>
                        <p>Le vendeur a etudie votre localisation et vient de publier son devis de livraison.</p>
                        <div style="background: #fffbeb; padding: 15px; border-radius: 10px; margin: 20px 0;">
                            <p><b>Montant livraison :</b> ${Number(quote.delivery_fee_amount || 0)} CDF</p>
                            <p><b>Delai estime :</b> ${quote.estimated_delay_hours || 0} h</p>
                            <p><b>Note vendeur :</b> ${quote.note || 'Aucune note ajoutee.'}</p>
                        </div>
                        <p>Si vous acceptez ce devis, vous pourrez passer au paiement securise en sequestre.</p>
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="${getFrontendBaseUrl()}/pages/customer-dashboard.html" style="background-color: #000; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 10px; font-weight: bold;">Voir ma demande</a>
                        </div>
                    </div>
                `
            }).catch(err => console.error('[NotificationService] Quote email error:', err));
        } catch (error) {
            console.error('[NotificationService] notifyCustomerQuoteAvailable error:', error);
        }
    },

    async notifyOrderSuccess(orderId) {
        try {
            console.log(`[NotificationService] Sending notifications for order ${orderId}`);

            const order = await fetchOrder(orderId);
            if (!order) return;

            const items = Array.isArray(order.items) ? order.items : [];
            if (items.length === 0) {
                console.warn('[NotificationService] No items found in order');
                return;
            }

            const vendorsToNotify = new Set();
            for (const item of items) {
                if (item?.vendor_id) {
                    vendorsToNotify.add(item.vendor_id);
                }
            }

            for (const vendorId of vendorsToNotify) {
                const vendor = await fetchUserById(vendorId);
                if (!vendor?.email) continue;

                await createDbNotification({
                    id: `notif-order-paid-${orderId}-${vendorId}`,
                    user_id: vendorId,
                    user_email: vendor.email,
                    title: 'Nouvelle commande payee',
                    message: 'Un paiement a ete recu pour votre commande.',
                    type: 'success',
                    target_role: 'supplier',
                    read: false,
                    date: new Date().toISOString()
                });

                EmailService.sendMail({
                    to: vendor.email,
                    subject: 'Nouveau paiement recu sur NewKet',
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
                            <h2 style="color: #10b981;">Paiement confirme</h2>
                            <p>Bonjour <b>${vendor.name || 'Vendeur'}</b>,</p>
                            <p>Une nouvelle commande a ete payee avec succes sur votre boutique NewKet.</p>
                            <div style="background: #f9f9f9; padding: 15px; border-radius: 10px; margin: 20px 0;">
                                <p><b>Commande:</b> ${order.id}</p>
                                <p><b>Montant:</b> ${order.total_amount} ${process.env.CURRENCY || 'CDF'}</p>
                                <p><b>Client:</b> ${order.customer_name || 'Client NewKet'}</p>
                            </div>
                            <p>Le paiement est maintenant en attente de validation. Vous pouvez organiser la livraison.</p>
                            <div style="text-align: center; margin-top: 30px;">
                                <a href="${getFrontendBaseUrl()}/pages/vendor-dashboard.html" style="background-color: #000; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 10px; font-weight: bold;">Voir mes commandes</a>
                            </div>
                        </div>
                    `
                }).catch(err => console.error('[NotificationService] Payment email error:', err));
            }
        } catch (error) {
            console.error('[NotificationService] Global error:', error);
        }
    },

    async notifyCustomerOTP(order) {
        if (!order || !order.customer_email || !order.otp_code) return;

        try {
            console.log(`[NotificationService] Sending OTP to customer ${order.customer_email} for order ${order.id}`);

            const customerName = order.customer_name || 'Client';

            EmailService.sendMail({
                to: order.customer_email,
                subject: 'Votre code de livraison - NewKet',
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
                        <h2 style="color: #000;">Votre commande est en route</h2>
                        <p>Bonjour <b>${customerName}</b>,</p>
                        <p>Le paiement de votre commande est bien en attente de validation.</p>
                        <p>Le vendeur a ete notifie et peut demarrer la livraison.</p>
                        <div style="background: #fff8eb; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center; border: 2px dashed #f59e0b;">
                            <p style="margin: 0; color: #b45309; font-size: 14px;">CODE DE LIVRAISON</p>
                            <h1 style="font-size: 36px; margin: 10px 0; letter-spacing: 5px; color: #000;">${order.otp_code}</h1>
                        </div>
                        <div style="background: #fee2e2; padding: 15px; border-radius: 10px; margin: 20px 0; color: #991b1b; font-size: 14px;">
                            <strong>ATTENTION :</strong>
                            <ul style="margin-top: 5px; padding-left: 20px;">
                                <li>Ne donnez ce code qu'apres reception et verification du produit.</li>
                                <li>Si le produit n'est pas conforme, n'entrez pas ce code et signalez un probleme depuis votre espace client.</li>
                            </ul>
                        </div>
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="${getFrontendBaseUrl()}/pages/customer-dashboard.html" style="background-color: #000; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 10px; font-weight: bold;">Suivre ma commande</a>
                        </div>
                    </div>
                `
            }).catch(err => console.error('[NotificationService] Error sending OTP email:', err));
        } catch (error) {
            console.error('[NotificationService] OTP sending error:', error);
        }
    },

    async notifyCustomerReceipt(order) {
        if (!order || !order.customer_email) return;

        try {
            const customerName = order.customer_name || 'Client';
            const amount = order.total_amount || 0;
            const currency = process.env.CURRENCY || 'FC';

            EmailService.sendMail({
                to: order.customer_email,
                subject: 'Votre recu de paiement - NewKet',
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
                        <h2 style="color: #10b981;">Paiement confirme</h2>
                        <p>Bonjour <b>${customerName}</b>,</p>
                        <p>Nous confirmons la reception de votre paiement pour votre commande.</p>
                        <div style="background: #f9f9f9; padding: 15px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #10b981;">
                            <p><b>Total paye :</b> ${amount} ${currency}</p>
                            <p><b>Produit :</b> ${order.items && order.items[0] ? order.items[0].name : 'Article NewKet'}</p>
                        </div>
                        <p>Votre paiement est conserve en securite jusqu'a la livraison.</p>
                        <p>Merci pour votre confiance !</p>
                    </div>
                `
            }).catch(err => console.error('[NotificationService] Error sending receipt:', err));
        } catch (error) {
            console.error('[NotificationService] Receipt error:', error);
        }
    },

    async notifyCustomerReview(order) {
        if (!order || !order.customer_email) return;

        try {
            const customerName = order.customer_name || 'Client';

            EmailService.sendMail({
                to: order.customer_email,
                subject: 'Commande livree ! Laissez votre avis - NewKet',
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
                        <h2 style="color: #000;">Livraison confirmee</h2>
                        <p>Bonjour <b>${customerName}</b>,</p>
                        <p>Nous esperons que vous etes satisfait de votre commande.</p>
                        <p>Votre avis est précieux pour la communauté NewKet et aide les autres acheteurs à faire le bon choix.</p>
                        <div style="text-align: center; margin-top: 30px; margin-bottom: 30px;">
                            <a href="${getFrontendBaseUrl()}/pages/customer-dashboard.html" style="background-color: #000; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 10px; font-weight: bold;">Laisser un avis au vendeur</a>
                        </div>
                        <p style="font-size: 12px; color: #6b7280;">Si vous rencontrez un problème, vous pouvez nous contacter depuis votre espace client.</p>
                    </div>
                `
            }).catch(err => console.error('[NotificationService] Error sending review email:', err));
        } catch (error) {
            console.error('[NotificationService] Review email error:', error);
        }
    },

    async notifyVendorManualPayout(order) {
        if (!order?.vendor_id) return;

        try {
            const vendor = await fetchUserById(order.vendor_id);
            if (!vendor?.email) return;

            const amount = Number(order.total_amount || order.total || 0);
            const nowIso = new Date().toISOString();

            await createDbNotification({
                id: `notif-manual-payout-${order.id}-${vendor.id}`,
                user_id: vendor.id,
                user_email: vendor.email,
                title: 'Paiement vendeur en attente',
                message: 'La commande a ete validee, mais le versement au vendeur reste a traiter manuellement.',
                type: 'warning',
                target_role: 'supplier',
                read: false,
                date: nowIso
            });

            EmailService.sendMail({
                to: vendor.email,
                subject: 'Paiement vendeur a traiter manuellement - NewKet',
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
                        <h2 style="color: #111827;">Paiement vendeur en attente</h2>
                        <p>Bonjour <b>${vendor.name || 'Vendeur'}</b>,</p>
                        <p>La commande a ete validee.</p>
                        <div style="background: #fff7ed; padding: 15px; border-radius: 10px; margin: 20px 0;">
                            <p><b>Montant :</b> ${amount} ${process.env.CURRENCY || 'CDF'}</p>
                            <p><b>Statut :</b> transfert manuel requis</p>
                        </div>
                        <p>Le reglement vendeur doit encore etre finalise manuellement.</p>
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="${getFrontendBaseUrl()}/pages/vendor-dashboard.html" style="background-color: #000; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 10px; font-weight: bold;">Ouvrir mon tableau vendeur</a>
                        </div>
                    </div>
                `
            }).catch(err => console.error('[NotificationService] Manual payout email error:', err));

            await supabaseAdmin.from('activities').insert({
                user_email: vendor.email,
                user_id: vendor.id,
                type: 'warning',
                text: 'Commande validee : versement vendeur manuel a traiter.',
                time: nowIso
            });
        } catch (error) {
            console.error('[NotificationService] notifyVendorManualPayout error:', error);
        }
    },

    /**
     * T+0 - Notification immediate after delivery-code validation.
     * Tells the customer the 24h review period has started and that they can report a problem.
     * Also tells the vendor that the review period has started.
     */
    async notifyEscrowTimerStarted(order) {
        if (!order?.id) return;

        const releaseAt = order.escrow_release_at
            ? new Date(order.escrow_release_at).toLocaleString('fr-FR', { timeZone: 'Africa/Kinshasa' })
            : 'dans 24h';
        const customerName = order.customer_name || 'Client';
        const nowIso = new Date().toISOString();
        const customerId = order.user_id || order.customer_id || null;

        // --- Notification client ---
        try {
            if (order.customer_email) {
                await createDbNotification({
                    id: `notif-escrow-start-${order.id}`,
                    ...(customerId ? { user_id: customerId } : {}),
                    user_email: order.customer_email,
                    title: 'Votre delai de verification demarre',
                    message: 'Vous avez 24h pour verifier votre commande et signaler un probleme si necessaire.',
                    type: 'info',
                    target_role: 'customer',
                    read: false,
                    date: nowIso
                });

                EmailService.sendMail({
                    to: order.customer_email,
                    subject: 'Livraison confirmee - Verifiez votre commande dans les 24h',
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
                            <h2 style="color: #111827;">Livraison confirmee</h2>
                            <p>Bonjour <b>${customerName}</b>,</p>
                            <p>Votre commande a ete livree et le code de livraison a ete valide.</p>
                            <div style="background: #fffbeb; padding: 15px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                                <p style="margin: 0; font-weight: bold;">Delai de verification : 24 heures</p>
                                <p style="margin: 8px 0 0; color: #92400e;">Envoi automatique prevu le : <b>${releaseAt}</b></p>
                            </div>
                            <p>Pendant ce delai, verifiez soigneusement votre produit :</p>
                            <ul>
                                <li>Tout est conforme -> le paiement sera envoye automatiquement au vendeur</li>
                                <li>Probleme constate -> signalez-le depuis votre espace client</li>
                            </ul>
                            <div style="background: #fee2e2; padding: 15px; border-radius: 10px; margin: 20px 0; color: #991b1b; font-size: 14px;">
                                <strong>Important :</strong> Passe ce delai de 24h sans action de votre part, le paiement sera automatiquement envoye au vendeur.
                            </div>
                            <div style="text-align: center; margin-top: 30px;">
                                <a href="${getFrontendBaseUrl()}/pages/customer-dashboard.html" style="background-color: #000; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 10px; font-weight: bold;">Voir ma commande</a>
                            </div>
                        </div>
                    `
                }).catch(err => console.error('[NotificationService] verificationTimerStarted client email error:', err));
            }
        } catch (err) {
            console.error('[NotificationService] notifyEscrowTimerStarted client error:', err);
        }

        // --- Notification vendeur ---
        try {
            if (order.vendor_id) {
                const vendor = await fetchUserById(order.vendor_id);
                if (vendor?.email) {
                    await createDbNotification({
                        id: `notif-escrow-start-vendor-${order.id}`,
                        user_id: vendor.id,
                        user_email: vendor.email,
                        title: 'Delai de verification demarre',
                        message: "La commande a ete livree. Le paiement sera envoye automatiquement dans 24h si aucun probleme n'est signale.",
                        type: 'info',
                        target_role: 'supplier',
                        read: false,
                        date: nowIso
                    });
                }
            }
        } catch (err) {
            console.error('[NotificationService] notifyEscrowTimerStarted vendor error:', err);
        }
    },

    /**
     * T+12h - Reminder midway through the review period.
     * Sent via push_notification_jobs with available_at scheduled to delivered_at + 12h.
     * Reminds the customer that they have 12h left before automatic payment release.
     */
    async notifyEscrowReminder(order) {
        if (!order?.id || !order?.customer_email) return;

        const releaseAt = order.escrow_release_at
            ? new Date(order.escrow_release_at).toLocaleString('fr-FR', { timeZone: 'Africa/Kinshasa' })
            : 'dans 12h';
        const customerName = order.customer_name || 'Client';
        const customerId = order.user_id || order.customer_id || null;
        const nowIso = new Date().toISOString();

        try {
            await createDbNotification({
                id: `notif-escrow-reminder-${order.id}`,
                ...(customerId ? { user_id: customerId } : {}),
                user_email: order.customer_email,
                title: 'Il vous reste 12h pour verifier votre commande',
                message: `Le paiement de votre commande sera envoye automatiquement le ${releaseAt}.`,
                type: 'warning',
                target_role: 'customer',
                read: false,
                date: nowIso
            });

            EmailService.sendMail({
                to: order.customer_email,
                subject: 'Derniere chance - 12h pour signaler un probleme sur votre commande',
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
                        <h2 style="color: #b45309;">Rappel : 12h restantes</h2>
                        <p>Bonjour <b>${customerName}</b>,</p>
                        <p>Le delai de verification de votre commande arrive bientot a terme.</p>
                        <div style="background: #fff7ed; padding: 15px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #f97316;">
                            <p style="margin: 0; color: #c2410c; font-weight: bold;">Liberation automatique prevue le : ${releaseAt}</p>
                        </div>
                        <p>Si vous n'avez pas encore verifie votre produit, faites-le maintenant :</p>
                        <ul>
                            <li>Produit conforme -> aucune action necessaire, le paiement sera envoye automatiquement</li>
                            <li>Probleme -> signalez-le immediatement depuis votre espace client</li>
                        </ul>
                        <div style="background: #fee2e2; padding: 15px; border-radius: 10px; margin: 20px 0; color: #991b1b; font-size: 14px;">
                            <strong>Passe le delai</strong>, il ne sera plus possible de signaler un probleme pour cette commande.
                        </div>
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="${getFrontendBaseUrl()}/pages/customer-dashboard.html" style="background-color: #000; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 10px; font-weight: bold;">Voir ma commande</a>
                        </div>
                    </div>
                `
            }).catch(err => console.error('[NotificationService] verificationReminder email error:', err));
        } catch (error) {
            console.error('[NotificationService] notifyEscrowReminder error:', error);
        }
    }
};

export default NotificationService;
