import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
dotenv.config();

const router = express.Router();

// ─── Rate limiter strict pour les analytics ─────────────────────────────────
// Limite à 20 incréments par IP par 15 minutes pour empêcher le spam de vues
const analyticsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: { error: 'Trop de requêtes analytics. Réessayez plus tard.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip, // Par IP
});

// Initialize Supabase Admin client for backend operations
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Validation UUID simple pour éviter les injections via productId
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Increment product view count
 * POST /api/analytics/view/:productId
 */
router.post('/view/:productId', analyticsLimiter, async (req, res) => {
    const { productId } = req.params;

    if (!productId) {
        return res.status(400).json({ error: 'Product ID is required.' });
    }

    // Validation du format UUID pour éviter les injections
    if (!UUID_REGEX.test(productId)) {
        return res.status(400).json({ error: 'Product ID invalide.' });
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

