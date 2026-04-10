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
        // Increment the 'views' column using the atomic RPC function
        const { error } = await supabase.rpc('increment_product_views', { product_id: productId });
        
        if (error) throw error;

        res.json({ success: true, message: 'View counted.' });
    } catch (error) {
        console.error(`[Analytics] Error counting view for ${productId}:`, error);
        res.status(500).json({ error: 'Failed to count view.' });
    }
});

export default router;
