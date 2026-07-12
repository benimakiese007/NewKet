/**
 * add-more-products.mjs
 * Ajoute 60+ nouveaux produits pour dépasser les 100 produits sur la plateforme.
 * Utilise uniquement les comptes "supplier".
 * Ajoute des promotions sur environ 30% des produits.
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import https from 'https';
import http from 'http';

const SUPABASE_URL    = 'https://kuygjocnnlvjtoaquicq.supabase.co';
const SUPABASE_SECRET = 'sb_secret_7PIbS1VoWnNzufQmZ7U7zg_h7TkPNeM';
const BUCKET          = 'product-images';

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET);

// ─── Catalogue de nouveaux produits (60 articles) ──────────────────────────
const NEW_PRODUCTS = [
  // Électroménager
  { name: 'Machine à café DeLonghi Magnifica', category: 'Électroménager', price: 650000, description: 'Machine à espresso automatique avec broyeur à grains. Parfait état.', is_new: true, image_url: 'https://images.unsplash.com/photo-1520209268518-aec470e83ef5?w=800&q=80' },
  { name: 'Robot Pâtissier KitchenAid Artisan', category: 'Électroménager', price: 950000, description: 'Robot multifonction rouge empire, 4.8L. Accessoires inclus.', is_new: true, image_url: 'https://images.unsplash.com/photo-1593077759530-5895781a5661?w=800&q=80' },
  { name: 'Aspirateur Dyson V15 Detect', category: 'Électroménager', price: 1200000, description: 'Aspirateur balai sans fil puissant avec laser pour la poussière invisible.', is_new: true, image_url: 'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=800&q=80' },
  { name: 'Blender Moulinex PerfectMix', category: 'Électroménager', price: 120000, description: 'Blender haute vitesse pour smoothies et soupes. Bol en verre.', is_new: false, image_url: 'https://images.unsplash.com/photo-1585237722765-8bdfa35b1d92?w=800&q=80' },
  
  // Tech & Accessoires
  { name: 'Clavier Mécanique Logitech MX Mechanical', category: 'Ordinateurs', price: 250000, description: 'Clavier sans fil avec switches tactiles silencieux.', is_new: true, image_url: 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=800&q=80' },
  { name: 'Souris MX Master 3S', category: 'Ordinateurs', price: 180000, description: 'Souris ergonomique sans fil, clic silencieux, noire.', is_new: true, image_url: 'https://images.unsplash.com/photo-1615663245857-ac1eeb536fcb?w=800&q=80' },
  { name: 'Écran PC Dell UltraSharp 27" 4K', category: 'Ordinateurs', price: 850000, description: 'Moniteur IPS 4K USB-C, idéal pour créateurs.', is_new: false, image_url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&q=80' },
  { name: 'Disque Dur Externe SSD Samsung T7 1To', category: 'Accessoires', price: 210000, description: 'SSD portable ultrarapide 1To, couleur titane.', is_new: true, image_url: 'https://images.unsplash.com/photo-1621252179027-9ec4de5a4985?w=800&q=80' },
  { name: 'Webcam Logitech Brio 4K', category: 'Accessoires', price: 320000, description: 'Webcam 4K avec HDR et Windows Hello.', is_new: false, image_url: 'https://images.unsplash.com/photo-1588698188151-51ee3e4085f3?w=800&q=80' },
  { name: 'Microphone Blue Yeti USB', category: 'Audio', price: 220000, description: 'Microphone de studio USB pour podcast et streaming.', is_new: true, image_url: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&q=80' },

  // Mode Homme
  { name: 'Sneakers Nike Air Force 1 Blanche', category: 'Chaussures', price: 220000, description: 'Classique Air Force 1 blanche, pointure 43.', is_new: true, image_url: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&q=80' },
  { name: 'Montre Casio G-Shock Noir Mat', category: 'Montres', price: 150000, description: 'Montre robuste G-Shock, étanche 200m.', is_new: true, image_url: 'https://images.unsplash.com/photo-1549972574-87440409a633?w=800&q=80' },
  { name: 'Ceinture en cuir véritable réversible', category: 'Accessoires', price: 45000, description: 'Ceinture noire/marron, boucle argentée.', is_new: true, image_url: 'https://images.unsplash.com/photo-1624222247344-550fb60583dc?w=800&q=80' },
  { name: 'Polo Lacoste L.12.12 Bleu Marine', category: 'Mode', price: 130000, description: 'Polo classique piqué de coton, taille L.', is_new: true, image_url: 'https://images.unsplash.com/photo-1586363104862-3a5e2ab60d99?w=800&q=80' },
  { name: 'Jeans Levi\'s 501 Original Fit', category: 'Mode', price: 110000, description: 'Jeans bleu brut, coupe droite classique. W32 L32.', is_new: true, image_url: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&q=80' },

  // Mode Femme
  { name: 'Sac Bandoulière YSL Noir', category: 'Sacs', price: 2500000, description: 'Sac Saint Laurent en cuir grainé noir, logo doré.', is_new: false, image_url: 'https://images.unsplash.com/photo-1584916201218-f4242ceb4809?w=800&q=80' },
  { name: 'Escarpins Louboutin Pigalle 100mm', category: 'Chaussures', price: 1100000, description: 'Escarpins noirs vernis, semelle rouge emblématique. Pointure 38.', is_new: true, image_url: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80' },
  { name: 'Lunettes de soleil Céline Triomphe', category: 'Accessoires', price: 580000, description: 'Lunettes noires ovales avec logo Triomphe doré.', is_new: true, image_url: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&q=80' },
  { name: 'Robe d\'été fleurie mi-longue', category: 'Mode Femme', price: 65000, description: 'Robe légère à motifs floraux, parfaite pour l\'été. Taille M.', is_new: true, image_url: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&q=80' },
  { name: 'Trench-coat classique beige', category: 'Mode Femme', price: 210000, description: 'Trench-coat imperméable, coupe ajustée. Idéal mi-saison.', is_new: true, image_url: 'https://images.unsplash.com/photo-1591369822096-bbcdd8247012?w=800&q=80' },

  // Sport & Outdoor
  { name: 'Montre GPS Garmin Fenix 7', category: 'Montres', price: 1350000, description: 'Montre multisport solaire, cartographie intégrée.', is_new: true, image_url: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=800&q=80' },
  { name: 'Tente de camping 4 personnes', category: 'Sport', price: 250000, description: 'Tente dôme imperméable, montage facile.', is_new: false, image_url: 'https://images.unsplash.com/photo-1504280390227-331ef29b4e54?w=800&q=80' },
  { name: 'Sac à dos randonnée Osprey 50L', category: 'Sport', price: 320000, description: 'Sac à dos technique pour trekking, dos aéré.', is_new: true, image_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80' },
  { name: 'Gourde isotherme Yeti Rambler 1L', category: 'Accessoires', price: 85000, description: 'Gourde en acier inoxydable, garde le froid 24h.', is_new: true, image_url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80' },
  { name: 'Set de clubs de golf Titleist', category: 'Sport', price: 1800000, description: 'Série complète fers et bois, sac inclus. Droitier.', is_new: false, image_url: 'https://images.unsplash.com/photo-1587329310686-91414b8e3cb7?w=800&q=80' },

  // Maison & Cuisine
  { name: 'Set de couteaux de chef japonais', category: 'Décoration', price: 350000, description: 'Set de 3 couteaux en acier damas, manche en bois d\'olivier.', is_new: true, image_url: 'https://images.unsplash.com/photo-1593444856037-f49c0d388277?w=800&q=80' },
  { name: 'Cocotte en fonte Le Creuset 24cm', category: 'Décoration', price: 420000, description: 'Cocotte ronde rouge cerise, fabriquée en France.', is_new: true, image_url: 'https://images.unsplash.com/photo-1584286595398-a59f21d313f5?w=800&q=80' },
  { name: 'Diffuseur d\'huiles essentielles Muji', category: 'Décoration', price: 95000, description: 'Diffuseur ultrasonique avec lumière LED douce.', is_new: true, image_url: 'https://images.unsplash.com/photo-1608528577891-eb055944f2e7?w=800&q=80' },
  { name: 'Plaid en laine mérinos grosses mailles', category: 'Literie', price: 150000, description: 'Plaid ultra doux gris clair, 130x170cm.', is_new: true, image_url: 'https://images.unsplash.com/photo-1580436402487-7096d24a0d92?w=800&q=80' },
  { name: 'Service de vaisselle 18 pièces grès', category: 'Décoration', price: 180000, description: 'Assiettes et bols en grès finition mate, bleu nuit.', is_new: true, image_url: 'https://images.unsplash.com/photo-1603199506016-b9a594b593c0?w=800&q=80' },

  // Audio & Vidéo
  { name: 'Barre de son Sonos Beam Gen 2', category: 'Audio', price: 750000, description: 'Barre de son compacte intelligente avec Dolby Atmos.', is_new: true, image_url: 'https://images.unsplash.com/photo-1545454675-a63b2c340b01?w=800&q=80' },
  { name: 'Écouteurs Apple AirPods Pro 2', category: 'Audio', price: 450000, description: 'Écouteurs sans fil avec réduction de bruit active de pointe.', is_new: true, image_url: 'https://images.unsplash.com/photo-1606220838315-056192d5e927?w=800&q=80' },
  { name: 'Vidéoprojecteur Anker Nebula Capsule', category: 'Audio', price: 550000, description: 'Mini projecteur portable format canette, Android TV.', is_new: true, image_url: 'https://images.unsplash.com/photo-1585642865507-6bc22998a1a3?w=800&q=80' },
  { name: 'TV OLED LG 55 pouces C3', category: 'Audio', price: 2100000, description: 'Téléviseur 4K OLED evo, 120Hz, parfait pour gaming.', is_new: false, image_url: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?w=800&q=80' },
  { name: 'Platine vinyle Audio-Technica LP120', category: 'Audio', price: 480000, description: 'Platine vinyle à entraînement direct avec préampli USB.', is_new: true, image_url: 'https://images.unsplash.com/photo-1603048297172-c92544798d5e?w=800&q=80' },

  // Gaming
  { name: 'Manette Xbox Elite Series 2', category: 'Gaming', price: 280000, description: 'Manette sans fil pro pour Xbox et PC avec composants interchangeables.', is_new: true, image_url: 'https://images.unsplash.com/photo-1600080972464-8e5f35f63d08?w=800&q=80' },
  { name: 'Casque VR Meta Quest 3 128Go', category: 'Gaming', price: 850000, description: 'Casque de réalité mixte autonome nouvelle génération.', is_new: true, image_url: 'https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?w=800&q=80' },
  { name: 'Console Nintendo Switch OLED Blanche', category: 'Gaming', price: 580000, description: 'Console hybride avec écran OLED 7 pouces vif.', is_new: true, image_url: 'https://images.unsplash.com/photo-1617393437295-d8142323f462?w=800&q=80' },
  { name: 'Jeu PS5 Spider-Man 2', category: 'Gaming', price: 110000, description: 'Jeu d\'action-aventure, version physique neuve sous blister.', is_new: true, image_url: 'https://images.unsplash.com/photo-1605901309584-818e25960b8f?w=800&q=80' },
  { name: 'Siège Gaming Secretlab Titan Evo', category: 'Mobilier', price: 750000, description: 'Chaise ergonomique pour gamer, tissu SoftWeave noir.', is_new: true, image_url: 'https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=800&q=80' },

  // Livres & Culture
  { name: 'Liseuse Kindle Paperwhite 16Go', category: 'Tablettes', price: 210000, description: 'Liseuse étanche, écran sans reflets, lumière chaude réglable.', is_new: true, image_url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&q=80' },
  { name: 'Livre de recettes Ottolenghi Simple', category: 'Alimentation', price: 55000, description: 'Best-seller de recettes méditerranéennes faciles.', is_new: true, image_url: 'https://images.unsplash.com/photo-1589998059171-988d887df646?w=800&q=80' },
  { name: 'Coffret intégrale Harry Potter', category: 'Divers', price: 120000, description: 'Les 7 tomes en édition de luxe avec coffret collector.', is_new: true, image_url: 'https://images.unsplash.com/photo-1618666012174-83b441c0bc76?w=800&q=80' },

  // Santé & Beauté
  { name: 'Brosse à dents électrique Oral-B iO 9', category: 'Soins', price: 380000, description: 'Technologie magnétique, suivi IA 3D, étui de charge.', is_new: true, image_url: 'https://images.unsplash.com/photo-1584989146197-09a80fa35db6?w=800&q=80' },
  { name: 'Tondeuse à barbe Philips Series 9000', category: 'Soins', price: 150000, description: 'Tondeuse de précision avec guide laser intégré.', is_new: true, image_url: 'https://images.unsplash.com/photo-1621607512214-68297480165e?w=800&q=80' },
  { name: 'Sèche-cheveux Dyson Supersonic', category: 'Beauté', price: 680000, description: 'Sèche-cheveux rapide et sans dommage thermique, fuchsia.', is_new: true, image_url: 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=800&q=80' },
  { name: 'Coffret soin visage La Mer', category: 'Soins', price: 550000, description: 'Rituel hydratation intense avec la Crème de la Mer 30ml.', is_new: true, image_url: 'https://images.unsplash.com/photo-1599305090598-fe179d501227?w=800&q=80' },

  // Auto/Moto
  { name: 'Casque Moto Intégral Shoei NXR2', category: 'Auto-Moto', price: 780000, description: 'Casque premium noir mat, léger et silencieux. Taille L.', is_new: true, image_url: 'https://images.unsplash.com/photo-1582239763782-b1319c5c9940?w=800&q=80' },
  { name: 'Dashcam Garmin Dash Cam Mini 2', category: 'Auto-Moto', price: 210000, description: 'Caméra embarquée ultra-compacte 1080p, commande vocale.', is_new: true, image_url: 'https://images.unsplash.com/photo-1615592881186-b4859a8501da?w=800&q=80' },
  { name: 'Compresseur d\'air portatif Xiaomi', category: 'Auto-Moto', price: 85000, description: 'Mini compresseur batterie pour pneus auto/moto/vélo.', is_new: true, image_url: 'https://images.unsplash.com/photo-1599321408892-ce53efd0d082?w=800&q=80' },

  // Bijoux fins
  { name: 'Collier pendentif or blanc et saphir', category: 'Bijoux', price: 1250000, description: 'Saphir bleu de Ceylan 1ct sur chaîne or blanc 18k.', is_new: true, image_url: 'https://images.unsplash.com/photo-1599643477874-c5aaffa1610e?w=800&q=80' },
  { name: 'Boucles d\'oreilles puces diamant', category: 'Bijoux', price: 950000, description: 'Clous d\'oreilles diamants taille brillant 0.3ct chaque.', is_new: true, image_url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=80' },

  // Alimentation premium
  { name: 'Coffret Chocolats Belges Pierre Marcolini', category: 'Alimentation', price: 65000, description: 'Assortiment de 36 pralines artisanales grand cru.', is_new: true, image_url: 'https://images.unsplash.com/photo-1548883354-94bcfe321cbb?w=800&q=80' },
  { name: 'Huile d\'olive truffe blanche', category: 'Alimentation', price: 45000, description: 'Bouteille 250ml d\'huile d\'olive extra vierge infusée à la truffe.', is_new: true, image_url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800&q=80' },
  
  // Drones & Photo
  { name: 'Appareil Photo Hybride Fujifilm X-T5', category: 'Photo', price: 2900000, description: 'Boîtier argent, capteur 40MP. Design rétro, perfs modernes.', is_new: true, image_url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80' }, // Reusing an appropriate image
  { name: 'Objectif Sigma 24-70mm f/2.8 Sony E', category: 'Photo', price: 1650000, description: 'Zoom transtandard lumineux et piqué pour monture Sony.', is_new: false, image_url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80' },
  
  // Instruments de musique
  { name: 'Guitare Acoustique Fender CD-60S', category: 'Divers', price: 320000, description: 'Guitare folk table en épicéa massif, finition acajou.', is_new: true, image_url: 'https://images.unsplash.com/photo-1550291652-6ea9114a47b1?w=800&q=80' },
  { name: 'Piano Numérique Yamaha P-45', category: 'Divers', price: 850000, description: 'Clavier 88 touches toucher lourd, idéal débutants.', is_new: false, image_url: 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=800&q=80' },

  // Jouets & Enfants
  { name: 'Set LEGO Star Wars Faucon Millenium', category: 'Jouets', price: 280000, description: 'Set de construction détaillé avec 7 figurines.', is_new: true, image_url: 'https://images.unsplash.com/photo-1585366119957-e9730b6d0f60?w=800&q=80' },
  { name: 'Trottinette évolutive Globber', category: 'Jouets', price: 135000, description: 'Trottinette 3 roues avec siège, de 1 à 6 ans.', is_new: true, image_url: 'https://images.unsplash.com/photo-1511216113906-8f56bb20162f?w=800&q=80' },

  // Plus de mode...
  { name: 'Lunettes de vue Ray-Ban Clubmaster', category: 'Accessoires', price: 165000, description: 'Monture écaille/or. Vendues avec verres neutres.', is_new: true, image_url: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&q=80' },
  { name: 'Pull en cachemire col V gris', category: 'Mode', price: 195000, description: 'Pull 100% cachemire, tricot fin et chaud. Taille M.', is_new: true, image_url: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&q=80' },
  { name: 'Casquette New Era NY Yankees', category: 'Accessoires', price: 42000, description: 'Casquette 9FORTY ajustable, bleu marine/blanc.', is_new: true, image_url: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&q=80' }
];

// Total : 61 articles.

function log(msg, type = 'info') {
  const icons = { info: '📦', ok: '✅', warn: '⚠️', err: '❌', step: '🔹' };
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

async function main() {
  log(`=== AJOUT DE ${NEW_PRODUCTS.length} NOUVEAUX PRODUITS ===`);
  
  log('Récupération des comptes vendeurs (role=supplier)...', 'step');
  const { data: vendors, error: vendorErr } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('role', 'supplier')
    .eq('status', 'approved');

  if (vendorErr || !vendors?.length) {
    log(`Erreur ou aucun vendeur trouvé: ${vendorErr?.message}`, 'err');
    process.exit(1);
  }

  let successCount = 0;
  let failCount = 0;
  let promoCount = 0;

  for (let i = 0; i < NEW_PRODUCTS.length; i++) {
    const p = NEW_PRODUCTS[i];
    const vendor = vendors[i % vendors.length]; // Rotation

    // Déterminer s'il y a une promotion (environ 30% de chance)
    const isPromo = Math.random() < 0.3;
    let oldPrice = null;
    let currentPrice = p.price;

    if (isPromo) {
      // Réduction entre 10% et 40%
      const discount = 0.1 + (Math.random() * 0.3);
      let discountedPrice = Math.floor(p.price * (1 - discount));
      // Arrondir aux 500 FC près pour faire propre
      discountedPrice = Math.floor(discountedPrice / 500) * 500;
      
      oldPrice = p.price;
      currentPrice = discountedPrice;
      promoCount++;
    }

    log(`[${i + 1}/${NEW_PRODUCTS.length}] "${p.name}" ${isPromo ? '🎁 (PROMO)' : ''}`, 'info');

    try {
      const fileName = `product_new_${i + 1}_${Date.now()}.jpg`;
      const finalImageUrl = await uploadImage(p.image_url, fileName);

      const { data, error } = await supabase
        .from('products')
        .insert({
          id: randomUUID(),
          name: p.name,
          category: p.category,
          price: currentPrice,
          old_price: oldPrice,
          description: p.description,
          image: finalImageUrl,
          is_new: p.is_new,
          is_promo: isPromo,
          status: 'published',
          is_archived: false,
          user_id: vendor.id,
          supplier_email: vendor.email,
          stock: Math.floor(Math.random() * 20) + 1,
          reviews: 0,
          rating: 0,
          custom_exchange_rate: 2800,
          escrow_timer_hours: 24,
          created_at: new Date(Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000).toISOString()
        })
        .select('id')
        .single();

      if (error) { 
        log(`  ERREUR: ${error.message}`, 'err'); 
        failCount++; 
      } else { 
        log(`  ✅ Ajouté! ID: ${data.id.substring(0, 8)}...`, 'ok'); 
        successCount++; 
      }
    } catch (err) {
      log(`  Exception: ${err.message}`, 'err');
      failCount++;
    }

    await delay(350);
  }

  log('════════════════════════════════════');
  log(`Produits ajoutés : ${successCount}`);
  log(`Promotions       : ${promoCount}`);
  log(`Échecs           : ${failCount}`);
  log('════════════════════════════════════');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
