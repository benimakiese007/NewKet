import { supabaseAdmin } from '../src/config/supabase.js';
import embeddingService from '../src/services/embedding.service.js';

const requestedLimit = Number.parseInt(process.env.LIMIT || '0', 10);
const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : 500;

const firstImageUrl = (image) => String(image || '')
    .split(',')[0]
    .split('||')
    .pop()
    .trim();

const { data: products, error } = await supabaseAdmin
    .from('products')
    .select('id, image')
    .is('image_embedding', null)
    .not('image', 'is', null)
    .limit(limit);

if (error) throw error;

let indexed = 0;
let skipped = 0;

for (const product of products || []) {
    const imageUrl = firstImageUrl(product.image);
    if (!imageUrl) {
        skipped++;
        continue;
    }

    try {
        const embedding = await embeddingService.generateImageEmbedding(imageUrl);
        if (!embedding) {
            skipped++;
            continue;
        }

        const { error: updateError } = await supabaseAdmin
            .from('products')
            .update({ image_embedding: embedding })
            .eq('id', product.id);

        if (updateError) throw updateError;
        indexed++;
        console.log(`[Lens] Indexed ${indexed}/${products.length}: ${product.id}`);
    } catch (error) {
        skipped++;
        console.warn(`[Lens] Unable to index ${product.id}: ${error.message}`);
    }
}

console.log(`[Lens] Completed. Indexed: ${indexed}; skipped: ${skipped}; candidates: ${products?.length || 0}.`);
