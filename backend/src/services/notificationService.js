import { supabaseAdmin } from '../config/supabase.js';
import EmailService from './emailService.js';

/**
 * NotificationService
 * Handles sending notifications to vendors and customers after successful operations.
 */
const NotificationService = {
    /**
     * Notifies vendors about a successful order/payment.
     * @param {string} orderId - The ID of the order
     */
    async notifyOrderSuccess(orderId) {
        try {
            console.log(`[NotificationService] Sending notifications for order ${orderId}`);

            // 1. Fetch order details
            const { data: order, error: orderError } = await supabaseAdmin
                .from('orders')
                .select('*')
                .eq('id', orderId)
                .single();

            if (orderError || !order) {
                console.error('[NotificationService] Order not found:', orderError);
                return;
            }

            const items = order.items || [];
            if (!Array.isArray(items)) {
                console.warn('[NotificationService] No items found in order');
                return;
            }

            // 2. Identify vendors to notify
            // We group items by vendor to avoid duplicate notifications if one vendor has multiple items
            const vendorsToNotify = new Set();
            for (const item of items) {
                if (item.vendor_id) {
                    vendorsToNotify.add(item.vendor_id);
                }
            }

            for (const vendorId of vendorsToNotify) {
                // Fetch vendor details (email, name)
                const { data: vendor, error: vendorError } = await supabaseAdmin
                    .from('users')
                    .select('email, name, role')
                    .eq('id', vendorId)
                    .single();

                if (vendorError || !vendor) {
                    console.error(`[NotificationService] Vendor ${vendorId} not found:`, vendorError);
                    continue;
                }

                const vendorEmail = vendor.email;
                const vendorName = vendor.name || 'Vendeur';

                // 3. Create DB Notification
                const { error: notifError } = await supabaseAdmin
                    .from('notifications')
                    .insert({
                        id: `notif-order-${orderId}-${vendorId}`,
                        user_email: vendorEmail,
                        title: 'Nouvelle commande payée ! 💰',
                        message: `Félicitations ! Un paiement a été reçu pour la commande #${order.transaction_id}. Le stock a été mis à jour automatiquement.`,
                        type: 'success',
                        target_role: 'supplier',
                        read: false,
                        date: new Date().toISOString()
                    });

                if (notifError) {
                    console.error('[NotificationService] Error creating DB notification:', notifError);
                }

                // 4. Send Email Notification (Optional/Async)
                // We use a simplified version of lead notification or create a new one
                // For now, let's use sendMail directly with a custom message or add a template to EmailService
                EmailService.sendMail({
                    to: vendorEmail,
                    subject: '💰 Nouveau paiement reçu sur NewKet !',
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
                            <h2 style="color: #10b981;">Paiement Confirmé !</h2>
                            <p>Bonjour <b>${vendorName}</b>,</p>
                            <p>Une nouvelle commande a été payée avec succès sur votre boutique NewKet.</p>
                            <div style="background: #f9f9f9; padding: 15px; border-radius: 10px; margin: 20px 0;">
                                <p><b>ID Transaction:</b> ${order.transaction_id}</p>
                                <p><b>Montant:</b> ${order.total_amount} ${process.env.CURRENCY || 'XOF'}</p>
                                <p><b>Client:</b> ${order.customer_name || 'Client NewKet'}</p>
                            </div>
                            <p>Le stock de vos produits a été décrémenté automatiquement.</p>
                            <div style="text-align: center; margin-top: 30px;">
                                <a href="${process.env.FRONTEND_URL}/pages/vendor-dashboard.html" style="background-color: #000; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 10px; font-weight: bold;">Voir mes commandes</a>
                            </div>
                        </div>
                    `
                }).catch(err => console.error('[NotificationService] Email error:', err));
            }

        } catch (error) {
            console.error('[NotificationService] Global error:', error);
        }
    },

    /**
     * Notifie le client avec son code OTP de livraison.
     * @param {Object} order - Objet contenant id, otp_code, customer_email, customer_name, transaction_id
     */
    async notifyCustomerOTP(order) {
        if (!order || !order.customer_email || !order.otp_code) return;

        try {
            console.log(`[NotificationService] Sending OTP to customer ${order.customer_email} for order ${order.transaction_id}`);
            
            const customerName = order.customer_name || 'Client';

            EmailService.sendMail({
                to: order.customer_email,
                subject: '🔐 Votre Code Secret de Livraison - NewKet',
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
                        <h2 style="color: #000;">Votre commande est en route !</h2>
                        <p>Bonjour <b>${customerName}</b>,</p>
                        <p>Le paiement de votre commande <b>#${order.transaction_id}</b> a été sécurisé sur notre compte séquestre (Escrow).</p>
                        <p>Le vendeur a été notifié et prépare votre livraison.</p>
                        
                        <div style="background: #fff8eb; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center; border: 2px dashed #f59e0b;">
                            <p style="margin: 0; color: #b45309; font-size: 14px;">CODE DE LIVRAISON SÉCURISÉ (OTP)</p>
                            <h1 style="font-size: 36px; margin: 10px 0; letter-spacing: 5px; color: #000;">${order.otp_code}</h1>
                        </div>

                        <div style="background: #fee2e2; padding: 15px; border-radius: 10px; margin: 20px 0; color: #991b1b; font-size: 14px;">
                            <strong>⚠️ ATTENTION TRÈS IMPORTANT :</strong>
                            <ul style="margin-top: 5px; padding-left: 20px;">
                                <li>Ne donnez ce code au livreur <b>QU'APRÈS avoir reçu et vérifié</b> votre produit.</li>
                                <li>Donner ce code libère l'argent au vendeur.</li>
                                <li>Si le produit n'est pas conforme, <b>ne donnez pas le code</b> et ouvrez un litige sur la plateforme.</li>
                            </ul>
                        </div>

                        <div style="text-align: center; margin-top: 30px;">
                            <a href="${process.env.FRONTEND_URL}/pages/customer-dashboard.html" style="background-color: #000; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 10px; font-weight: bold;">Suivre ma commande</a>
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
