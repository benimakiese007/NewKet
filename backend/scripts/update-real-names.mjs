import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kuygjocnnlvjtoaquicq.supabase.co',
  'sb_secret_7PIbS1VoWnNzufQmZ7U7zg_h7TkPNeM'
);

async function run() {
  console.log('Récupération de tous les utilisateurs...');
  const { data: users, error: errUsers } = await supabase.from('users').select('id, name');
  if (errUsers) {
    console.error(errUsers);
    return;
  }
  
  // Create a mapping of user_id to name
  const userMap = {};
  users.forEach(u => {
    userMap[u.id] = u.name;
  });
  
  console.log('Récupération de tous les avis...');
  const { data: reviews, error: errReviews } = await supabase.from('product_reviews').select('id, user_id');
  if (errReviews) {
    console.error(errReviews);
    return;
  }
  
  console.log(`Mise à jour de ${reviews.length} avis avec les vrais noms...`);
  let updatedCount = 0;
  for (let i = 0; i < reviews.length; i++) {
    const rev = reviews[i];
    const realName = userMap[rev.user_id] || 'Client Anonyme';
    
    const { error: upErr } = await supabase
      .from('product_reviews')
      .update({ user_name: realName })
      .eq('id', rev.id);
      
    if (upErr) {
      console.error(`Erreur pour l'avis ${rev.id}:`, upErr.message);
    } else {
      updatedCount++;
    }
  }
  
  console.log(`Terminé ! ${updatedCount} avis ont été mis à jour avec les vrais noms de la base de données.`);
}

run().catch(console.error);
