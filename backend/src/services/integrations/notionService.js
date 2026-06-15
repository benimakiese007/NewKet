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
                }
            })
        });

        if (!queryRes.ok) {
            const errBody = await queryRes.json();
            throw new Error(`Erreur Notion Query: ${errBody.message || queryRes.statusText}`);
        }

        const response = await queryRes.json();

        if (!response.results || response.results.length === 0) {
            return { success: true, count: 0, message: 'Aucun produit "Publié" trouvé dans Notion. Cochez la case "Publié" sur vos produits.' };
        }

        let syncCount = 0;
        const errors = [];

        // 3. Upsert vers Supabase
        for (const page of response.results) {
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

                // Récupérer le supplier_email du vendeur
                const { data: vendorData } = await supabaseAdmin
                    .from('users')
                    .select('email')
                    .eq('id', vendorId)
                    .single();

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
                    supplier_email: vendorData?.email || null,
                    is_new: isNew,            // État: Neuf ou Occasion
                    custom_exchange_rate: customExchangeRate,  // Taux FC/$
                    is_promo: oldPrice !== null && oldPrice > price
                };

                // Vérifier si le produit existe déjà (par nom + vendeur)
                const { data: existing } = await supabaseAdmin
                    .from('products')
                    .select('id')
                    .eq('name', name)
                    .eq('user_id', vendorId)
                    .maybeSingle();

                let dbError = null;
                if (existing) {
                    const { error } = await supabaseAdmin.from('products').update(productData).eq('id', existing.id);
                    dbError = error;
                } else {
                    // Les produits requièrent un ID manuel ("prod-12345...")
                    const newProductId = 'prod-' + Date.now() + Math.random().toString(36).substring(2, 7);
                    const { error } = await supabaseAdmin.from('products').insert({ id: newProductId, ...productData });
                    dbError = error;
                }
                
                if (dbError) {
                    throw new Error(dbError.message);
                }
                
                syncCount++;
            } catch (itemError) {
                console.error('[Notion] Erreur sur un produit:', itemError.message);
                errors.push(itemError.message);
            }
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
}

export default new NotionService();
