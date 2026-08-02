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
    },

    /**
     * Template: Dispute Opened Alert
     * Sent to the admin/support when a dispute is opened.
     */
    async sendDisputeOpenedAlert({ adminEmail, orderId, customerName, reason }) {
        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #000; margin: 0;">NewKet</h1>
                    <p style="color: #dc2626; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 2px;">Alerte Litige</p>
                </div>
                <div style="padding: 20px; background-color: #fef2f2; border: 1px dashed #ef4444; border-radius: 15px;">
                    <h2 style="color: #b91c1c; margin-top: 0;">Nouveau Litige Ouvert ⚠️</h2>
                    <p style="color: #333;">L'Acheteur <b>${customerName}</b> vient d'ouvrir un litige sur la plateforme.</p>
                    
                    <div style="background: white; padding: 15px; border-radius: 10px; margin: 15px 0;">
                        <p style="margin: 5px 0; font-size: 13px;"><b>ID Commande :</b> ${orderId}</p>
                        <p style="margin: 5px 0; font-size: 13px;"><b>Catégorie/Motif :</b> ${reason}</p>
                    </div>

                    <p style="color: #333; font-size: 13px;">Veuillez vous connecter au tableau de bord administrateur pour analyser les preuves et trancher.</p>
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${process.env.FRONTEND_URL}/pages/admin/orders.html" style="background-color: #ef4444; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px;">Gérer le Litige</a>
                    </div>
                </div>
            </div>
        `;
        return this.sendMail({ to: adminEmail, subject: `⚠️ URGENT : Nouveau Litige [Cmd: ${orderId.substring(0,8)}]`, html });
    },

    /**
     * Template: New Vendor Pro Verification Request
     * Sent to admin(s) when a vendor submits a RCCM document for certification.
     */
    async sendVerificationRequestAlert({ adminEmail, vendorName, vendorEmail, rccmNumber }) {
        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #000; margin: 0;">NewKet</h1>
                    <p style="color: #7c3aed; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 2px;">Nouvelle Demande Pro</p>
                </div>
                <div style="padding: 20px; background-color: #f5f3ff; border: 1px dashed #7c3aed; border-radius: 15px;">
                    <h2 style="color: #5b21b6; margin-top: 0;">Demande de Badge Vendeur Pro ✅</h2>
                    <p style="color: #333;">Un vendeur vient de soumettre ses documents pour obtenir le badge <b>Boutique Officielle</b>.</p>
                    <div style="background: white; padding: 15px; border-radius: 10px; margin: 15px 0;">
                        <p style="margin: 5px 0; font-size: 13px;"><b>Nom :</b> ${vendorName}</p>
                        <p style="margin: 5px 0; font-size: 13px;"><b>Email :</b> ${vendorEmail}</p>
                        <p style="margin: 5px 0; font-size: 13px;"><b>Numéro RCCM :</b> ${rccmNumber}</p>
                    </div>
                    <p style="color: #333; font-size: 13px;">Connectez-vous au tableau de bord admin pour examiner le document et valider ou refuser la demande.</p>
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${process.env.FRONTEND_URL}/src/pages/admin/user.html" style="background-color: #7c3aed; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px;">Gérer les Certifications</a>
                    </div>
                </div>
                <p style="color: #999; font-size: 11px; text-align: center; margin-top: 20px;">© ${new Date().getFullYear()} NewKet EMarket. Tous droits réservés.</p>
            </div>
        `;
        return this.sendMail({ to: adminEmail, subject: `🔖 Nouvelle demande Vendeur Pro : ${vendorName}`, html });
    },

    /**
     * Template: Vendor Pro Badge Approved
     * Sent to the vendor when their RCCM is validated by admin.
     */
    async sendVendorProApproved({ vendorEmail, vendorName }) {
        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #000; margin: 0;">NewKet</h1>
                    <p style="color: #7c3aed; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 2px;">Boutique Officielle</p>
                </div>
                <div style="padding: 20px; background-color: #f5f3ff; border-radius: 15px;">
                    <h2 style="color: #5b21b6;">Félicitations ${vendorName} ! 🎊</h2>
                    <p style="color: #333; line-height: 1.6;">Votre demande de certification a été <b>approuvée</b> par l'équipe NewKet.</p>
                    <div style="background: linear-gradient(135deg, #7c3aed, #a855f7); padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0;">
                        <p style="color: white; font-size: 28px; margin: 0;">✅</p>
                        <p style="color: white; font-weight: bold; font-size: 18px; margin: 8px 0;">Badge "Boutique Officielle"</p>
                        <p style="color: #e9d5ff; font-size: 13px; margin: 0;">Votre badge est maintenant visible sur votre boutique et vos produits</p>
                    </div>
                    <p style="color: #333; line-height: 1.6;">Les acheteurs peuvent désormais identifier votre boutique comme une entreprise officielle enregistrée. Cela renforce la confiance et peut augmenter vos ventes !</p>
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${process.env.FRONTEND_URL}/src/pages/vendor-dashboard.html" style="background-color: #7c3aed; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px;">Voir ma Boutique</a>
                    </div>
                </div>
                <p style="color: #999; font-size: 11px; text-align: center; margin-top: 20px;">© ${new Date().getFullYear()} NewKet EMarket. Tous droits réservés.</p>
            </div>
        `;
        return this.sendMail({ to: vendorEmail, subject: '✅ Votre badge "Boutique Officielle" est activé !', html });
    },

    /**
     * Template: Vendor Pro Badge Rejected
     * Sent to the vendor when their RCCM is rejected by admin, with reason.
     */
    async sendVendorProRejected({ vendorEmail, vendorName, reason }) {
        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #000; margin: 0;">NewKet</h1>
                    <p style="color: #dc2626; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 2px;">Certification Pro</p>
                </div>
                <div style="padding: 20px; background-color: #fef2f2; border: 1px dashed #ef4444; border-radius: 15px;">
                    <h2 style="color: #b91c1c; margin-top: 0;">Demande non approuvée — ${vendorName}</h2>
                    <p style="color: #333; line-height: 1.6;">Nous avons examiné votre demande de certification <b>Boutique Officielle</b>, mais nous ne pouvons pas l'approuver pour la raison suivante :</p>
                    <div style="background: white; padding: 15px; border-radius: 10px; margin: 15px 0; border-left: 4px solid #ef4444;">
                        <p style="margin: 0; font-size: 14px; color: #333; font-style: italic;">"${reason}"</p>
                    </div>
                    <p style="color: #333; font-size: 13px; line-height: 1.6;">Vous pouvez soumettre une nouvelle demande depuis votre tableau de bord en corrigeant le problème mentionné ci-dessus.</p>
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${process.env.FRONTEND_URL}/src/pages/vendor-dashboard.html" style="background-color: #000; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px;">Soumettre à nouveau</a>
                    </div>
                </div>
                <p style="color: #999; font-size: 11px; text-align: center; margin-top: 20px;">Pour toute question, contactez le support NewKet.</p>
                <p style="color: #999; font-size: 11px; text-align: center;">© ${new Date().getFullYear()} NewKet EMarket. Tous droits réservés.</p>
            </div>
        `;
        return this.sendMail({ to: vendorEmail, subject: '❌ Votre demande de certification Pro n\'a pas été approuvée', html });
    },

    /**
     * Template: Admin OTP Verification
     */
    async sendAdminOTP(adminEmail, otpCode) {
        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #000; margin: 0;">NewKet</h1>
                    <p style="color: #dc2626; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 2px;">Vérification de Sécurité</p>
                </div>
                <div style="padding: 20px; background-color: #fef2f2; border: 1px dashed #ef4444; border-radius: 15px; text-align: center;">
                    <h2 style="color: #b91c1c; margin-top: 0;">Action Critique ⚠️</h2>
                    <p style="color: #333;">Vous avez demandé à effectuer une action critique sur le tableau de bord administrateur (ex: Réinitialisation des transactions).</p>
                    <p style="color: #333;">Voici votre code de vérification, valable 5 minutes :</p>
                    
                    <div style="background: white; padding: 20px; border-radius: 10px; margin: 25px 0;">
                        <h1 style="margin: 0; font-size: 32px; letter-spacing: 5px; color: #000;">${otpCode}</h1>
                    </div>

                    <p style="color: #b91c1c; font-size: 13px; font-weight: bold;">Ne partagez ce code avec personne.</p>
                </div>
            </div>
        `;
        return this.sendMail({ to: adminEmail, subject: `⚠️ Code de vérification administrateur: ${otpCode}`, html });
    }
};

export default EmailService;
