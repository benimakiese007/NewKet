import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kuygjocnnlvjtoaquicq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    console.log('Fetching products with loremflickr images...');
    const { data: products, error } = await supabase
        .from('products')
        .select('id, image, images')
        .like('image', '%loremflickr%');

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    console.log(`Found ${products.length} products to update.`);

    for (const p of products) {
        let newImage = p.image.replace(/https:\/\/loremflickr\.com\/[^"']+/g, 'https://res.cloudinary.com/dzhnphyp3/image/upload/c_limit,w_800,f_auto,q_auto/v1782572380/newket_assets/frontend/src/assets/Images/default.jpg');
        
        let newImages = p.images;
        if (newImages && Array.isArray(newImages)) {
            newImages = newImages.map(img => img.replace(/https:\/\/loremflickr\.com\/[^"']+/g, 'https://res.cloudinary.com/dzhnphyp3/image/upload/c_limit,w_800,f_auto,q_auto/v1782572380/newket_assets/frontend/src/assets/Images/default.jpg'));
        } else if (typeof newImages === 'string') {
            newImages = newImages.replace(/https:\/\/loremflickr\.com\/[^"']+/g, 'https://res.cloudinary.com/dzhnphyp3/image/upload/c_limit,w_800,f_auto,q_auto/v1782572380/newket_assets/frontend/src/assets/Images/default.jpg');
        }

        const { error: updateError } = await supabase
            .from('products')
            .update({ image: newImage, images: newImages })
            .eq('id', p.id);

        if (updateError) {
            console.error(`Error updating product ${p.id}:`, updateError);
        } else {
            console.log(`Updated product ${p.id}`);
        }
    }

    console.log('Also checking products where images array contains loremflickr...');
    const { data: moreProducts, error: moreError } = await supabase
        .from('products')
        .select('id, image, images');
        
    let count = 0;
    for(const p of (moreProducts||[])) {
        if((p.images && JSON.stringify(p.images).includes('loremflickr')) && !(p.image && p.image.includes('loremflickr'))) {
            let newImages = JSON.parse(JSON.stringify(p.images).replace(/https:\/\/loremflickr\.com\/[^"']+/g, 'https://res.cloudinary.com/dzhnphyp3/image/upload/c_limit,w_800,f_auto,q_auto/v1782572380/newket_assets/frontend/src/assets/Images/default.jpg'));
            await supabase.from('products').update({images: newImages}).eq('id', p.id);
            count++;
        }
    }
    console.log(`Updated ${count} additional products with loremflickr in images array.`);
    
    console.log('Done.');
}

run();
