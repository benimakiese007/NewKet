import { supabaseAdmin } from '../config/supabase.js';

export const getReviews = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.max(1, Math.min(60, parseInt(req.query.limit, 10) || 50));
        const offset = (page - 1) * limit;

        // ✅ OPTIMISATION: Colonnes précises + pagination + join slim
        const { data, error } = await supabaseAdmin
            .from('product_reviews')
            .select('id, product_id, user_id, rating, comment, created_at, user_name, user_avatar, products(name)')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

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

        // 1. Récupérer l'avis pour vérifier l'auteur
        const { data: review, error: fetchError } = await supabaseAdmin
            .from('product_reviews')
            .select('user_id')
            .eq('id', id)
            .single();

        if (fetchError || !review) {
            return res.status(404).json({ error: 'Avis introuvable.' });
        }

        // 2. Vérifier les permissions (Auteur ou Admin)
        const isAuthor = req.user && req.user.id === review.user_id;
        const isAdmin = req.user && (req.user.app_metadata?.role === 'admin' || req.user.user_metadata?.role === 'admin');

        if (!isAuthor && !isAdmin) {
            return res.status(403).json({ error: 'Non autorisé à supprimer cet avis.' });
        }

        const { error: deleteError } = await supabaseAdmin
            .from('product_reviews')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;
        res.json({ success: true, message: 'Avis supprimé avec succès.' });
    } catch (err) {
        console.error('Erreur deleteReview:', err);
        res.status(500).json({ error: 'Erreur lors de la suppression de l\'avis.' });
    }
};
