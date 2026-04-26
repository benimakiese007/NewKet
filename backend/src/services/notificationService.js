import { supabaseAdmin } from '../config/supabase.js';
import EmailService from './emailService.js';

function getFrontendBaseUrl() {
    return (process.env.FRONTEND_URL || 'https://newket.vercel.app').replace(/\/+$/, '');
}

async function createDbNotification(payload) {
    const { error } = await supabaseAdmin
        .from('notifications')
        .insert(payload);

    if (error) {
        console.error('[NotificationService] Error creating DB notification:', error);
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
            await createDbNotification({
                id: `notif-order-quote-${order.id}-${quote.id}`,
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
                    user_email: vendor.email,
                    title: 'Nouvelle commande payee',
                    message: `Un paiement a ete recu pour la commande #${order.transaction_id}.`,
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
                                <p><b>ID Transaction:</b> ${order.transaction_id}</p>
                                <p><b>Montant:</b> ${order.total_amount} ${process.env.CURRENCY || 'CDF'}</p>
                                <p><b>Client:</b> ${order.customer_name || 'Client NewKet'}</p>
                            </div>
                            <p>Les fonds sont maintenant sequestres. Vous pouvez organiser la livraison.</p>
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
            console.log(`[NotificationService] Sending OTP to customer ${order.customer_email} for order ${order.transaction_id}`);

            const customerName = order.customer_name || 'Client';

            EmailService.sendMail({
                to: order.customer_email,
                subject: 'Votre code secret de livraison - NewKet',
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
                        <h2 style="color: #000;">Votre commande est en route</h2>
                        <p>Bonjour <b>${customerName}</b>,</p>
                        <p>Le paiement de votre commande <b>#${order.transaction_id}</b> est securise sur notre compte sequestre.</p>
                        <p>Le vendeur a ete notifie et peut demarrer la livraison.</p>
                        <div style="background: #fff8eb; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center; border: 2px dashed #f59e0b;">
                            <p style="margin: 0; color: #b45309; font-size: 14px;">CODE DE LIVRAISON SECURISE (OTP)</p>
                            <h1 style="font-size: 36px; margin: 10px 0; letter-spacing: 5px; color: #000;">${order.otp_code}</h1>
                        </div>
                        <div style="background: #fee2e2; padding: 15px; border-radius: 10px; margin: 20px 0; color: #991b1b; font-size: 14px;">
                            <strong>ATTENTION :</strong>
                            <ul style="margin-top: 5px; padding-left: 20px;">
                                <li>Ne donnez ce code qu'apres reception et verification du produit.</li>
                                <li>Si le produit n'est pas conforme, n'entrez pas ce code et ouvrez un litige.</li>
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
    }
};

export default NotificationService;
