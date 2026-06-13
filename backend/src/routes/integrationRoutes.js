import express from 'express';

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
    // Import dynamique pour éviter les soucis si le fichier est appelé bizarrement
    const { default: slackService } = await import('../services/integrations/slackService.js');
    
    const sellerId = req.query.sellerId || 'test-seller';
    await slackService.sendSaleNotification(sellerId, {
        totalAmount: 4500,
        productName: 'Sac Hermès Birkin Vintage',
        customerName: 'Jean Dupont'
    });
    
    res.json({ message: 'Test de notification Slack déclenché (regardez les logs du serveur).' });
});

export default router;
