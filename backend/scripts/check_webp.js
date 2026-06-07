import { createClient } from '@supabase/supabase-js';
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

async function check() {
    console.log('--- Checking Users ---');
    const { data: users } = await supabase.from('users').select('id, avatar, cover_image');
    
    let nonWebpCount = 0;
    for (const user of users || []) {
        if (user.avatar && typeof user.avatar === 'string' && !user.avatar.toLowerCase().endsWith('.webp')) {
            console.log(`User ${user.id} has non-webp avatar: ${user.avatar}`);
            nonWebpCount++;
        }
        if (user.cover_image && typeof user.cover_image === 'string' && !user.cover_image.toLowerCase().endsWith('.webp')) {
            console.log(`User ${user.id} has non-webp cover: ${user.cover_image}`);
            nonWebpCount++;
        }
    }

    console.log('--- Checking Products ---');
    const { data: products } = await supabase.from('products').select('id, image');
    
    for (const product of products || []) {
        if (product.image && typeof product.image === 'string') {
            const urls = product.image.split('||');
            for (const url of urls) {
                if (!url.toLowerCase().endsWith('.webp')) {
                    console.log(`Product ${product.id} has non-webp image: ${url}`);
                    nonWebpCount++;
                }
            }
        }
    }
    
    console.log(`Total non-WebP images found: ${nonWebpCount}`);
}

check().catch(console.error);
