import { supabaseAdmin } from '../config/supabase.js';

export const getReviews = async (req, res, next) => {
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
        let reviews = data.map(r => ({
            ...r,
            productName: r.products?.name || 'Produit inconnu'
        }));

        // Enrich missing avatars from the users table (review snapshot can have null user_avatar).
        const missingAvatarUserIds = [
            ...new Set(
                reviews
                    .filter(r => !r.user_avatar && r.user_id)
                    .map(r => r.user_id)
            )
        ];

        if (missingAvatarUserIds.length) {
            const { data: users, error: usersError } = await supabaseAdmin
                .from('users')
                .select('id, avatar')
                .in('id', missingAvatarUserIds);

            if (usersError) throw usersError;

            const avatarById = new Map((users || []).map(u => [u.id, u.avatar || null]));
            reviews = reviews.map(r => ({
                ...r,
                user_avatar: r.user_avatar || avatarById.get(r.user_id) || null
            }));

            const stillMissingUserIds = [
                ...new Set(
                    reviews
                        .filter(r => !r.user_avatar && r.user_id)
                        .map(r => r.user_id)
                )
            ];

            // Last-resort fallback: read auth metadata (Google/OTP picture) when users.avatar is null.
            // Keep it best-effort: never fail the whole endpoint if auth lookup fails.
            if (stillMissingUserIds.length && supabaseAdmin?.auth?.admin?.getUserById) {
                const authResults = await Promise.allSettled(
                    stillMissingUserIds.slice(0, 50).map((id) => supabaseAdmin.auth.admin.getUserById(id))
                );

                for (const result of authResults) {
                    if (result.status !== 'fulfilled') continue;
                    const user = result.value?.data?.user;
                    const id = user?.id;
                    if (!id) continue;
                    const meta = user.user_metadata || {};
                    const identityAvatar = user.identities?.[0]?.identity_data?.avatar_url || null;
                    const url = meta.avatar_url || meta.photo_url || meta.picture || identityAvatar || null;
                    if (url) avatarById.set(id, url);
                }

                reviews = reviews.map(r => ({
                    ...r,
                    user_avatar: r.user_avatar || avatarById.get(r.user_id) || null
                }));
            }
        }

        res.json(reviews);
    } catch (err) {
        console.error('Erreur getReviews:', err);
        next(err);
    }
};

export const deleteReview = async (req, res, next) => {
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
        next(err);
    }
};
