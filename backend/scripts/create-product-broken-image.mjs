/**
 * create-product-broken-image.mjs
 *
 * Insère un produit réaliste avec toutes les bonnes informations,
 * mais avec une image intentionnellement cassée (URL invalide).
 *
 * Objectif : tester le comportement du frontend / watchdog lorsqu'un
 * produit a une image manquante ou inaccessible.
 *
 * Usage: node scripts/create-product-broken-image.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// ─── Config ────────────────────────────────────────────────────────────────
const SUPABASE_URL    = 'https://kuygjocnnlvjtoaquicq.supabase.co';
const SUPABASE_SECRET = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '');

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET);

// ─── Helpers ────────────────────────────────────────────────────────────────
const log = (msg, type = 'info') => {
  const icons = { info: 'ℹ️', ok: '✅', err: '❌', step: '  →', warn: '⚠️' };
  console.log(`${icons[type] ?? ''} ${msg}`);
};

// ─── Programme principal ─────────────────────────────────────────────────────
async function main() {
  log('=== CRÉATION PRODUIT AVEC IMAGE CASSÉE ===', 'info');
  log('');

  // 1. Récupérer le vendeur ciblé
  const TARGET_EMAIL = 'benimakiese123@gmail.com';
  log(`Récupération du vendeur ${TARGET_EMAIL}...`, 'step');
  const { data: vendors, error: vendorErr } = await supabase
    .from('users')
    .select('id, name, email')
    .ilike('email', TARGET_EMAIL)
    .limit(1);

  if (vendorErr || !vendors?.length) {
    log(`Vendeur introuvable (${vendorErr?.message || 'liste vide'})`, 'err');
    process.exit(1);
  }

  const vendor = vendors[0];
  log(`Vendeur sélectionné: ${vendor.name || vendor.email} (${vendor.id.substring(0, 8)}...)`, 'ok');
  log('');

  // 2. Définir le produit avec une image cassée
  const productData = {
    id: randomUUID(),
    name: 'Montre Rolex Submariner Acier',
    category: 'Montres',
    price: 2850000, // 2 850 000 FCFA ≈ ~4 300 €
    description:
      'Rolex Submariner Date en acier inoxydable 904L. ' +
      'Lunette céramique noire, cadran noir avec index luminescents. ' +
      'Mouvement automatique calibre 3235 certifié COSC. ' +
      'Étanche jusqu\'à 300 m. Livrée avec boîte et papiers originaux 2023. ' +
      'Excellent état, portée occasionnellement.',
    image: 'https://this-url-does-not-exist.newket.invalid/broken_image_404.jpg', // ← IMAGE CASSÉE intentionnelle
    is_new: false,
    is_promo: false,
    status: 'published',
    is_archived: false,
    user_id: vendor.id,
    supplier_email: vendor.email,
    stock: 1,
    reviews: 0,
    rating: 0,
    custom_exchange_rate: 2800,
    escrow_timer_hours: 72,
    created_at: new Date().toISOString(),
  };

  log('Produit à insérer:', 'info');
  log(`  Nom        : ${productData.name}`, 'step');
  log(`  Catégorie  : ${productData.category}`, 'step');
  log(`  Prix       : ${productData.price.toLocaleString('fr-FR')} FCFA`, 'step');
  log(`  Image URL  : ${productData.image}`, 'step');
  log(`  Vendeur ID : ${productData.user_id}`, 'step');
  log('');

  // 3. Insertion en base
  log('Insertion dans Supabase...', 'step');
  const { data, error } = await supabase
    .from('products')
    .insert(productData)
    .select('id, name, image, status')
    .single();

  if (error) {
    log(`ERREUR lors de l'insertion: ${error.message}`, 'err');
    log(`Code: ${error.code}`, 'err');
    process.exit(1);
  }

  log('');
  log('════════════════════════════════════', 'info');
  log('Produit créé avec succès !', 'ok');
  log(`  ID     : ${data.id}`, 'step');
  log(`  Nom    : ${data.name}`, 'step');
  log(`  Statut : ${data.status}`, 'step');
  log(`  Image  : ${data.image}  ← CASSÉE (attendu)`, 'step');
  log('════════════════════════════════════', 'info');
  log('');
  log('Ce produit doit afficher un placeholder/fallback dans le frontend.', 'warn');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
