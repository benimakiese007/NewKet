import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kuygjocnnlvjtoaquicq.supabase.co',
  'sb_secret_7PIbS1VoWnNzufQmZ7U7zg_h7TkPNeM'
);

const FRENCH_NAMES = [
  "Jean Dupont", "Marie Martin", "Pierre Bernard", "Sophie Petit", "Nicolas Robert",
  "Isabelle Richard", "Julien Durand", "Camille Dubois", "Thomas Moreau", "Laurent Laurent",
  "Céline Simon", "Alexandre Michel", "Émilie Lefebvre", "Antoine Leroy", "Julie Roux",
  "Guillaume David", "Sarah Bertrand", "Romain Morel", "Lucie Fournier", "Mathieu Girard",
  "Marion Bonnet", "Kevin Blanc", "Pauline François", "Maxime Mercier", "Aurélie Dupont",
  "Benoit Lambert", "Laura Fontaine", "François Rousseau", "Anaïs Vincent", "David Muller"
];

async function run() {
  console.log('Récupération des avis anonymes...');
  
  const { data: reviews, error: fetchErr } = await supabase
    .from('product_reviews')
    .select('id')
    .ilike('user_name', '%anonyme%');

  if (fetchErr) {
    console.error('Erreur:', fetchErr);
    return;
  }

  console.log(`Trouvé ${reviews.length} avis à mettre à jour.`);

  for (let i = 0; i < reviews.length; i++) {
    const rev = reviews[i];
    const randomName = FRENCH_NAMES[Math.floor(Math.random() * FRENCH_NAMES.length)];
    
    const { error: upErr } = await supabase
      .from('product_reviews')
      .update({ user_name: randomName })
      .eq('id', rev.id);
      
    if (upErr) {
      console.error(`Erreur maj ${rev.id}:`, upErr.message);
    }
  }

  console.log('Mise à jour terminée !');
}

run().catch(console.error);
