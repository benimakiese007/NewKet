import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

// Lire les clés Supabase depuis le .env du backend
let supabaseUrl = '';
let supabaseKey = '';
try {
    const envContent = fs.readFileSync(path.join(ROOT_DIR, 'backend', '.env'), 'utf8');
    const urlMatch = envContent.match(/SUPABASE_URL=(.+)/);
    const keyMatch = envContent.match(/SUPABASE_SECRET_KEY=(.+)/);
    if (urlMatch) supabaseUrl = urlMatch[1].trim();
    if (keyMatch) supabaseKey = keyMatch[1].trim();
} catch (e) {
    console.error("❌ Impossible de lire le fichier backend/.env");
    process.exit(1);
}

async function run() {
    console.log("🔍 Connexion à Supabase et comptage des images produits...\n");

    const response = await fetch(`${supabaseUrl}/rest/v1/products?select=name,image&is_archived=eq.false`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });

    const products = await response.json();

    if (!Array.isArray(products)) {
        console.error("❌ Erreur lors de la récupération des produits :", products);
        process.exit(1);
    }

    let totalProduits = products.length;
    let totalImages = 0;
    let produitsAvecMultipleImages = 0;
    let produitsAvecUneImage = 0;
    let produitsSansImage = 0;
    let maxImages = 0;
    let produitMaxImages = '';

    for (const product of products) {
        if (!product.image || product.image.trim() === '') {
            produitsSansImage++;
        } else {
            const images = product.image.split(',').map(i => i.trim()).filter(i => i !== '');
            const count = images.length;
            totalImages += count;

            if (count === 1) produitsAvecUneImage++;
            if (count > 1) produitsAvecMultipleImages++;
            if (count > maxImages) {
                maxImages = count;
                produitMaxImages = product.name;
            }
        }
    }

    const moyenne = totalProduits > 0 ? (totalImages / totalProduits).toFixed(1) : 0;

    console.log(`📊 COMPTAGE DES IMAGES PRODUITS (Supabase) :`);
    console.log(`----------------------------------------`);
    console.log(`📦 Produits au total              : ${totalProduits}`);
    console.log(`🖼️  Images au total                : ${totalImages}`);
    console.log(`📈 Moyenne d'images / produit     : ${moyenne}`);
    console.log(`----------------------------------------`);
    console.log(`✅ Produits avec plusieurs images  : ${produitsAvecMultipleImages}`);
    console.log(`1️⃣  Produits avec 1 seule image    : ${produitsAvecUneImage}`);
    console.log(`❌ Produits sans image             : ${produitsSansImage}`);
    console.log(`----------------------------------------`);
    console.log(`🏆 Max images sur un seul produit : ${maxImages} (${produitMaxImages})`);
    console.log(`----------------------------------------`);
}

run().catch(err => {
    console.error("Fatal :", err);
    process.exit(1);
});
