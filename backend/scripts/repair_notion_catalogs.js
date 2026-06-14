/**
 * Script de réparation : recrée le catalogue Notion pour tous les vendeurs déjà connectés
 * Usage : node repair_notion_catalogs.js
 */
import { createClient } from '@supabase/supabase-js';
import { Client as NotionClient } from '@notionhq/client';
import dotenv from 'dotenv';

dotenv.config(); // charge le .env du dossier courant (backend/)

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY  // clé admin/service
);


async function repairCatalog(vendorId, accessToken, existingDbId) {
    const notion = new NotionClient({ auth: accessToken });

    // 1. Vérifier si la BDD existante a les bonnes colonnes
    if (existingDbId) {
        try {
            const db = await notion.databases.retrieve({ database_id: existingDbId });
            const props = Object.keys(db.properties);
            const hasName = props.includes('Nom du produit') || props.includes('Nom');
            const hasPublie = props.includes('Publié');

            if (hasName && hasPublie) {
                console.log(`  ✅ Vendeur ${vendorId} : catalogue OK, pas besoin de réparer.`);
                return { status: 'ok' };
            }
            console.log(`  ⚠️  Vendeur ${vendorId} : colonnes manquantes (${props.join(', ')})`);
        } catch (e) {
            console.log(`  ⚠️  Vendeur ${vendorId} : BDD introuvable ou invalide — création d'une nouvelle.`);
        }
    } else {
        console.log(`  ⚠️  Vendeur ${vendorId} : pas d'ID de BDD enregistré — création nécessaire.`);
    }

    // 2. Chercher si une BDD "📦 Catalogue NewKet" correcte existe déjà dans Notion
    try {
        // NOTE: l'API notion.search ne supporte que filter.value = "page" ou "data_source"
        // On cherche donc parmi toutes les ressources sans filtre de type
        const search = await notion.search({
            query: 'Catalogue NewKet',
            page_size: 10
        });

        // Chercher une BDD avec les bonnes colonnes parmi les résultats
        for (const item of search.results) {
            if (item.object !== 'database') continue;
            const props = Object.keys(item.properties || {});
            if (props.includes('Publié')) {
                console.log(`  🔗 Vendeur ${vendorId} : BDD correcte trouvée (${item.id}), mise à jour de la référence.`);
                await supabase.from('vendor_integrations')
                    .update({ webhook_url: item.id })
                    .eq('vendor_id', vendorId)
                    .eq('provider', 'notion');
                return { status: 'fixed', dbId: item.id };
            }
        }

        // 3. Aucune BDD correcte → en créer une nouvelle
        console.log(`  🔨 Vendeur ${vendorId} : création d'une nouvelle BDD...`);

        const pagesRes = await notion.search({
            filter: { property: 'object', value: 'page' },
            page_size: 20
        });

        // Exclure les pages système : profils utilisateur et pages racine workspace
        // Une page valide a un parent de type "page_id" ou "workspace" avec un titre réel
        const pages = pagesRes.results.filter(p => {
            // Exclure les profils de personnes (pas de titre ou ID système)
            if (!p.properties?.title && !p.properties?.Name) return false;
            // Garder seulement les pages normales (parent = workspace ou page)
            const parentType = p.parent?.type;
            return parentType === 'workspace' || parentType === 'page_id';
        });

        const parentPage = pages[0];

        if (!parentPage) {
            throw new Error('Aucune page utilisateur valide trouvée dans ce compte Notion');
        }
        console.log(`  📄 Page parente sélectionnée : ${parentPage.id} (type: ${parentPage.parent?.type})`);

        const createRes = await fetch('https://api.notion.com/v1/databases', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                parent: { type: 'page_id', page_id: parentPage.id },
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
                    'URL Image': { url: {} },
                    'Publié': { checkbox: {} }
                }
            })
        });

        if (!createRes.ok) {
            const errBody = await createRes.json();
            throw new Error(`Notion API error: ${errBody.message}`);
        }
        const newDb = await createRes.json();


        await supabase.from('vendor_integrations')
            .update({ webhook_url: newDb.id })
            .eq('vendor_id', vendorId)
            .eq('provider', 'notion');

        console.log(`  ✅ Vendeur ${vendorId} : nouvelle BDD créée (${newDb.id})`);
        return { status: 'created', dbId: newDb.id };

    } catch (err) {
        console.error(`  ❌ Vendeur ${vendorId} : erreur — ${err.message}`);
        return { status: 'error', error: err.message };
    }
}

async function main() {
    console.log('🔍 Récupération de toutes les intégrations Notion...\n');

    const { data: integrations, error } = await supabase
        .from('vendor_integrations')
        .select('vendor_id, access_token, webhook_url')
        .eq('provider', 'notion');

    if (error) {
        console.error('❌ Erreur Supabase:', error.message);
        process.exit(1);
    }

    if (!integrations || integrations.length === 0) {
        console.log('ℹ️  Aucun vendeur connecté à Notion pour le moment.');
        process.exit(0);
    }

    console.log(`📋 ${integrations.length} vendeur(s) connecté(s) à Notion.\n`);
    console.log('─'.repeat(60));

    const results = { ok: 0, fixed: 0, created: 0, error: 0 };

    for (const integration of integrations) {
        console.log(`\n🔧 Traitement vendeur: ${integration.vendor_id}`);
        const result = await repairCatalog(
            integration.vendor_id,
            integration.access_token,
            integration.webhook_url
        );
        results[result.status] = (results[result.status] || 0) + 1;
    }

    console.log('\n' + '─'.repeat(60));
    console.log('📊 Résumé :');
    console.log(`  ✅ Déjà corrects  : ${results.ok || 0}`);
    console.log(`  🔗 Référence fixée : ${results.fixed || 0}`);
    console.log(`  🔨 Nouvelles BDD  : ${results.created || 0}`);
    console.log(`  ❌ Erreurs        : ${results.error || 0}`);
    console.log('\nTerminé !');
}

main().catch(console.error);
