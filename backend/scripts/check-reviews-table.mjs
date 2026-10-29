import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kuygjocnnlvjtoaquicq.supabase.co',
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '')
);

const checkTable = async (tableName) => {
  const { data, error } = await supabase.from(tableName).select('*').limit(1);
  if (error) {
    console.log(`Table ${tableName} error:`, error.message);
  } else {
    console.log(`=== COLONNES ${tableName.toUpperCase()} ===`);
    if (data && data.length > 0) {
      console.log(Object.keys(data[0]).join(', '));
    } else {
      console.log(`Table ${tableName} is empty, could not read columns.`);
    }
  }
};

await checkTable('reviews');
await checkTable('product_reviews');
