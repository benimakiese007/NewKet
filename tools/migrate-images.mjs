import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://kuygjocnnlvjtoaquicq.supabase.co';
// Using service_role key to bypass RLS
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1eWdqb2Nubmx2anRvYXF1aWNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM0MzY2NiwiZXhwIjoyMDg2OTE5NjY2fQ.QvH96s9FrZhzrvWjBjVNrBx00-tWTbhiPv9qnb2Bccg';
const BUCKET_NAME = 'product-images';

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
