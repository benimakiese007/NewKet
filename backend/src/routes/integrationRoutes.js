import express from 'express';
import { requireAuth, requireAdmin } from '../middlewares/auth.js';

const router = express.Router();

/**
 * Route d'autorisation Notion (Redirige le vendeur vers Notion)
 */
router.get('/auth/notion', (req, res) => {
    const clientId = process.env.NOTION_CLIENT_ID || 'mock_client_id';
    const redirectUri = encodeURIComponent(process.env.OAUTH_REDIRECT_URI || 'http://localhost:5173/api/integrations/callback');
    const vendorId = req.user?.id || req.query.vendorId || 'fake-vendor-id';
    // On encode vendorId ET provider dans le state pour un callback 100% fiable
    const state = Buffer.from(JSON.stringify({ vendorId, provider: 'notion' })).toString('base64');
    
    const notionAuthUrl = `https://api.notion.com/v1/oauth/authorize?owner=user&client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&state=${state}`;
    res.redirect(notionAuthUrl);
});

/**
 * Route d'autorisation Slack (Redirige le vendeur vers Slack)
 */
router.get('/auth/slack', (req, res) => {
    const clientId = process.env.SLACK_CLIENT_ID || 'mock_client_id';
    const redirectUri = encodeURIComponent(process.env.OAUTH_REDIRECT_URI || 'http://localhost:5173/api/integrations/callback');
    const vendorId = req.user?.id || req.query.vendorId || 'fake-vendor-id';
    // On encode vendorId ET provider dans le state pour un callback 100% fiable
    const state = Buffer.from(JSON.stringify({ vendorId, provider: 'slack' })).toString('base64');
    
    const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=incoming-webhook&redirect_uri=${redirectUri}&state=${state}`;
    res.redirect(slackAuthUrl);
});

/**
 * Route de Callback Unifiée (Notion & Slack)
 */
router.get('/callback', async (req, res) => {
    let { code, state } = req.query;
    let vendorId = 'fake-vendor-id';
    let provider = 'notion'; // défaut

    // Décodage du state (base64 JSON : { vendorId, provider })
    try {
        const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
        vendorId = decoded.vendorId || vendorId;
        provider = decoded.provider || provider;
    } catch (e) {
        // state ancien format (juste vendorId en string)
        vendorId = state || vendorId;
        // Détection fallback
        if (req.headers.referer?.includes('slack')) provider = 'slack';
    }
    
    console.log(`[Integration] Callback reçu pour ${provider}, vendeur: ${vendorId}`);

    try {
        const { default: oauthService } = await import('../services/integrations/oauthService.js');
        const { supabaseAdmin } = await import('../config/supabase.js');

        if (provider === 'notion') {
            const tokenData = await oauthService.exchangeNotionCode(code);
            const { default: notionService } = await import('../services/integrations/notionService.js');
            
            const dbId = await notionService.createNotionDatabase(tokenData.access_token).catch(e => {
                console.error("Erreur création DB Notion:", e.message);
                return "mock_db_id";
            });

            await supabaseAdmin.from('vendor_integrations').upsert({
                vendor_id: vendorId,
                provider: 'notion',
                access_token: tokenData.access_token,
                webhook_url: dbId 
            }, { onConflict: 'vendor_id, provider' });
            
        } else if (provider === 'slack') {
            const tokenData = await oauthService.exchangeSlackCode(code);
            
            await supabaseAdmin.from('vendor_integrations').upsert({
                vendor_id: vendorId,
                provider: 'slack',
                access_token: tokenData.access_token,
                webhook_url: tokenData.incoming_webhook?.url 
            }, { onConflict: 'vendor_id, provider' });
        }
        
        res.redirect('/src/pages/vendor-dashboard.html?integration=success#settings');
    } catch (error) {
        console.error(`[Integration] Erreur lors du callback ${provider}:`, error);
        res.redirect(`/src/pages/vendor-dashboard.html?integration=error&msg=${encodeURIComponent(error.message)}#settings`);
    }
});

/**
 * Route pour déclencher manuellement la synchronisation Notion -> Supabase
 */
router.post('/notion/sync', async (req, res) => {
    try {
        const vendorId = req.body.vendorId || req.user?.id;
        if (!vendorId) {
            return res.status(401).json({ error: 'Non autorisé.' });
        }
        
        const { default: notionService } = await import('../services/integrations/notionService.js');
        
        const result = await notionService.syncProductsFromNotion(vendorId);
        res.json(result);
    } catch (error) {
        console.error('[Integration] Erreur sync Notion:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Route temporaire pour tester l'envoi d'une notification Slack
 * GET /api/integrations/test-slack?sellerId=123
 */
router.get('/test-slack', async (req, res) => {
    try {
        const { default: slackService } = await import('../services/integrations/slackService.js');
        const { default: slackAdminService } = await import('../services/integrations/slackAdminService.js');
        
        const sellerId = req.query.sellerId;
        
        if (sellerId) {
            const success = await slackService.sendSaleNotification(sellerId, {
                totalAmount: 4500,
                productName: 'Sac Hermès Birkin Vintage (Test)',
                customerName: 'Jean Dupont'
            });
            return res.json({ message: 'Test de notification Slack vendeur déclenché.', success });
        } else {
            const adminChannelId = await slackAdminService.getAdminChannelId();
            if (!adminChannelId) {
                throw new Error("Impossible de trouver ou de créer le canal admin.");
            }
            
            const adminBlocks = [
                {
                    type: 'header',
                    text: { type: 'plain_text', text: '🔔 Test d\'intégration Slack Admin', emoji: true }
                },
                {
                    type: 'section',
                    text: { type: 'mrkdwn', text: 'Ceci est un message de test envoyé depuis le tableau de bord admin de NewKet.' }
                }
            ];
            
            const success = await slackAdminService.postMessage(adminChannelId, adminBlocks, '🔔 Test d\'intégration Slack Admin');
            if (!success) {
                throw new Error("L'envoi du message de test a échoué.");
            }
            
            return res.json({ message: 'Notification Slack Admin envoyée avec succès !', success });
        }
    } catch (error) {
        console.error('[Integration] Test Slack Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Route admin: liste de toutes les intégrations des vendeurs
 */
router.get('/admin', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { supabaseAdmin } = await import('../config/supabase.js');
        
        // On récupère tous les utilisateurs et leurs intégrations.
        // On fera un join simple si on avait les clés étrangères, mais on va faire deux requêtes simples pour l'instant.
        const { data: vendors, error: vendorError } = await supabaseAdmin
            .from('users')
            .select('id, email, name, company_name')
            .eq('role', 'supplier');
            
        if (vendorError) throw vendorError;
        
        const { data: integrations, error: intError } = await supabaseAdmin
            .from('vendor_integrations')
            .select('vendor_id, provider');
            
        if (intError) throw intError;
        
        // Agréger les données
        const result = vendors.map(vendor => {
            const vendorInts = integrations.filter(i => i.vendor_id === vendor.id);
            return {
                id: vendor.id,
                email: vendor.email,
                name: vendor.name || vendor.company_name || 'Inconnu',
                slack: vendorInts.some(i => i.provider.startsWith('slack')),
                notion: vendorInts.some(i => i.provider === 'notion')
            };
        });
        
        res.json(result);
    } catch (error) {
        console.error('[Integration Admin] Erreur lors de la récupération des intégrations:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Route admin: Export CSV des intégrations
 */
router.get('/admin/csv', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { supabaseAdmin } = await import('../config/supabase.js');
        
        const { data: vendors, error: vendorError } = await supabaseAdmin
            .from('users')
            .select('id, email, name, company_name')
            .eq('role', 'supplier');
            
        if (vendorError) throw vendorError;
        
        const { data: integrations, error: intError } = await supabaseAdmin
            .from('vendor_integrations')
            .select('vendor_id, provider');
            
        if (intError) throw intError;
        
        let csvContent = 'ID Vendeur,Nom,Email,Slack Connecté,Notion Connecté\n';
        
        for (const vendor of vendors) {
            const vendorInts = integrations.filter(i => i.vendor_id === vendor.id);
            const name = vendor.name || vendor.company_name || 'Inconnu';
            const slack = vendorInts.some(i => i.provider.startsWith('slack')) ? 'Oui' : 'Non';
            const notion = vendorInts.some(i => i.provider === 'notion') ? 'Oui' : 'Non';
            
            csvContent += `"${vendor.id}","${name}","${vendor.email}","${slack}","${notion}"\n`;
        }
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="vendor_integrations.csv"');
        res.send(csvContent);
    } catch (error) {
        console.error('[Integration Admin] Erreur lors de l\'export CSV:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
