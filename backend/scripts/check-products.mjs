import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kuygjocnnlvjtoaquicq.supabase.co',
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '')
);

const { data: sample } = await supabase.from('products').select('*').limit(1);
if (sample?.[0]) {
  console.log('=== COLONNES PRODUCTS ===');
  console.log(Object.keys(sample[0]).join(', '));
}
