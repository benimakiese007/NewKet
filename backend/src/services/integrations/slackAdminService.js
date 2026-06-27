/**
 * Service Slack Admin - Gestion centralisée des canaux vendeurs
 * Chaque vendeur a son propre canal privé dans le workspace NewKet Vendeurs.
 * L'admin reçoit toutes les notifications dans #admin-toutes-commandes.
 */

class SlackAdminService {
    constructor() {
        this.botToken = process.env.SLACK_BOT_TOKEN;
        this.adminChannelName = process.env.SLACK_ADMIN_CHANNEL_NAME || 'admin-toutes-commandes';
        this.baseUrl = 'https://slack.com/api';
    }

    /**
     * Appel générique à l'API Slack
     */
    async callSlackAPI(method, body = {}) {
        if (!this.botToken) {
            console.warn('[SlackAdmin] ⚠️ SLACK_BOT_TOKEN non configuré.');
            return { ok: false, error: 'no_token' };
        }

        const response = await fetch(`${this.baseUrl}/${method}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Authorization': `Bearer ${this.botToken}`
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        if (!data.ok) {
            console.error(`[SlackAdmin] Erreur API Slack (${method}):`, data.error);
        }
        return data;
    }

    /**
     * Crée un canal privé pour un vendeur s'il n'existe pas déjà.
     * Retourne l'ID du canal créé ou existant.
     * @param {string} vendorName - Nom du vendeur (ex: "Prénom Nom" → #vendeur-prenom-nom)
     * @returns {string|null} Channel ID Slack
     */
    async createVendorChannel(vendorName, vendorEmail) {
        // Normalise le nom : "Prénom Nom" → "vendeur-prenom-nom"
        const channelName = 'vendeur-' + vendorName
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Supprime les accents
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .slice(0, 75); // Slack limite à 80 caractères

        console.log(`[SlackAdmin] Création du canal: #${channelName}`);

        // Crée le canal privé
        const result = await this.callSlackAPI('conversations.create', {
            name: channelName,
            is_private: true
        });

        if (result.ok) {
            console.log(`[SlackAdmin] ✅ Canal #${channelName} créé (ID: ${result.channel.id})`);
            
            // Notifier l'admin qu'il doit inviter le vendeur manuellement
            const adminChannelId = await this.getAdminChannelId();
            if (adminChannelId) {
                const messageText = `🚨 *Action Requise : Nouveau Vendeur*\n\nLe bot vient de créer le canal privé <#${result.channel.id}> pour le vendeur *${vendorName}*.\n\n👉 *Tu dois l'inviter manuellement* dans ce canal via son adresse email : \`${vendorEmail || 'Email inconnu'}\` en tant qu'Invité multicanal.`;
                await this.postMessage(adminChannelId, [
                    { type: 'section', text: { type: 'mrkdwn', text: messageText } }
                ], "Action requise : Inviter un nouveau vendeur");
            }
            
            return result.channel.id;
        }

        // Si le canal existe déjà, on le retrouve
        if (result.error === 'name_taken') {
            console.log(`[SlackAdmin] Canal #${channelName} existe déjà, récupération...`);
            return await this.findChannelByName(channelName);
        }

        return null;
    }

    /**
     * Retrouve un canal privé par son nom
     */
    async findChannelByName(channelName) {
        const result = await this.callSlackAPI('conversations.list', {
            types: 'private_channel',
            limit: 200
        });

        if (!result.ok) return null;

        const channel = result.channels?.find(c => c.name === channelName);
        return channel?.id || null;
    }

    /**
     * Retrouve ou crée le canal admin.
     * Priorité: env SLACK_ADMIN_CHANNEL_ID > recherche > création
     */
    async getAdminChannelId() {
        // 1. Fallback direct si l'ID est configuré en env
        if (process.env.SLACK_ADMIN_CHANNEL_ID) {
            return process.env.SLACK_ADMIN_CHANNEL_ID;
        }
        
        // 2. Chercher dans les canaux rejoints par le bot (ne nécessite pas channels:read/groups:read)
        const joined = await this.findChannelInJoined(this.adminChannelName);
        if (joined) return joined;
        
        // 3. Chercher via conversations.list (nécessite channels:read ou groups:read)
        const found = await this.findChannelByName(this.adminChannelName);
        if (found) return found;
        
        // 4. Tenter de créer
        return await this.createAdminChannel();
    }

    /**
     * Cherche un canal parmi ceux que le bot a déjà rejoints
     * (utilise le scope 'channels:read' OU fonctionne si le bot est membre)
     */
    async findChannelInJoined(channelName) {
        // conversations.list with exclude_archived + types works for channels the bot is in
        const result = await this.callSlackAPI('conversations.list', {
            types: 'public_channel,private_channel',
            exclude_archived: true,
            limit: 200
        });
        
        if (!result.ok) {
            console.warn(`[SlackAdmin] conversations.list failed: ${result.error}`);
            return null;
        }
        
        const channel = result.channels?.find(c => c.name === channelName);
        return channel?.id || null;
    }

    async createAdminChannel() {
        const result = await this.callSlackAPI('conversations.create', {
            name: this.adminChannelName,
            is_private: true
        });
        
        if (result.ok) return result.channel.id;
        
        // Si le canal existe déjà, essayer de le rejoindre par nom via conversations.open
        if (result.error === 'name_taken') {
            console.log(`[SlackAdmin] Canal #${this.adminChannelName} existe déjà mais bot ne peut pas le lister. Configurez SLACK_ADMIN_CHANNEL_ID dans les variables d'environnement.`);
        }
        
        return null;
    }

    /**
     * Envoie un message dans un canal par son ID
     */
    async postMessage(channelId, blocks, fallbackText) {
        if (!channelId) return false;

        const result = await this.callSlackAPI('chat.postMessage', {
            channel: channelId,
            text: fallbackText,
            blocks: blocks
        });

        return result.ok;
    }

    /**
     * Envoie une notification de nouvelle commande :
     * → Au canal privé du vendeur concerné
     * → Au canal admin (#admin-toutes-commandes)
     *
     * @param {string} vendorChannelId - ID Slack du canal du vendeur (stocké en Supabase)
     * @param {object} orderData - Détails de la commande
     * @param {string} vendorName - Nom du vendeur (pour l'affichage admin)
     */
    async sendOrderNotification(vendorChannelId, orderData, vendorName) {
        const vendorBlocks = [
            {
                type: 'header',
                text: { type: 'plain_text', text: '🛒 Nouvelle commande !', emoji: true }
            },
            {
                type: 'section',
                fields: [
                    { type: 'mrkdwn', text: `*Produit :*\n${orderData.productName}` },
                    { type: 'mrkdwn', text: `*Montant :*\n${orderData.totalAmount} FC` },
                    { type: 'mrkdwn', text: `*Client :*\n${orderData.customerName}` },
                    { type: 'mrkdwn', text: `*Date :*\n${new Date().toLocaleString('fr-FR')}` }
                ]
            },
            {
                type: 'actions',
                elements: [{
                    type: 'button',
                    text: { type: 'plain_text', text: '📦 Voir la commande', emoji: true },
                    url: `${process.env.FRONTEND_URL || 'https://newket.vercel.app'}/src/pages/vendor-dashboard.html`,
                    style: 'primary'
                }]
            }
        ];

        const adminBlocks = [
            {
                type: 'header',
                text: { type: 'plain_text', text: '🔔 Nouvelle commande sur NewKet', emoji: true }
            },
            {
                type: 'section',
                fields: [
                    { type: 'mrkdwn', text: `*Vendeur :*\n${vendorName}` },
                    { type: 'mrkdwn', text: `*Produit :*\n${orderData.productName}` },
                    { type: 'mrkdwn', text: `*Montant :*\n${orderData.totalAmount} FC` },
                    { type: 'mrkdwn', text: `*Client :*\n${orderData.customerName}` }
                ]
            }
        ];

        // Envoi en parallèle au vendeur et à l'admin
        const [vendorResult, adminChannelId] = await Promise.all([
            vendorChannelId
                ? this.postMessage(vendorChannelId, vendorBlocks, `🛒 Nouvelle commande : ${orderData.productName}`)
                : Promise.resolve(false),
            this.getAdminChannelId()
        ]);

        const adminResult = adminChannelId
            ? await this.postMessage(adminChannelId, adminBlocks, `🔔 Commande de ${vendorName} : ${orderData.productName}`)
            : false;

        console.log(`[SlackAdmin] Notif vendeur: ${vendorResult ? '✅' : '❌'} | Notif admin: ${adminResult ? '✅' : '❌'}`);
        return { vendorNotified: vendorResult, adminNotified: adminResult };
    }
}

export default new SlackAdminService();
