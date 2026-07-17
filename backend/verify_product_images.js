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

if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY)) {
  throw new Error('Missing SUPABASE_URL or SUPABASE keys in environment.');
}

async function checkProductImages() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, image, images');

  if (error) {
    console.error('Error fetching products:', error);
    return;
  }

  const productsWithMissingImages = [];
  const productsWithBrokenImages = [];

  console.log(`Checking ${data.length} products...`);

  for (const product of data) {
    let imagesToCheck = [];
    if (product.image) imagesToCheck.push(product.image);
    
    // Sometimes images is an array
    if (product.images && Array.isArray(product.images)) {
      imagesToCheck = imagesToCheck.concat(product.images);
    } else if (typeof product.images === 'string') {
        try {
            const parsed = JSON.parse(product.images);
            if (Array.isArray(parsed)) imagesToCheck = imagesToCheck.concat(parsed);
        } catch(e) {}
    }

    if (imagesToCheck.length === 0) {
      productsWithMissingImages.push(product);
      continue;
    }

    let hasBroken = false;
    for (const imageUrl of imagesToCheck) {
      if (!imageUrl || imageUrl.trim() === '') continue;
      
      try {
        const response = await fetch(imageUrl, { method: 'HEAD' });
        if (!response.ok) {
          productsWithBrokenImages.push({ product, status: response.status, url: imageUrl });
          hasBroken = true;
          break; // just log the first broken image for the product
        }
      } catch (err) {
        productsWithBrokenImages.push({ product, error: err.message, url: imageUrl });
        hasBroken = true;
        break;
      }
    }
  }

  console.log('--- Results ---');
  console.log('Total Products:', data.length);
  console.log('Products with missing images:', productsWithMissingImages.length);
  console.log('Products with broken images:', productsWithBrokenImages.length);
  
  if (productsWithMissingImages.length > 0) {
    console.log('\nMissing Images IDs:', productsWithMissingImages.map(p => p.id));
  }
  
  if (productsWithBrokenImages.length > 0) {
    console.log('\nBroken Images Details:');
    productsWithBrokenImages.forEach(item => {
      console.log(`- ID: ${item.product.id}, Name: ${item.product.name}, URL: ${item.url}, Status/Error: ${item.status || item.error}`);
    });
  }
}

checkProductImages();
