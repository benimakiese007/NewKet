/**
 * seed-reviews.mjs
 * Ajoute des avis réalistes pour exactement 51 produits.
 * Les auteurs des avis ne doivent pas être le vendeur du produit.
 * Met à jour le compteur d'avis et la note moyenne sur la table products.
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const supabase = createClient(
  'https://kuygjocnnlvjtoaquicq.supabase.co',
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '')
);

const log = (msg) => console.log(msg);

const COMMENTS = [
  "Super produit, je recommande fortement !",
  "Très bonne qualité, conforme à la description.",
  "Livraison rapide, produit excellent.",
  "J'aime beaucoup, la qualité est au rendez-vous.",
  "Un peu déçu par la couleur, mais sinon c'est top.",
  "Parfait ! Exactement ce que je cherchais.",
  "Excellent rapport qualité-prix.",
  "Je ne m'attendais pas à une telle qualité, bravo !",
  "Produit correct, sans plus.",
  "Très satisfait de mon achat.",
  "Magnifique ! Je vais en racheter.",
  "Je recommande ce vendeur, très pro.",
  "La taille est parfaite, le rendu est super.",
  "Bon produit mais la livraison a été un peu longue.",
  "Incroyable, je suis fan !",
  "C'est mon deuxième achat et toujours aussi satisfait.",
  "Qualité premium, je ne regrette pas.",
  "Acheté pour un cadeau, la personne a adoré.",
  "Finitions soignées, je valide à 100%.",
  "Rien à dire, tout est parfait."
];

function shuffleArray(array) {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

async function run() {
  log('📦 Récupération des données...');
  
  // Fetch users
  const { data: users, error: errUsers } = await supabase.from('users').select('*');
  if (errUsers) throw errUsers;

  // Fetch products
  const { data: products, error: errProducts } = await supabase.from('products').select('*');
  if (errProducts) throw errProducts;

  if (products.length < 51) {
    log(`⚠️ Pas assez de produits (${products.length}). On en prendra ${products.length} au lieu de 51.`);
  }

  // Shuffle and pick 51
  const shuffledProducts = shuffleArray(products);
  const targetProducts = shuffledProducts.slice(0, 51);

  log(`✅ ${targetProducts.length} produits sélectionnés pour recevoir des avis.`);

  let totalReviewsAdded = 0;

  for (let i = 0; i < targetProducts.length; i++) {
    const p = targetProducts[i];
    
    // Determine number of reviews: 40% chance for 7-10 reviews, 60% chance for 3-5 reviews
    const isManyReviews = Math.random() < 0.4;
    const numReviews = isManyReviews 
      ? Math.floor(Math.random() * 4) + 7 // 7 to 10
      : Math.floor(Math.random() * 3) + 3; // 3 to 5

    // Exclude the vendor of the exact product
    const eligibleReviewers = shuffleArray(users.filter(u => u.id !== p.user_id));

    // Ensure we don't try to pick more reviewers than available
    const actualNumReviews = Math.min(numReviews, eligibleReviewers.length);
    const selectedReviewers = eligibleReviewers.slice(0, actualNumReviews);

    let sumRating = 0;
    const reviewsToInsert = [];

    for (const reviewer of selectedReviewers) {
      // Mostly 4 or 5 stars, sometimes 3
      const rnd = Math.random();
      const rating = rnd > 0.8 ? 3 : (rnd > 0.4 ? 4 : 5);
      sumRating += rating;
      
      const comment = COMMENTS[Math.floor(Math.random() * COMMENTS.length)];

      reviewsToInsert.push({
        id: randomUUID(),
        product_id: p.id,
        user_id: reviewer.id,
        user_name: reviewer.full_name || reviewer.username || 'Client Anonyme',
        user_avatar: reviewer.avatar_url || null,
        rating: rating,
        comment: comment,
      });
    }

    if (reviewsToInsert.length > 0) {
      // Insert reviews
      const { error: insErr } = await supabase.from('product_reviews').insert(reviewsToInsert);
      if (insErr) {
        log(`❌ Erreur ajout avis pour produit ${p.id}: ${insErr.message}`);
        continue;
      }

      const avgRating = sumRating / reviewsToInsert.length;
      const roundedAvg = Math.round(avgRating * 10) / 10; // 1 decimal

      // Update product with reviews count and avg rating
      const { error: upErr } = await supabase.from('products').update({
        reviews: (p.reviews || 0) + reviewsToInsert.length,
        rating: roundedAvg
      }).eq('id', p.id);

      if (upErr) {
        log(`❌ Erreur MAJ stats pour produit ${p.id}: ${upErr.message}`);
      } else {
        totalReviewsAdded += reviewsToInsert.length;
        log(`[${i+1}/${targetProducts.length}] ⭐ ${reviewsToInsert.length} avis ajoutés pour "${p.name}" (Note: ${roundedAvg})`);
      }
    }
  }

  log(`\n🎉 Terminé ! ${totalReviewsAdded} avis ajoutés au total sur ${targetProducts.length} produits.`);
}

run().catch(console.error);
