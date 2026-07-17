import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kuygjocnnlvjtoaquicq.supabase.co',
  'sb_secret_7PIbS1VoWnNzufQmZ7U7zg_h7TkPNeM'
);

const { data: sample } = await supabase.from('products').select('*').limit(1);
if (sample?.[0]) {
  console.log('=== COLONNES PRODUCTS ===');
  console.log(Object.keys(sample[0]).join(', '));
}
