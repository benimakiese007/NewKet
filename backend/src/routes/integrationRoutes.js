import express from 'express';
import { requireAuth, requireAdmin } from '../middlewares/auth.js';
import oauthService from '../services/integrations/oauthService.js';
import notionService from '../services/integrations/notionService.js';
import slackService from '../services/integrations/slackService.js';
import slackAdminService from '../services/integrations/slackAdminService.js';
import { supabaseAdmin } from '../config/supabase.js';
import { createClient } from '@supabase/supabase-js';

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
        if (provider === 'notion') {
            const tokenData = await oauthService.exchangeNotionCode(code);
            
            const dbId = await notionService.createNotionDatabase(tokenData.access_token);

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
        
        // On récupère tous les utilisateurs et leurs intégrations.
        // On fera un join simple si on avait les clés étrangères, mais on va faire deux requêtes simples pour l'instant.
        const { data: vendors, error: vendorError } = await supabaseAdmin
            .from('users')
            .select('id, email, name, company_name')
            .eq('role', 'supplier');
            
        if (vendorError) throw vendorError;
        
        const { data: integrations, error: intError } = await supabaseAdmin
            .from('vendor_integrations')
            .select('vendor_id, provider, webhook_url');
            
        if (intError) throw intError;
        
        // Agréger les données
        const result = vendors.map(vendor => {
            const vendorInts = integrations.filter(i => i.vendor_id === vendor.id);
            const notionInt = vendorInts.find(i => i.provider === 'notion');
            return {
                id: vendor.id,
                email: vendor.email,
                name: vendor.name || vendor.company_name || 'Inconnu',
                slack: vendorInts.some(i => i.provider.startsWith('slack')),
                notion: !!notionInt,
                notion_db_id: notionInt ? notionInt.webhook_url : null
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

/**
 * Route pour révoquer (déconnecter) une intégration vendeur
 * DELETE /api/integrations/revoke
 * Body: { vendorId, provider, password }
 */
router.delete('/revoke', async (req, res) => {
    try {
        const { vendorId, provider, password } = req.body;

        if (!vendorId || !provider || !password) {
            return res.status(400).json({ error: 'Paramètres manquants (vendorId, provider, password).' });
        }

        // 1. Récupérer l'email du vendeur pour vérifier son mot de passe via Supabase Auth
        const { data: userRecord, error: userError } = await supabaseAdmin
            .from('users')
            .select('email')
            .eq('id', vendorId)
            .single();

        if (userError || !userRecord) {
            return res.status(404).json({ error: 'Vendeur introuvable.' });
        }

        // 2. Vérifier le mot de passe via Supabase Auth signInWithPassword
        const supabaseAuth = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );
        const { error: authError } = await supabaseAuth.auth.signInWithPassword({
            email: userRecord.email,
            password: password
        });

        if (authError) {
            return res.status(401).json({ error: 'Mot de passe incorrect. Déconnexion annulée.' });
        }

        // 3. Supprimer l'intégration
        let query = supabaseAdmin
            .from('vendor_integrations')
            .delete()
            .eq('vendor_id', vendorId);

        if (provider === 'slack') {
            query = query.eq('provider', 'slack');
        } else {
            query = query.eq('provider', provider);
        }

        const { error: deleteError } = await query;

        if (deleteError) throw deleteError;

        console.log(`[Integration] Intégration ${provider} révoquée pour le vendeur ${vendorId}`);
        res.json({ success: true, message: `Intégration ${provider} déconnectée avec succès.` });

    } catch (error) {
        console.error('[Integration] Erreur lors de la révocation:', error);
        res.status(500).json({ error: error.message });
    }
});


/**
 * Route admin : Ajouter une nouvelle colonne (propriété) à la base de données Notion
 * de TOUS les vendeurs connectés.
 *
 * POST /api/integrations/admin/notion/add-column
 * Body: {
 *   name: string,          // Nom de la colonne (ex: "Garantie")
 *   type: string,          // Type: "rich_text" | "number" | "select" | "multi_select" | "checkbox" | "url" | "date"
 *   options?: [            // Requis si type === "select" ou "multi_select"
 *     { name: string, color?: string }
 *   ],
 *   format?: string        // Requis si type === "number" (ex: "number", "dollar", "euro", "franc")
 * }
 */
router.post('/admin/notion/add-column', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { name, type, options, format } = req.body;

        // --- Validation ---
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ error: 'Le champ "name" (nom de la colonne) est obligatoire.' });
        }

        const validTypes = ['rich_text', 'number', 'select', 'multi_select', 'checkbox', 'url', 'date'];
        if (!type || !validTypes.includes(type)) {
            return res.status(400).json({
                error: `Le champ "type" est invalide. Types acceptés : ${validTypes.join(', ')}.`
            });
        }

        // Pour les types select/multi_select, les options sont obligatoires
        if ((type === 'select' || type === 'multi_select') && (!Array.isArray(options) || options.length === 0)) {
            return res.status(400).json({
                error: 'Les "options" (tableau avec au moins un item) sont obligatoires pour les types select et multi_select.'
            });
        }

        const columnConfig = { name: name.trim(), type, options, format };

        console.log(`[Integration Admin] Déploiement colonne "${name}" (type: ${type}) par admin ${req.user?.id}`);
        const report = await notionService.addColumnToAllDatabases(columnConfig);

        res.json({
            success: true,
            report
        });

    } catch (error) {
        console.error('[Integration Admin] Erreur add-column:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;

