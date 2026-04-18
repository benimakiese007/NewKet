import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

/**
 * NewKet Email Service
 * Centralizes all email templates and sending logic.
 */
const EmailService = {
    /**
     * Common method to send an email with custom HTML
     */
    async sendMail({ to, subject, html }) {
        try {
            const info = await transporter.sendMail({
                from: `"NewKet EMarket" <${process.env.GMAIL_USER}>`,
                to,
                subject,
                html
            });
            console.log(`[EmailService] Email sent to ${to}: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error(`[EmailService] Error sending email to ${to}:`, error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Template: Vendor profile has been approved
     */
    async sendVendorApproval(vendorEmail, vendorName) {
        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #000; margin: 0;">NewKet</h1>
                    <p style="color: #666; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 2px;">Marketplace</p>
                </div>
                <div style="padding: 20px; background-color: #f9f9f9; border-radius: 15px;">
                    <h2 style="color: #10b981;">Félicitations ${vendorName} ! 🎉</h2>
                    <p style="color: #333; line-height: 1.6;">Votre profil vendeur a été <b>approuvé</b> par l'administration de NewKet.</p>
                    <p style="color: #333; line-height: 1.6;">Vous pouvez désormais publier vos produits et commencer à recevoir des leads via WhatsApp dès maintenant.</p>
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${process.env.FRONTEND_URL}/pages/vendor-dashboard.html" style="background-color: #000; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px;">Accéder à mon tableau de bord</a>
                    </div>
                </div>
                <p style="color: #999; font-size: 11px; text-align: center; margin-top: 20px;">© ${new Date().getFullYear()} NewKet EMarket. Tous droits réservés.</p>
            </div>
        `;
        return this.sendMail({ to: vendorEmail, subject: '🎉 Votre compte vendeur NewKet est prêt !', html });
    },

    /**
     * Template: New lead (customer clicked WhatsApp button)
     * Sent to the vendor to alert them of a potential customer.
     */
    async sendLeadNotification({ vendorEmail, vendorName, productName, customerName, customerPhone }) {
        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #000; margin: 0;">NewKet</h1>
                    <p style="color: #666; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 2px;">Nouveau Prospect</p>
                </div>
                <div style="padding: 20px; background-color: #f0fdf4; border: 1px dashed #22c55e; border-radius: 15px;">
                    <h2 style="color: #166534; margin-top: 0;">Nouveau clic de vente ! 🚀</h2>
                    <p style="color: #333;">Bonjour <b>${vendorName}</b>,</p>
                    <p style="color: #333;">Un client vient de cliquer sur votre produit <b>"${productName}"</b> pour vous contacter sur WhatsApp.</p>
                    
                    <div style="background: white; padding: 15px; border-radius: 10px; margin: 15px 0;">
                        <p style="margin: 5px 0; font-size: 13px;"><b>Nom du client :</b> ${customerName || 'Visiteur'}</p>
                        <p style="margin: 5px 0; font-size: 13px;"><b>Numéro de contact :</b> ${customerPhone || 'Visible sur WhatsApp'}</p>
                    </div>

                    <p style="color: #333; font-size: 13px;">Soyez prêt à répondre sur votre application WhatsApp !</p>
                </div>
                <p style="color: #999; font-size: 11px; text-align: center; margin-top: 20px;">Si vous ne recevez plus de messages sur WhatsApp, vérifiez votre numéro dans vos paramètres.</p>
            </div>
        `;
        return this.sendMail({ to: vendorEmail, subject: '🚀 Nouveau prospect WhatsApp pour : ' + productName, html });
    },

    /**
     * Template: Newsletter
     * Sent from the admin to multiple users
     */
    async sendNewsletter({ emails, subject, content }) {
        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #000; margin: 0;">NewKet</h1>
                    <p style="color: #666; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 2px;">News & Updates</p>
                </div>
                <div style="padding: 20px; background-color: #f9f9f9; border-radius: 15px;">
                    <p style="color: #333; line-height: 1.6;">${content.replace(/\n/g, '<br>')}</p>
                </div>
                <p style="color: #999; font-size: 11px; text-align: center; margin-top: 20px;">© ${new Date().getFullYear()} NewKet EMarket. Tous droits réservés.</p>
                <p style="color: #bbb; font-size: 10px; text-align: center;">Vous recevez cet email car vous êtes inscrit sur NewKet.</p>
            </div>
        `;
        // Promise.all to send individually, or BCC. Using individual sending here for better deliverability
        const promises = emails.map(email => this.sendMail({ to: email, subject, html }));
        const results = await Promise.allSettled(promises);
        
        const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        console.log(`[EmailService] Newsletter sent to ${successCount}/${emails.length} recipients.`);
        return { success: true, totalSent: successCount };
    }
};

export default EmailService;
