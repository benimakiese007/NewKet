import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = 'product-images';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
};

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.find(b => b.name === BUCKET_NAME);
  if (!exists) {
    console.log(`Creating bucket '${BUCKET_NAME}'...`);
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, { public: true });
    if (error) throw new Error(`Failed to create bucket: ${error.message}`);
    console.log(`✅ Bucket '${BUCKET_NAME}' created successfully.`);
  } else {
    console.log(`✅ Bucket '${BUCKET_NAME}' already exists.`);
  }
}

async function uploadImages(imagesDir) {
  if (!fs.existsSync(imagesDir)) {
    throw new Error(`Images directory not found: ${imagesDir}`);
  }
  
  const files = fs.readdirSync(imagesDir);
  const imageFiles = files.filter(f => Object.keys(MIME_TYPES).includes(path.extname(f).toLowerCase()));
  
  console.log(`\nFound ${imageFiles.length} images to upload...\n`);
  
  const uploadMap = {}; // old filename -> new public URL
  
  for (const filename of imageFiles) {
    const filePath = path.join(imagesDir, filename);
    const buffer = fs.readFileSync(filePath);
    const mimeType = getMimeType(filename);
    const storagePath = filename;

    console.log(`Uploading: ${filename} (${mimeType})...`);
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, { contentType: mimeType, upsert: true });
    
    if (error) {
      console.error(`  ❌ Failed: ${error.message}`);
    } else {
      const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
      const publicUrl = urlData.publicUrl;
      uploadMap[filename] = publicUrl;
      console.log(`  ✅ Done → ${publicUrl}`);
    }
  }
  
  return uploadMap;
}

async function updateProductImages(uploadMap) {
  console.log('\nFetching products from DB to update image URLs...');
  
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, image');
  
  if (error) throw new Error(`Failed to fetch products: ${error.message}`);
  
  console.log(`Found ${products.length} products.\n`);
  let updated = 0;
  let skipped = 0;
  let notFound = 0;
  
  for (const product of products) {
    const currentImage = product.image;
    if (!currentImage) { skipped++; continue; }
    
    // Already a full URL pointing to supabase storage
    if (currentImage.startsWith('https://') && currentImage.includes('supabase.co')) {
      console.log(`  ⏩ Skipped (already Supabase URL): ${product.name}`);
      skipped++;
      continue;
    }
    
    // Extract filename from path (e.g. "Images/foo.jpg" -> "foo.jpg")
    const filename = path.basename(currentImage);
    const newUrl = uploadMap[filename];
    
    if (!newUrl) {
      console.log(`  ⚠️  No uploaded file found for: ${product.name} (image: ${currentImage})`);
      notFound++;
      continue;
    }
    
    const { error: updateError } = await supabase
      .from('products')
      .update({ image: newUrl })
      .eq('id', product.id);
    
    if (updateError) {
      console.error(`  ❌ Failed to update ${product.name}: ${updateError.message}`);
    } else {
      console.log(`  ✅ Updated: ${product.name} → ${newUrl}`);
      updated++;
    }
  }
  
  console.log(`\n📊 Summary: ${updated} updated, ${skipped} skipped, ${notFound} not found.`);
}

async function main() {
  try {
    console.log('=== NewKet Image Migration to Supabase Storage ===\n');
    await ensureBucket();
    
    const imagesDir = path.resolve('public/Images');
    const uploadMap = await uploadImages(imagesDir);
    
    await updateProductImages(uploadMap);
    
    console.log('\n🎉 Migration complete!');
  } catch (err) {
    console.error('\n💥 Migration failed:', err.message);
    process.exit(1);
  }
}

main();
