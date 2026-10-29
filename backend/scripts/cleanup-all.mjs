/**
 * cleanup-all.mjs
 * 1. Supprime les produits appartenant à des comptes non-supplier
 * 2. Remet reviews=0 et rating=0 sur tous les produits seedés
 * 3. Corrige les images cassées/manquantes
 */

import { createClient } from '@supabase/supabase-js';
import https from 'https';
import http from 'http';

const SUPABASE_URL    = 'https://kuygjocnnlvjtoaquicq.supabase.co';
const SUPABASE_SECRET = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET);

function log(msg, type = 'info') {
  const icons = { info: '📦', ok: '✅', warn: '⚠️', err: '❌', step: '🔹', del: '🗑️', fix: '🔧' };
  console.log(`${icons[type] || '·'} ${msg}`);
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// Vérifie si une URL image est accessible
async function isImageAccessible(url) {
  if (!url || typeof url !== 'string') return false;
  // Les URLs Supabase sont toujours considérées valides
  if (url.includes('supabase.co')) return true;
  
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const proto = parsed.protocol === 'https:' ? https : http;
      const req = proto.request({ 
        method: 'HEAD', 
        hostname: parsed.hostname, 
        path: parsed.pathname + parsed.search,
        headers: { 'User-Agent': 'NewKet-Check/1.0' }
      }, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(5000, () => { req.destroy(); resolve(false); });
      req.end();
    } catch { resolve(false); }
  });
}

// Images de remplacement par catégorie (stables et accessibles)
const CATEGORY_FALLBACK_IMAGES = {
  'Mode':        'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80',
  'Mode Femme':  'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800&q=80',
  'Chaussures':  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',
  'Sacs':        'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80',
  'Accessoires': 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&q=80',
  'Montres':     'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80',
  'Téléphones':  'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800&q=80',
  'Ordinateurs': 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80',
  'Audio':       'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
  'Tablettes':   'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&q=80',
  'Drones':      'https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=800&q=80',
  'Gaming':      'https://images.unsplash.com/photo-1593118247619-e2d6f056869e?w=800&q=80',
  'Mobilier':    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80',
  'Décoration':  'https://images.unsplash.com/photo-1493663284031-b7e3aaa4acb8?w=800&q=80',
  'Literie':     'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80',
  'Bijoux':      'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800&q=80',
  'Parfums':     'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800&q=80',
  'Sport':       'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&q=80',
  'Fitness':     'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80',
  'Beauté':      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&q=80',
  'Soins':       'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&q=80',
  'Alimentation':'https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=800&q=80',
  'Boissons':    'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=800&q=80',
  'Photo':       'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80',
  'default':     'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80',
};

async function main() {
  log('=== NETTOYAGE COMPLET NEWKET ===');
  log('');

  // ── 1. Récupérer TOUS les utilisateurs avec leur rôle ──────────────────────
  log('Chargement des utilisateurs...', 'step');
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, name, email, role, status');

  const supplierIds = new Set(allUsers.filter(u => u.role === 'supplier').map(u => u.id));
  const userMap = {};
  allUsers.forEach(u => userMap[u.id] = u);

  log(`Suppliers autorisés: ${supplierIds.size}`, 'ok');
  allUsers.filter(u => u.role !== 'supplier').forEach(u => {
    log(`  NON-supplier: ${u.name} (${u.role}) — ${u.email}`, 'warn');
  });
  log('');

  // ── 2. Récupérer TOUS les produits ─────────────────────────────────────────
  log('Chargement de tous les produits...', 'step');
  const { data: allProducts, error: prodErr } = await supabase
    .from('products')
    .select('id, name, user_id, supplier_email, image, category, reviews, rating, is_archived')
    .eq('is_archived', false);

  if (prodErr) { log(`Erreur: ${prodErr.message}`, 'err'); process.exit(1); }
  log(`${allProducts.length} produits trouvés au total`, 'ok');
  log('');

  // ── 3. Supprimer produits des non-suppliers ────────────────────────────────
  log('=== ÉTAPE 1 : Suppression produits non-suppliers ===', 'fix');
  const toDelete = allProducts.filter(p => !supplierIds.has(p.user_id));
  
  if (toDelete.length === 0) {
    log('Aucun produit à supprimer (déjà propre)', 'ok');
  } else {
    log(`${toDelete.length} produits à supprimer:`, 'del');
    toDelete.forEach(p => {
      const owner = userMap[p.user_id];
      log(`  - "${p.name}" | vendeur: ${owner?.name || '?'} (${owner?.role || '?'})`, 'del');
    });

    const deleteIds = toDelete.map(p => p.id);
    const { error: delErr } = await supabase
      .from('products')
      .delete()
      .in('id', deleteIds);

    if (delErr) log(`Erreur suppression: ${delErr.message}`, 'err');
    else log(`${deleteIds.length} produits supprimés avec succès`, 'ok');
  }
  log('');

  // ── 4. Remettre reviews=0 et rating=0 sur les produits seedés ─────────────
  log('=== ÉTAPE 2 : Remise à zéro des avis factices ===', 'fix');
  
  // Produits avec des avis qui ne viennent pas de vraies reviews (reviews > 0)
  const productsToResetReviews = allProducts.filter(p => 
    supplierIds.has(p.user_id) && (p.reviews > 0 || p.rating > 0)
  );

  log(`${productsToResetReviews.length} produits avec avis à remettre à 0`, 'step');

  if (productsToResetReviews.length > 0) {
    const resetIds = productsToResetReviews.map(p => p.id);
    const { error: reviewErr } = await supabase
      .from('products')
      .update({ reviews: 0, rating: 0 })
      .in('id', resetIds);

    if (reviewErr) log(`Erreur reset avis: ${reviewErr.message}`, 'err');
    else log(`${resetIds.length} produits remis à reviews=0, rating=0`, 'ok');
  }
  log('');

  // ── 5. Corriger les images cassées ────────────────────────────────────────
  log('=== ÉTAPE 3 : Vérification et correction des images ===', 'fix');
  
  const supplierProducts = allProducts.filter(p => supplierIds.has(p.user_id));
  let fixedImages = 0;
  let checkedImages = 0;

  for (const product of supplierProducts) {
    const firstImage = product.image?.split(',')[0]?.trim();
    
    if (!firstImage) {
      // Pas d'image du tout
      const fallback = CATEGORY_FALLBACK_IMAGES[product.category] || CATEGORY_FALLBACK_IMAGES['default'];
      log(`  [SANS IMAGE] "${product.name}" → ajout image par défaut (${product.category})`, 'fix');
      const { error } = await supabase
        .from('products')
        .update({ image: fallback })
        .eq('id', product.id);
      if (!error) fixedImages++;
      await delay(100);
      continue;
    }

    checkedImages++;
    const accessible = await isImageAccessible(firstImage);
    
    if (!accessible) {
      const fallback = CATEGORY_FALLBACK_IMAGES[product.category] || CATEGORY_FALLBACK_IMAGES['default'];
      log(`  [CASSÉE] "${product.name}" → remplacement par image ${product.category}`, 'fix');
      const { error } = await supabase
        .from('products')
        .update({ image: fallback })
        .eq('id', product.id);
      if (!error) fixedImages++;
    } else {
      log(`  [OK] "${product.name}"`, 'ok');
    }
    
    await delay(200);
  }

  log('');
  log('════════════════════════════════════');
  log(`Produits non-suppliers supprimés : ${toDelete.length}`);
  log(`Avis remis à zéro                : ${productsToResetReviews.length}`);
  log(`Images vérifiées                 : ${checkedImages}`);
  log(`Images corrigées                 : ${fixedImages}`);
  log('════════════════════════════════════');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
