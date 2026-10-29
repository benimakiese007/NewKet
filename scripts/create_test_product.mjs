import { randomUUID } from 'crypto';

const SUPABASE_URL = 'https://kuygjocnnlvjtoaquicq.supabase.co';
// Cle de service role locale extraite du .env (avec les permissions admin complètes)
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const VENDOR_EMAIL = 'benimakiese123@gmail.com';

async function createTestProduct() {
    console.log('Recherche de l\'utilisateur vendeur (' + VENDOR_EMAIL + ')...');
    
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'GET',
        headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
        }
    });
    
    if (!authRes.ok) {
        console.error('Erreur lors de la recupération des utilisateurs:', await authRes.text());
        return;
    }
    
    const usersData = await authRes.json();
    const vendor = usersData.users.find(u => u.email === VENDOR_EMAIL);
    
    if (!vendor) {
        console.error(`Vendeur ${VENDOR_EMAIL} introuvable ! Lance d'abord update_test_users.mjs`);
        return;
    }

    const uniqueId = Math.floor(Math.random() * 100000);
    const product = {
        name: `Produit de Test #${uniqueId}`,
        price: 49.99,
        category: 'Tests E2E',
        description: 'Produit généré automatiquement pour valider les tests E2E. Peut être supprimé sans danger.',
        supplier_email: VENDOR_EMAIL,
        user_id: vendor.id,
        image: `https://placehold.co/400x400/22c55e/ffffff/png?text=Produit+Test+${uniqueId}`,
        stock: 100,
        is_new: true,
        pinned: false,
        is_promo: false
    };

    console.log('Insertion du produit dans la base de donnees Supabase...');
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify(product)
    });

    if (!insertRes.ok) {
        console.error('Erreur lors de la creation du produit:', await insertRes.text());
    } else {
        const result = await insertRes.json();
        console.log('\n--- PRODUIT CREE AVEC SUCCES ---');
        console.log('ID :', result[0].id);
        console.log('Nom :', result[0].name);
        console.log('Prix :', result[0].price);
        console.log('Vendeur :', result[0].supplier_email);
    }
}

createTestProduct().catch(console.error);
