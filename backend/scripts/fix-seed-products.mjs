/**
 * fix-seed-products.mjs
 * 1. Supprime les produits créés par le script seed (qui ont image contenant 'seed/')
 * 2. Republie 40 produits uniquement depuis les comptes role='supplier'
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import https from 'https';
import http from 'http';
import { URL } from 'url';

const SUPABASE_URL    = 'https://kuygjocnnlvjtoaquicq.supabase.co';
const SUPABASE_SECRET = 'sb_secret_7PIbS1VoWnNzufQmZ7U7zg_h7TkPNeM';
const BUCKET          = 'product-images';

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET);

// ─── Catalogue produits ─────────────────────────────────────────────────────
const PRODUCTS = [
  // ── Mode & Vêtements ──────────────────────────────────────────────────────
  { name: 'Veste en cuir premium noire', category: 'Mode', price: 280000,
    description: 'Veste en cuir véritable, coupe slim moderne. Idéale pour un look élégant au quotidien. Taille M.',
    is_new: true, image_url: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80' },
  { name: 'Chemise lin blanc crème', category: 'Mode', price: 85000,
    description: 'Chemise en lin naturel, respirante et confortable. Parfaite pour les journées chaudes. Tailles S/M/L.',
    is_new: true, image_url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&q=80' },
  { name: 'Sneakers Jordan Air blanc/rouge', category: 'Chaussures', price: 350000,
    description: 'Jordan Air légendaires en coloris blanc et rouge. Pointure 42. État impeccable, portées 2 fois.',
    is_new: false, image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80' },
  { name: 'Sac à main Louis Vuitton Neverfull', category: 'Sacs', price: 1200000,
    description: 'Authentique Louis Vuitton Neverfull MM en toile monogram. Avec dustbag et reçu. Très bon état.',
    is_new: false, image_url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80' },
  { name: 'Costume 3 pièces gris anthracite', category: 'Mode', price: 420000,
    description: 'Costume élégant en laine mélangée. Veste, pantalon et gilet. Taille 50. Parfait pour cérémonies.',
    is_new: true, image_url: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&q=80' },
  { name: 'Robe de soirée bordeaux', category: 'Mode Femme', price: 195000,
    description: 'Robe longue en satin, décolleté en V. Taille 38. Portée une seule fois pour une soirée de gala.',
    is_new: false, image_url: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800&q=80' },
  { name: 'Montre Fossil homme cuir marron', category: 'Montres', price: 180000,
    description: 'Montre Fossil Grant automatique, bracelet cuir marron. Boîtier 44mm. Avec boîte et garantie.',
    is_new: true, image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80' },
  { name: 'Lunettes de soleil Ray-Ban Wayfarer', category: 'Accessoires', price: 95000,
    description: 'Ray-Ban Wayfarer Classic noir mat. Protection UV400. Avec étui et chiffon de nettoyage.',
    is_new: true, image_url: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&q=80' },
  // ── Tech ──────────────────────────────────────────────────────────────────
  { name: 'iPhone 14 Pro 256GB Space Black', category: 'Téléphones', price: 1450000,
    description: 'iPhone 14 Pro en excellent état. 256GB, Space Black. Batterie 94%. Avec boîte originale.',
    is_new: false, image_url: 'https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?w=800&q=80' },
  { name: 'MacBook Air M2 13" argent', category: 'Ordinateurs', price: 2200000,
    description: 'MacBook Air M2, 8GB RAM, 256GB SSD. Chargeur MagSafe inclus. En parfait état.',
    is_new: false, image_url: 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=800&q=80' },
  { name: 'Casque Sony WH-1000XM5 noir', category: 'Audio', price: 480000,
    description: 'Casque sans fil Sony à réduction de bruit active. Autonomie 30h. Neuf dans sa boîte.',
    is_new: true, image_url: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=800&q=80' },
  { name: 'Samsung Galaxy S23 Ultra 256GB', category: 'Téléphones', price: 1350000,
    description: 'Galaxy S23 Ultra, noir, 256GB. Stylet S-Pen inclus. Très bon état.',
    is_new: false, image_url: 'https://images.unsplash.com/photo-1610945264803-c22b62d2a7b3?w=800&q=80' },
  { name: 'Tablette iPad Pro 11" M2 128GB', category: 'Tablettes', price: 1680000,
    description: 'iPad Pro 11 pouces M2, 128GB WiFi, espace gris. Avec Smart Folio. Parfait état.',
    is_new: false, image_url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&q=80' },
  { name: 'Enceinte JBL Flip 6 bleue', category: 'Audio', price: 130000,
    description: 'JBL Flip 6, coloris bleu. Étanche IP67, autonomie 12h. Neuve avec boîte.',
    is_new: true, image_url: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800&q=80' },
  { name: 'DJI Mini 3 Pro + télécommande RC', category: 'Drones', price: 980000,
    description: 'Drone DJI Mini 3 Pro avec télécommande RC. 3 batteries, sac inclus. 8h de vol total.',
    is_new: false, image_url: 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=800&q=80' },
  { name: 'Console PS5 + 2 manettes DualSense', category: 'Gaming', price: 1800000,
    description: 'PlayStation 5 edition standard avec 2 manettes. 5 jeux inclus. En parfait état.',
    is_new: false, image_url: 'https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=800&q=80' },
  // ── Maison ────────────────────────────────────────────────────────────────
  { name: 'Canapé 3 places velours émeraude', category: 'Mobilier', price: 950000,
    description: 'Canapé moderne en velours vert émeraude. Structure bois massif, pieds dorés. 220cm.',
    is_new: true, image_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80' },
  { name: 'Lampe design béton + bois', category: 'Décoration', price: 85000,
    description: 'Lampe de table artisanale en béton et bois naturel. Ampoule LED E27 incluse.',
    is_new: true, image_url: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&q=80' },
  { name: 'Miroir mural rond doré 80cm', category: 'Décoration', price: 145000,
    description: 'Miroir rond avec cadre en métal doré brossé. Diamètre 80cm. Salon ou chambre.',
    is_new: true, image_url: 'https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=800&q=80' },
  { name: 'Table basse bois flotté', category: 'Mobilier', price: 210000,
    description: 'Table basse artisanale en bois flotté, plateau verre trempé. 120x60cm. Pièce unique.',
    is_new: true, image_url: 'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=800&q=80' },
  { name: 'Ensemble literie satin 200x200', category: 'Literie', price: 320000,
    description: 'Parure de lit 200x200 satin coton 800 fils. Housse + 4 taies. Blanc cassé.',
    is_new: true, image_url: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80' },
  { name: 'Tapis berbère fait main 200x140', category: 'Décoration', price: 380000,
    description: 'Authentique tapis berbère marocain en laine naturelle, motifs géométriques. Tissé main.',
    is_new: false, image_url: 'https://images.unsplash.com/photo-1558997519-83ea9252edf8?w=800&q=80' },
  // ── Bijoux & Luxe ─────────────────────────────────────────────────────────
  { name: 'Bague or 18k avec diamant 0.5ct', category: 'Bijoux', price: 2800000,
    description: 'Bague en or 18 carats avec diamant central 0.5ct. Certificat GIA inclus. Taille 54.',
    is_new: true, image_url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800&q=80' },
  { name: 'Montre Seiko automatique acier', category: 'Montres', price: 350000,
    description: 'Seiko Presage Cocktail Time, cadran bleu profond. Mouvement automatique. Comme neuf.',
    is_new: false, image_url: 'https://images.unsplash.com/photo-1547996160-81dfa63595aa?w=800&q=80' },
  { name: 'Bracelet manchette argent sterling', category: 'Bijoux', price: 95000,
    description: 'Bracelet manchette en argent 925 avec gravure géométrique. Artisanat local.',
    is_new: true, image_url: 'https://images.unsplash.com/photo-1573408301185-9519f94815b5?w=800&q=80' },
  { name: 'Parfum Dior Sauvage EDP 100ml', category: 'Parfums', price: 320000,
    description: 'Dior Sauvage Eau de Parfum 100ml. Neuf, sous blister. Authentique avec hologramme.',
    is_new: true, image_url: 'https://images.unsplash.com/photo-1541643600914-78b084683702?w=800&q=80' },
  { name: 'Collier perles d\'eau douce', category: 'Bijoux', price: 145000,
    description: 'Collier en perles d\'eau douce naturelles, fermoir or 14k. 45cm. Dans son écrin.',
    is_new: true, image_url: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&q=80' },
  // ── Sport ─────────────────────────────────────────────────────────────────
  { name: 'Vélo de route carbone Specialized', category: 'Sport', price: 2500000,
    description: 'Specialized Allez Sprint carbone, taille M. Shimano 105 12v. 3000km au compteur.',
    is_new: false, image_url: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800&q=80' },
  { name: 'Tapis de yoga antidérapant premium', category: 'Sport', price: 65000,
    description: 'Tapis yoga 6mm en caoutchouc naturel. 183x63cm. Antidérapant, certifié sans PVC.',
    is_new: true, image_url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80' },
  { name: 'Haltères réglables 2×24kg', category: 'Fitness', price: 280000,
    description: 'Paire d\'haltères réglables 2 à 24kg. Système sélecteur rapide. Remplace rack complet.',
    is_new: false, image_url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80' },
  { name: 'Sac de sport Nike Brasilia 45L', category: 'Sport', price: 89000,
    description: 'Nike Brasilia XL coloris noir/blanc. Compartiment chaussures séparé. Neuf avec étiquette.',
    is_new: true, image_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80' },
  // ── Beauté ────────────────────────────────────────────────────────────────
  { name: 'Palette Urban Decay Naked3', category: 'Beauté', price: 180000,
    description: 'Urban Decay Naked3, 12 teintes rosées. Neuve, jamais ouverte.',
    is_new: true, image_url: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&q=80' },
  { name: 'Sérum hyaluronique visage 30ml', category: 'Soins', price: 95000,
    description: 'Sérum acide hyaluronique pur 2%. Hydratation intense, anti-âge. 30ml. Vegan.',
    is_new: true, image_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&q=80' },
  { name: 'Lisseur GHD Gold professionnel', category: 'Beauté', price: 420000,
    description: 'Lisseur GHD Gold plaques céramiques 24mm. Température 185°C. Pochette incluse.',
    is_new: false, image_url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80' },
  // ── Alimentation ──────────────────────────────────────────────────────────
  { name: 'Café Ethiopia Yirgacheffe 1kg', category: 'Alimentation', price: 48000,
    description: 'Café de spécialité Ethiopian Yirgacheffe. Notes jasmin et bergamote. 1kg grains.',
    is_new: true, image_url: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&q=80' },
  { name: 'Coffret Glenfiddich 12 ans + verres', category: 'Boissons', price: 380000,
    description: 'Glenfiddich 12 ans + 2 verres Glencairn. Édition exclusive. Sous cellophane.',
    is_new: true, image_url: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=800&q=80' },
  // ── Divers ────────────────────────────────────────────────────────────────
  { name: 'iPad 10e gen + Apple Pencil 2e gen', category: 'Tablettes', price: 720000,
    description: 'iPad 10e génération + Apple Pencil 2e gen. Idéal pour artistes et étudiants.',
    is_new: false, image_url: 'https://images.unsplash.com/photo-1561154464-82e9adf32764?w=800&q=80' },
  { name: 'Chaise ergonomique Herman Miller Aeron', category: 'Mobilier', price: 1900000,
    description: 'Herman Miller Aeron taille B. Réglage lombaire, accoudoirs 4D. Garantie restante.',
    is_new: false, image_url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80' },
  { name: 'Caméra Sony A7III + objectif 28-70mm', category: 'Photo', price: 3200000,
    description: 'Sony A7III boîtier + objectif 28-70mm f3.5-5.6. 15000 déclenchements. 2 batteries.',
    is_new: false, image_url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80' },
  { name: 'Plante artificielle palmier 180cm', category: 'Décoration', price: 75000,
    description: 'Palmier artificiel haute qualité 180cm. Pot céramique blanc inclus. Bureau ou salon.',
    is_new: true, image_url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80' },
  { name: 'Perfecto moto cuir homme taille L', category: 'Mode', price: 310000,
    description: 'Blouson perfecto en cuir véritable, fermeture asymétrique. Taille L. Très bon état.',
    is_new: false, image_url: 'https://images.unsplash.com/photo-1520975954732-35dd22299614?w=800&q=80' },
];

// ─── Utilitaires ──────────────────────────────────────────────────────────────

function log(msg, type = 'info') {
  const icons = { info: '📦', ok: '✅', warn: '⚠️', err: '❌', step: '🔹', del: '🗑️' };
  console.log(`${icons[type] || '·'} ${msg}`);
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, { headers: { 'User-Agent': 'NewKet-Seeder/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
        return fetchBuffer(res.headers.location).then(resolve).catch(reject);
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function uploadImage(imageUrl, fileName) {
  try {
    const buffer = await fetchBuffer(imageUrl);
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(`seed/${fileName}`, buffer, { contentType: 'image/jpeg', upsert: true, cacheControl: '3600' });
    if (error) return imageUrl;
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(`seed/${fileName}`);
    return urlData.publicUrl;
  } catch { return imageUrl; }
}

// ─── ÉTAPE 1 : Supprimer les anciens produits du seeding ─────────────────────

async function deleteOldSeedProducts() {
  log('Suppression des anciens produits du seeding...', 'del');

  // Récupère les produits dont l'image contient '/seed/' (uploadés par le script)
  const { data: oldProducts, error } = await supabase
    .from('products')
    .select('id, name, image')
    .like('image', '%/seed/%');

  if (error) {
    log(`Erreur récupération: ${error.message}`, 'err');
    return 0;
  }

  if (!oldProducts?.length) {
    log('Aucun ancien produit seed trouvé.', 'warn');
    return 0;
  }

  log(`${oldProducts.length} anciens produits à supprimer...`, 'del');

  const ids = oldProducts.map(p => p.id);
  const { error: delError } = await supabase
    .from('products')
    .delete()
    .in('id', ids);

  if (delError) {
    log(`Erreur suppression: ${delError.message}`, 'err');
    return 0;
  }

  log(`${ids.length} produits supprimés.`, 'ok');
  return ids.length;
}

// ─── ÉTAPE 2 : Publier depuis les comptes supplier uniquement ─────────────────

async function main() {
  log('=== CORRECTION : REPUBLICATION UNIQUEMENT DEPUIS LES VENDEURS ===');
  log('');

  // Supprimer les anciens
  const deleted = await deleteOldSeedProducts();
  log('');

  // Récupérer UNIQUEMENT les suppliers
  log('Récupération des comptes vendeurs (role=supplier)...', 'step');
  const { data: vendors, error: vendorErr } = await supabase
    .from('users')
    .select('id, name, email, role, status')
    .eq('role', 'supplier')
    .eq('status', 'approved');

  if (vendorErr || !vendors?.length) {
    log(`Aucun vendeur supplier trouvé: ${vendorErr?.message}`, 'err');
    process.exit(1);
  }

  log(`${vendors.length} vendeur(s) supplier trouvé(s):`, 'ok');
  vendors.forEach(v => log(`  - ${v.name} (${v.email})`, 'step'));
  log('');

  // Publier 40 produits
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < PRODUCTS.length; i++) {
    const p = PRODUCTS[i];
    const vendor = vendors[i % vendors.length]; // rotation entre vendors

    log(`[${i + 1}/${PRODUCTS.length}] "${p.name}"`, 'info');
    log(`  Vendeur: ${vendor.name} (${vendor.email})`, 'step');

    try {
      const fileName = `product_${i + 1}_${Date.now()}.jpg`;
      log(`  Upload image...`, 'step');
      const finalImageUrl = await uploadImage(p.image_url, fileName);
      const isStorageUrl = finalImageUrl.includes('supabase.co');
      log(`  Image: ${isStorageUrl ? '✅ Supabase Storage' : '⚠️ URL directe'}`, isStorageUrl ? 'ok' : 'warn');

      const { data, error } = await supabase
        .from('products')
        .insert({
          id: randomUUID(),
          name: p.name,
          category: p.category,
          price: p.price,
          description: p.description,
          image: finalImageUrl,
          is_new: p.is_new,
          is_promo: false,
          status: 'published',
          is_archived: false,
          user_id: vendor.id,
          supplier_email: vendor.email,
          stock: Math.floor(Math.random() * 8) + 1,
          reviews: Math.floor(Math.random() * 30),
          rating: +(3.5 + Math.random() * 1.5).toFixed(1),
          custom_exchange_rate: 2800,
          escrow_timer_hours: [24, 48, 72][Math.floor(Math.random() * 3)],
          created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
        })
        .select('id')
        .single();

      if (error) { log(`  ERREUR: ${error.message}`, 'err'); failCount++; }
      else { log(`  ✅ Publié! ID: ${data.id.substring(0, 8)}...`, 'ok'); successCount++; }
    } catch (err) {
      log(`  Exception: ${err.message}`, 'err');
      failCount++;
    }

    log('');
    await delay(350);
  }

  log('════════════════════════════════════');
  log(`Supprimés : ${deleted} anciens produits`);
  log(`Publiés   : ${successCount}/40 depuis comptes supplier`);
  log(`Échecs    : ${failCount}`);
  log('════════════════════════════════════');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
