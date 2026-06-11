import { Client } from '@notionhq/client';
import { supabaseAdmin } from '../../config/supabase.js';

class NotionService {
    /**
     * Crée la base de données "Catalogue" dans le Notion du vendeur
     */
    async createNotionDatabase(accessToken) {
        const notion = new Client({ auth: accessToken });
        
        // 1. Trouver une page partagée avec l'intégration
        const searchRes = await notion.search({
            filter: { property: 'object', value: 'page' },
            page_size: 1
        });
        
        if (searchRes.results.length === 0) {
            throw new Error("Aucune page Notion accessible. Veuillez partager au moins une page lors de l'autorisation.");
        }
        
        const parentPageId = searchRes.results[0].id;
        
        // 2. Créer la BDD avec le schéma exact pour NewKet
        const dbResponse = await notion.databases.create({
            parent: { type: 'page_id', page_id: parentPageId },
            title: [
                { type: 'text', text: { content: '📦 Catalogue NewKet' } }
            ],
            properties: {
                'Nom': { title: {} },
                'Prix (FC)': { number: { format: 'number' } },
                'Ancien Prix (FC)': { number: { format: 'number' } },
                'Description': { rich_text: {} },
                'Catégorie': { select: { options: [
                    { name: 'Électronique', color: 'blue' },
                    { name: 'Mode', color: 'pink' },
                    { name: 'Maison', color: 'green' },
                    { name: 'Cosmétique', color: 'red' },
                    { name: 'Général', color: 'default' }
                ]}},
                'Stock': { number: { format: 'number' } },
                'Publié': { checkbox: {} }
            }
        });
        
        return dbResponse.id; // On retourne l'ID de la DB pour le stocker
    }

    /**
     * Synchronise les produits de la BDD Notion vers Supabase
     */
    async syncProductsFromNotion(vendorId) {
        // 1. Récupérer le token et l'ID de la base depuis Supabase
        const { data: integration } = await supabaseAdmin
            .from('vendor_integrations')
            .select('*')
            .eq('vendor_id', vendorId)
            .eq('provider', 'notion')
            .maybeSingle();
            
        if (!integration || !integration.access_token || !integration.webhook_url) {
            throw new Error("Notion n'est pas connecté ou la base de données est introuvable.");
        }
        
        const notion = new Client({ auth: integration.access_token });
        const dbId = integration.webhook_url; // On stocke le Database ID dans webhook_url
        
        // 2. Récupérer tous les produits Notion où Publié = Vrai
        const response = await notion.databases.query({
            database_id: dbId,
            filter: { property: 'Publié', checkbox: { equals: true } }
        });
        
        let syncCount = 0;
        
        // 3. Upsert vers Supabase
        for (const page of response.results) {
            const props = page.properties;
            const name = props['Nom']?.title[0]?.plain_text;
            
            if (!name) continue; // Produit sans nom ignoré
            
            const price = props['Prix (FC)']?.number || 0;
            const oldPrice = props['Ancien Prix (FC)']?.number || null;
            const description = props['Description']?.rich_text.map(rt => rt.plain_text).join('') || '';
            const category = props['Catégorie']?.select?.name || 'Général';
            const stock = props['Stock']?.number || 1;
            
            // Image par défaut (Notion ne gère pas d'URL fixes pour les fichiers uploadés)
            const image = 'https://via.placeholder.com/400x400.png?text=' + encodeURIComponent(name);
            
            const productData = {
                name,
                price,
                old_price: oldPrice,
                description,
                category,
                stock,
                image,
                user_id: vendorId,
                is_new: true,
                is_promo: !!oldPrice
            };
            
            // Vérifier si le produit existe déjà pour ce vendeur
            const { data: existing } = await supabaseAdmin
                .from('products')
                .select('id')
                .eq('name', name)
                .eq('user_id', vendorId)
                .maybeSingle();
                
            if (existing) {
                await supabaseAdmin.from('products').update(productData).eq('id', existing.id);
            } else {
                await supabaseAdmin.from('products').insert(productData);
            }
            syncCount++;
        }
        
        return { success: true, count: syncCount };
    }
}

export default new NotionService();
