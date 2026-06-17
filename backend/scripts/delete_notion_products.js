import { supabaseAdmin } from '../src/config/supabase.js';

async function deleteNotionProducts() {
    try {
        console.log('Récupération des produits avec un ID "prod-%"...');
        const { data: products, error } = await supabaseAdmin
            .from('products')
            .select('id, name')
            .like('id', 'prod-%');

        if (error) throw error;

        console.log(`Trouvé ${products.length} produits venant de Notion (ID commençant par prod-).`);

        if (products.length > 0) {
            const idsToDelete = products.map(p => p.id);
            const { error: deleteError } = await supabaseAdmin
                .from('products')
                .delete()
                .in('id', idsToDelete);

            if (deleteError) throw deleteError;
            console.log(`✅ ${products.length} produits supprimés avec succès.`);
        } else {
            console.log('Aucun produit à supprimer.');
        }
        process.exit(0);
    } catch (err) {
        console.error('Erreur:', err.message);
        process.exit(1);
    }
}

deleteNotionProducts();
