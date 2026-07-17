import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY
);

async function checkSizes() {
  const buckets = ['product-images', 'user-assets', 'vendor-docs'];
  
  for (const bucket of buckets) {
    console.log(`\n--- Bucket: ${bucket} ---`);
    const { data, error } = await supabase.storage.from(bucket).list('', {
      limit: 5,
      sortBy: { column: 'created_at', order: 'desc' },
    });
    
    if (error) {
      console.log('Error or bucket empty:', error.message);
      continue;
    }
    
    if (!data || data.length === 0) {
      console.log('No files found.');
      continue;
    }

    data.forEach(file => {
      if (file.name !== '.emptyFolderPlaceholder') {
        const sizeKb = (file.metadata?.size / 1024).toFixed(2);
        console.log(`- ${file.name}: ${sizeKb} Ko`);
      }
    });
  }
}

checkSizes();
