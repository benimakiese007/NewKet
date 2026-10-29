import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://kuygjocnnlvjtoaquicq.supabase.co';
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required in backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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
