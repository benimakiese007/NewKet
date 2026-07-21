import { v2 as cloudinary } from 'cloudinary';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

const PRODUCT_ID = '1133c42a-7081-42c2-ae19-4e41a2541835';
const IMAGE_PATH = 'C:\\Users\\tmaut\\.gemini\\antigravity\\brain\\354b7bb1-b3aa-42d6-b122-9cf96c6d04d9\\tente_camping_4p_1784636941252.jpg';

async function fixTentImage() {
  console.log('📤 Upload de l\'image sur Cloudinary...');
  
  const uploadResult = await cloudinary.uploader.upload(IMAGE_PATH, {
    folder: 'newket/products',
    public_id: 'tente-camping-4p',
    overwrite: true,
    transformation: [{ width: 800, height: 600, crop: 'fill', quality: 'auto', fetch_format: 'auto' }],
  });

  const newImageUrl = uploadResult.secure_url;
  console.log('✅ Image uploadée:', newImageUrl);

  console.log('🔄 Mise à jour du produit dans Supabase...');
  const { data, error } = await supabase
    .from('products')
    .update({ image: newImageUrl })
    .eq('id', PRODUCT_ID)
    .select('id, name, image');

  if (error) {
    console.error('❌ Erreur Supabase:', error);
    return;
  }

  console.log('✅ Produit mis à jour:', JSON.stringify(data, null, 2));
}

fixTentImage().catch(console.error);
