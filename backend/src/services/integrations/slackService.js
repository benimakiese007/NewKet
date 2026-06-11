import { supabaseAdmin } from '../../config/supabase.js';

class SlackService {
    /**
     * Envoie une notification générale (Fallback)
     */
    async sendGlobalNotification(message) {
        const webhookUrl = process.env.MOCK_SLACK_WEBHOOK_URL;
        if (!webhookUrl) return false;
        
        try {
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: message })
            });
            return true;
        } catch (error) {
            console.error('Erreur Slack Global:', error);
            return false;
        }
    }

    /**
     * Envoie une notification au webhook spécifique du vendeur
     */
    async sendToVendor(vendorId, messageBlocks, fallbackText) {
        const { data: integration } = await supabaseAdmin
            .from('vendor_integrations')
            .select('webhook_url')
            .eq('vendor_id', vendorId)
            .eq('provider', 'slack')
            .maybeSingle();

        const webhookUrl = integration?.webhook_url || process.env.MOCK_SLACK_WEBHOOK_URL;

        if (!webhookUrl) {
            console.log(`[SlackService] Pas de webhook trouvé pour le vendeur ${vendorId}.`);
            return false;
        }

        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: fallbackText, blocks: messageBlocks })
            });
            
            if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
            return true;
        } catch (error) {
            console.error('[SlackService] Erreur lors de l\'envoi au vendeur:', error);
            return false;
        }
    }

    /**
     * Notification générique de vente
     */
    async sendSaleNotification(sellerId, orderDetails) {
        const blocks = [
            { type: "header", text: { type: "plain_text", text: "🎉 Nouvelle Vente !", emoji: true } },
            { type: "section", text: { type: "mrkdwn", text: `*Montant :* ${orderDetails.totalAmount} FC\n*Produit :* ${orderDetails.productName}\n*Client :* ${orderDetails.customerName}` } }
        ];
        await this.sendToVendor(sellerId, blocks, "🎉 Nouvelle Vente !");
    }

    /**
     * Notification demande de devis
     */
    async sendQuoteRequestNotification(sellerId, orderDetails) {
        const blocks = [
            { type: "header", text: { type: "plain_text", text: "📝 Nouvelle demande de devis !", emoji: true } },
            { type: "section", text: { type: "mrkdwn", text: `*Produit :* ${orderDetails.productName}\n*Client :* ${orderDetails.customerName}\n\n*Action requise :* Veuillez vous connecter pour proposer un tarif de livraison.` } }
        ];
        await this.sendToVendor(sellerId, blocks, "📝 Nouvelle demande de devis !");
    }

    /**
     * Notification paiement reçu
     */
    async sendPaymentReceivedNotification(sellerId, orderDetails) {
        const blocks = [
            { type: "header", text: { type: "plain_text", text: "💰 Devis accepté et Payé !", emoji: true } },
            { type: "section", text: { type: "mrkdwn", text: `*Montant total :* ${orderDetails.totalAmount} FC\n*Produit :* ${orderDetails.productName}\n*Client :* ${orderDetails.customerName}\n\n*Action requise :* Vous pouvez procéder à la livraison.` } }
        ];
        await this.sendToVendor(sellerId, blocks, "💰 Devis accepté et Payé !");
    }
}

export default new SlackService();
