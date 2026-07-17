import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kuygjocnnlvjtoaquicq.supabase.co',
  'sb_secret_7PIbS1VoWnNzufQmZ7U7zg_h7TkPNeM'
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
