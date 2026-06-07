import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function processImage(url, bucket) {
    if (!url || typeof url !== 'string') return null;
    if (url.toLowerCase().endsWith('.webp')) return null; // Already webp

    try {
        console.log(`Downloading: ${url}`);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        console.log(`Converting...`);
        const webpBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();

        // Extract a clean filename
        const urlObj = new URL(url);
        const oldPathname = urlObj.pathname;
        const oldFilename = oldPathname.substring(oldPathname.lastIndexOf('/') + 1);
        const baseName = oldFilename.split('.')[0] || Date.now().toString();
        const newFilename = `${baseName}_migrated_${Date.now()}.webp`;

        console.log(`Uploading as ${newFilename} to bucket ${bucket}...`);
        const { data, error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(newFilename, webpBuffer, {
                contentType: 'image/webp',
                upsert: true
            });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(newFilename);

        console.log(`Success -> ${publicUrlData.publicUrl}`);
        return publicUrlData.publicUrl;
    } catch (err) {
        console.error(`Error processing ${url}:`, err.message);
        return null;
    }
}

async function migrateUsers() {
    console.log('--- Migrating Users ---');
    const { data: users, error } = await supabase.from('users').select('id, avatar, cover_image');
    if (error) {
        console.error('Error fetching users:', error);
        return;
    }

    for (const user of users) {
        let updates = {};
        
        if (user.avatar) {
            const newAvatar = await processImage(user.avatar, 'user-assets');
            if (newAvatar) updates.avatar = newAvatar;
        }

        if (user.cover_image) {
            // Note: cover_image might be in vendor-covers or user-assets
            const newCover = await processImage(user.cover_image, 'vendor-covers');
            if (newCover) updates.cover_image = newCover;
        }

        if (Object.keys(updates).length > 0) {
            console.log(`Updating user ${user.id}...`);
            await supabase.from('users').update(updates).eq('id', user.id);
        }
    }
}

async function migrateProducts() {
    console.log('--- Migrating Products ---');
    const { data: products, error } = await supabase.from('products').select('id, image');
    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    for (const product of products) {
        if (product.image) {
            const rawString = product.image;
            const bundles = rawString.split(',');
            const newBundles = [];
            let modified = false;

            for (const bundleStr of bundles) {
                let thumbUrl = '';
                let fullUrl = bundleStr;

                if (bundleStr.includes('||')) {
                    const parts = bundleStr.split('||');
                    thumbUrl = parts[0];
                    fullUrl = parts[1];
                }

                // Migrate fullUrl if needed
                let newFullUrl = fullUrl;
                if (!fullUrl.toLowerCase().endsWith('.webp')) {
                    const converted = await processImage(fullUrl, 'product-images');
                    if (converted) {
                        newFullUrl = converted;
                        modified = true;
                    }
                }

                if (thumbUrl) {
                    newBundles.push(`${thumbUrl}||${newFullUrl}`);
                } else {
                    newBundles.push(newFullUrl);
                }
            }

            if (modified) {
                const finalImageString = newBundles.join(',');
                console.log(`Updating product ${product.id}...`);
                await supabase.from('products').update({ image: finalImageString }).eq('id', product.id);
            }
        }
    }
}

async function run() {
    console.log('Starting migration to WebP...');
    await migrateUsers();
    await migrateProducts();
    console.log('Migration finished!');
}

run().catch(console.error);
