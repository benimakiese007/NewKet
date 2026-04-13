import { supabaseAdmin } from '../config/supabase.js';

export const getReviews = async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * parseInt(limit);

        // ✅ OPTIMISATION: Colonnes précises + pagination + join slim
        const { data, error } = await supabaseAdmin
            .from('product_reviews')
            .select('id, product_id, user_id, rating, comment, created_at, products(name)')
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        if (error) throw error;

        // Flatten the product name into the review object for easier frontend use
        const reviews = data.map(r => ({
            ...r,
            productName: r.products?.name || 'Produit inconnu'
        }));

        res.json(reviews);
    } catch (err) {
        console.error('Erreur getReviews:', err);
        res.status(500).json({ error: 'Erreur lors de la récupération des avis.' });
    }
};

export const deleteReview = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: 'ID requis.' });

        const { error } = await supabaseAdmin
            .from('product_reviews')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true, message: 'Avis supprimé avec succès.' });
    } catch (err) {
        console.error('Erreur deleteReview:', err);
        res.status(500).json({ error: 'Erreur lors de la suppression de l\'avis.' });
    }
};
