import { Client } from '@notionhq/client';
import { supabaseAdmin } from '../../config/supabase.js';

class NotionService {
    /**
     * Crée la base de données "Catalogue" dans le Notion du vendeur.
     * Si une base "📦 Catalogue NewKet" existe déjà, retourne son ID sans en créer une nouvelle.
     */
    async createNotionDatabase(accessToken) {
        const notion = new Client({ auth: accessToken });

        // 1. Chercher une BDD "📦 Catalogue NewKet" déjà existante pour éviter les doublons
        const existingSearch = await notion.search({
            query: '📦 Catalogue NewKet',
            page_size: 10
        });

        const existingDb = existingSearch.results.find(r => r.object === 'database');
        if (existingDb) {
            console.log('[Notion] Base de données existante trouvée, réutilisation.');
            return existingDb.id;
        }

        // 2. Trouver la page parente partagée avec l'intégration
        const searchRes = await notion.search({
            filter: { property: 'object', value: 'page' },
            page_size: 10
        });

        // Filtrer uniquement les pages normales (exclure profils utilisateur, pages système)
        const pages = searchRes.results.filter(p => {
            const parentType = p.parent?.type;
            const hasTitle = p.properties?.title || p.properties?.Name;
            return hasTitle && (parentType === 'workspace' || parentType === 'page_id');
        });
        const parentPage = pages[0];

        if (!parentPage) {
            throw new Error("Aucune page valide trouvée dans votre Notion. Veuillez partager une page lors de l'autorisation.");
        }

        const parentPageId = parentPage.id;
        console.log(`[Notion] Création de la BDD sur la page: ${parentPageId}`);

        // 3. Créer la BDD avec fetch direct (le SDK v5 ignore le paramètre "properties")
        const createRes = await fetch('https://api.notion.com/v1/databases', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                parent: { type: 'page_id', page_id: parentPageId },
                icon: { type: 'emoji', emoji: '📦' },
                title: [{ type: 'text', text: { content: '📦 Catalogue NewKet' } }],
                properties: {
                    'Nom du produit': { title: {} },
                    'Prix (FC)': { number: { format: 'number' } },
                    'Ancien Prix (FC)': { number: { format: 'number' } },
                    'Description': { rich_text: {} },
                    'Catégorie': {
                        select: {
                            options: [
                                { name: 'Électronique', color: 'blue' },
                                { name: 'Mode', color: 'pink' },
                                { name: 'Maison', color: 'green' },
                                { name: 'Cosmétique', color: 'red' },
                                { name: 'Alimentaire', color: 'yellow' },
                                { name: 'Sport', color: 'orange' },
                                { name: 'Général', color: 'default' }
                            ]
                        }
                    },
                    'Stock': { number: { format: 'number' } },
                    'État': {
                        select: {
                            options: [
                                { name: 'Neuf', color: 'green' },
                                { name: 'Occasion', color: 'orange' }
                            ]
                        }
                    },
                    'Taux (FC/$)': { number: { format: 'number' } },
                    'Image 1': { url: {} },
                    'Image 2': { url: {} },
                    'Image 3': { url: {} },
                    'Image 4': { url: {} },
                    'Image 5': { url: {} },
                    'Publié': { checkbox: {} }
                }
            })
        });

        if (!createRes.ok) {
            const errBody = await createRes.json();
            throw new Error(`Notion API error: ${errBody.message}`);
        }

        const dbResponse = await createRes.json();

        console.log(`[Notion] Base de données créée avec l'ID: ${dbResponse.id}`);
        return dbResponse.id;
    }

    /**
     * Synchronise les produits de la BDD Notion vers Supabase (products)
     */
    async syncProductsFromNotion(vendorId) {
        // 1. Récupérer le token et l'ID de la base depuis Supabase
        const { data: integration, error: intError } = await supabaseAdmin
            .from('vendor_integrations')
            .select('*')
            .eq('vendor_id', vendorId)
            .eq('provider', 'notion')
            .maybeSingle();

        if (intError) throw intError;

        if (!integration || !integration.access_token || !integration.webhook_url) {
            throw new Error("Notion n'est pas connecté ou la base de données est introuvable.");
        }

        const notion = new Client({ auth: integration.access_token });
        const dbId = integration.webhook_url; // L'ID de la Database est stocké ici

        // 2. Récupérer tous les produits cochés "Publié" depuis Notion
        // 2. Récupérer tous les produits cochés "Publié" depuis Notion
        // On utilise fetch direct car la version SDK (v5) n'expose pas notion.databases.query
        let allResults = [];
        let hasMore = true;
        let nextCursor = undefined;

        while (hasMore) {
            const queryRes = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${integration.access_token}`,
                    'Content-Type': 'application/json',
                    'Notion-Version': '2022-06-28'
                },
                body: JSON.stringify({
                    filter: {
                        property: 'Publié',
                        checkbox: { equals: true }
                    },
                    page_size: 100,
                    start_cursor: nextCursor
                })
            });

            if (!queryRes.ok) {
                const errBody = await queryRes.json();
                throw new Error(`Erreur Notion Query: ${errBody.message || queryRes.statusText}`);
            }

            const response = await queryRes.json();
            if (response.results && response.results.length > 0) {
                allResults = allResults.concat(response.results);
            }
            
            hasMore = response.has_more;
            nextCursor = response.next_cursor;
        }

        if (allResults.length === 0) {
            return { success: true, count: 0, message: 'Aucun produit "Publié" trouvé dans Notion. Cochez la case "Publié" sur vos produits.' };
        }

        let syncCount = 0;
        const errors = [];

        // 3. Upsert vers Supabase

        try {
            // Récupérer le supplier_email du vendeur une seule fois
            const { data: vendorData } = await supabaseAdmin
                .from('users')
                .select('email')
                .eq('id', vendorId)
                .single();
            const vendorEmail = vendorData?.email || null;

            // Récupérer les produits existants pour ce vendeur pour éviter les doublons de nom
            const { data: existingProducts } = await supabaseAdmin
                .from('products')
                .select('id, name')
                .eq('user_id', vendorId);

            const existingProductsMap = new Map();
            if (existingProducts) {
                for (const p of existingProducts) {
                    existingProductsMap.set(p.name, p.id);
                }
            }

            const upsertBatch = [];

            for (const page of allResults) {
                try {
                    const props = page.properties;

                    // Compatibilité : ancien nom "Nom" ET nouveau nom "Nom du produit"
                    const nameRaw = props['Nom du produit'] || props['Nom'];
                    const name = nameRaw?.title?.[0]?.plain_text?.trim();

                    if (!name) continue; // Produit sans nom ignoré

                    const price = props['Prix (FC)']?.number ?? 0;
                    const oldPrice = props['Ancien Prix (FC)']?.number ?? null;
                    const description = props['Description']?.rich_text?.map(rt => rt.plain_text).join('') ?? '';
                    let category = props['Catégorie']?.select?.name ?? 'Général';
                    
                    // Mapper la catégorie de Notion vers les catégories exactes du frontend
                    const catLower = category.toLowerCase();
                    if (catLower.includes('tech')) category = 'Tech & Gadgets';
                    if (catLower === 'femme' || catLower === 'homme' || catLower === 'art de vivre' || catLower === 'autres') {
                        // C'est bon, on laisse tel quel (en s'assurant de la majuscule)
                        category = category.charAt(0).toUpperCase() + category.slice(1);
                    }

                    const stock = props['Stock']?.number ?? 1;

                    // État du produit → is_new
                    const etatValue = (props['État']?.select?.name || 'Neuf').toLowerCase();
                    const isNew = !etatValue.includes('occasion');

                    // Taux de change personnalisé
                    const customExchangeRate = props['Taux (FC/$)']?.number ?? null;

                    // Collecter jusqu'à 5 images
                    const imageUrls = [
                        props['Image 1']?.url,
                        props['Image 2']?.url,
                        props['Image 3']?.url,
                        props['Image 4']?.url,
                        props['Image 5']?.url,
                        // Compatibilité avec l'ancienne colonne "URL Image"
                        props['URL Image']?.url
                    ].filter(url => url && url.trim() !== '');

                    // Image principale = la première (avec fallback auto si aucune)
                    const image = imageUrls[0] || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=400&background=1a1a2e&color=ffffff`;
                    // Tableau complet pour galerie (max 5)
                    const images = imageUrls.length > 0 ? imageUrls.slice(0, 5) : [image];

                    const productData = {
                        name,
                        price,
                        old_price: oldPrice,
                        description,
                        category,
                        stock,
                        image,                    // Image principale (1ère URL)
                        images,                   // Tableau de toutes les URLs (galerie)
                        user_id: vendorId,
                        supplier_email: vendorEmail,
                        is_new: isNew,            // État: Neuf ou Occasion
                        custom_exchange_rate: customExchangeRate,  // Taux FC/$
                        is_promo: oldPrice !== null && oldPrice > price,
                        created_at: page.created_time // Preserve Notion creation time
                    };

                    const existingId = existingProductsMap.get(name);
                    if (existingId) {
                        productData.id = existingId;
                    } else {
                        productData.id = 'prod-' + Date.now() + Math.random().toString(36).substring(2, 7);
                    }

                    upsertBatch.push(productData);
                } catch (itemError) {
                    console.error('[Notion] Erreur préparation produit:', itemError.message);
                    errors.push(itemError.message);
                }
            }

            if (upsertBatch.length > 0) {
                const { error: dbError } = await supabaseAdmin.from('products').upsert(upsertBatch, {
                    onConflict: 'id'
                });

                if (dbError) {
                    throw new Error(`Erreur lors de la sauvegarde en masse : ${dbError.message}`);
                }
                syncCount = upsertBatch.length;
            }

        } catch (globalError) {
            console.error('[Notion] Erreur globale lors de la synchronisation:', globalError.message);
            errors.push(globalError.message);
        }

        const message = syncCount > 0
            ? `${syncCount} produit(s) synchronisé(s) avec succès !`
            : 'Aucun produit synchronisé. Vérifiez que vos produits ont un "Nom du produit" et sont cochés "Publié".';

        return {
            success: true,
            count: syncCount,
            message,
            errors: errors.length > 0 ? errors : undefined
        };
    }

    /**
     * Utilitaire : pause de N millisecondes (pour respecter les rate limits de l'API Notion)
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Construit l'objet de propriété Notion à partir de la config fournie par l'admin.
     * @param {object} columnConfig - { name, type, options?, format? }
     * @returns {object} - L'objet "properties" au format API Notion
     */
    _buildNotionProperty(columnConfig) {
        const { type, options = [], format = 'number' } = columnConfig;

        switch (type) {
            case 'select':
                return {
                    select: {
                        options: options.map(opt => ({
                            name: opt.name,
                            color: opt.color || 'default'
                        }))
                    }
                };
            case 'multi_select':
                return {
                    multi_select: {
                        options: options.map(opt => ({
                            name: opt.name,
                            color: opt.color || 'default'
                        }))
                    }
                };
            case 'number':
                return { number: { format } };
            case 'checkbox':
                return { checkbox: {} };
            case 'url':
                return { url: {} };
            case 'date':
                return { date: {} };
            case 'rich_text':
            default:
                return { rich_text: {} };
        }
    }

    /**
     * Déploie une nouvelle colonne (propriété) sur les bases de données Notion
     * de TOUS les vendeurs connectés à Notion.
     *
     * @param {object} columnConfig - { name, type, options?, format?, defaultValue? }
     * @returns {object} - Rapport { total, success, failed, errors[] }
     */
    async addColumnToAllDatabases(columnConfig) {
        const { name } = columnConfig;

        if (!name || !columnConfig.type) {
            throw new Error('Le nom et le type de la colonne sont obligatoires.');
        }

        // 1. Récupérer tous les vendeurs Notion depuis Supabase
        const { data: integrations, error: intError } = await supabaseAdmin
            .from('vendor_integrations')
            .select('vendor_id, access_token, webhook_url')
            .eq('provider', 'notion');

        if (intError) throw intError;

        const total = integrations ? integrations.length : 0;
        const results = { total, success: 0, skipped: 0, failed: 0, errors: [] };

        if (total === 0) {
            return { ...results, message: 'Aucun vendeur connecté à Notion.' };
        }

        console.log(`[NotionAdmin] Déploiement de la colonne "${name}" sur ${total} base(s) Notion...`);

        const propertyPayload = this._buildNotionProperty(columnConfig);

        // 2. Boucle sur chaque vendeur avec délai pour respecter les rate limits (~3 req/s)
        for (const integration of integrations) {
            const { vendor_id, access_token, webhook_url: database_id } = integration;

            if (!access_token || !database_id) {
                results.skipped++;
                results.errors.push({ vendor_id, reason: 'Token ou Database ID manquant.' });
                continue;
            }

            try {
                // Vérifier si la colonne existe déjà (idempotence)
                const dbRes = await fetch(`https://api.notion.com/v1/databases/${database_id}`, {
                    headers: {
                        'Authorization': `Bearer ${access_token}`,
                        'Notion-Version': '2022-06-28'
                    }
                });

                if (!dbRes.ok) {
                    const errBody = await dbRes.json().catch(() => ({}));
                    throw new Error(`Impossible d'accéder à la base (${dbRes.status}): ${errBody.message || dbRes.statusText}`);
                }

                const dbData = await dbRes.json();

                if (dbData.properties && dbData.properties[name]) {
                    console.log(`[NotionAdmin] Colonne "${name}" existe déjà chez vendeur ${vendor_id} — ignoré.`);
                    results.skipped++;
                    await this._sleep(350);
                    continue;
                }

                // Ajouter la nouvelle propriété au schéma de la base
                const patchRes = await fetch(`https://api.notion.com/v1/databases/${database_id}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${access_token}`,
                        'Content-Type': 'application/json',
                        'Notion-Version': '2022-06-28'
                    },
                    body: JSON.stringify({
                        properties: {
                            [name]: propertyPayload
                        }
                    })
                });

                if (!patchRes.ok) {
                    const errBody = await patchRes.json().catch(() => ({}));
                    throw new Error(`Erreur PATCH Notion (${patchRes.status}): ${errBody.message || patchRes.statusText}`);
                }

                console.log(`[NotionAdmin] ✅ Colonne "${name}" ajoutée chez vendeur ${vendor_id}`);
                results.success++;

            } catch (err) {
                console.error(`[NotionAdmin] ❌ Échec vendeur ${vendor_id}:`, err.message);
                results.failed++;
                results.errors.push({ vendor_id, reason: err.message });
            }

            // Pause de 350ms entre chaque vendeur pour éviter les rate limits Notion
            await this._sleep(350);
        }

        const message = `Déploiement terminé : ${results.success} succès, ${results.skipped} déjà présents, ${results.failed} échecs sur ${total} vendeurs.`;
        console.log(`[NotionAdmin] ${message}`);

        return { ...results, message };
    }
}

export default new NotionService();
