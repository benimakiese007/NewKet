import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();

// Initialize Supabase Admin client for backend operations
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Increment product view count
 * POST /api/analytics/view/:productId
 */
router.post('/view/:productId', async (req, res) => {
    const { productId } = req.params;

    if (!productId) {
        return res.status(400).json({ error: 'Product ID is required.' });
    }

    try {
        // Increment the 'views' column using RPC or direct update
        // We use a raw SQL-like operation via increment if available, 
        // or a fetch-then-update (less efficient but works without RPC)
        
        // Let's try to use the 'rpc' if they have an 'increment_views' function, 
        // but for compatibility we'll do a direct update.
        const { data, error } = await supabase.rpc('increment_product_views', { product_id: productId });
        
        if (error) {
            // Fallback: direct update if RPC is missing
            const { data: currentData, error: fetchError } = await supabase
                .from('products')
                .select('views')
                .eq('id', productId)
                .single();
            
            if (fetchError) throw fetchError;

            const newViews = (currentData?.views || 0) + 1;
            const { error: updateError } = await supabase
                .from('products')
                .update({ views: newViews })
                .eq('id', productId);
            
            if (updateError) throw updateError;
        }

        res.json({ success: true, message: 'View counted.' });
    } catch (error) {
        console.error(`[Analytics] Error counting view for ${productId}:`, error);
        res.status(500).json({ error: 'Failed to count view.' });
    }
});

export default router;
