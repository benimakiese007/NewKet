
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProductImages() {
    const { data: products, error } = await supabaseAdmin
        .from('products')
        .select('id, name, images, image')
        .limit(10);
    
    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    console.log('--- Product Images Check ---');
    products.forEach(p => {
        console.log(`ID: ${p.id} | Name: ${p.name}`);
        console.log(`  image: ${p.image}`);
        console.log(`  images: ${JSON.stringify(p.images)}`);
    });
}

checkProductImages();
