import { supabaseAdmin, hasServiceRoleKey, createUserSupabaseClient } from '../config/supabase.js';

/**
 * GET /api/gdpr/export
 * Export de toutes les données personnelles de l'utilisateur authentifié (Art. 15 & 20 RGPD)
 */
export const exportMyData = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Utilisateur non authentifié.' });

    const sb = hasServiceRoleKey ? supabaseAdmin : createUserSupabaseClient(req.token);

    try {
        // Profil utilisateur
        const { data: profile } = await sb
            .from('users')
            .select('id, email, name, role, status, company_name, store_phone, date_joined, created_at')
            .eq('id', userId)
            .single();

        // Commandes
        const { data: orders } = await sb
            .from('orders')
            .select('id, status, total_amount, created_at, updated_at, shipping_address')
            .eq('buyer_id', userId);

        // Produits publiés (vendeur)
        const { data: products } = await sb
            .from('products')
            .select('id, name, price, status, created_at')
            .eq('seller_id', userId);

        // Avis laissés
        const { data: reviews } = await sb
            .from('reviews')
            .select('id, rating, comment, created_at')
            .eq('user_id', userId);

        // Favoris
        const { data: favorites } = await sb
            .from('favorites')
            .select('product_id, created_at')
            .eq('user_id', userId);

        // Activité
        const { data: activities } = await sb
            .from('activity_log')
            .select('action, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(200);

        // Consentements
        const { data: consents } = await sb
            .from('consent_log')
            .select('consent_type, consent_given, consent_version, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        const exportPayload = {
            generated_at: new Date().toISOString(),
            rgpd_reference: 'Article 15 & 20 — Règlement (UE) 2016/679',
            data_controller: 'NewKet',
            contact: 'privacy@newket.com',
            user: profile || null,
            orders: orders || [],
            products_listed: products || [],
            reviews: reviews || [],
            favorites: favorites || [],
            activity_log: activities || [],
            consent_history: consents || [],
        };

        res.setHeader('Content-Disposition', `attachment; filename="newket-mes-donnees-${userId.slice(0, 8)}.json"`);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.json(exportPayload);
    } catch (err) {
        console.error('[RGPD] Erreur exportMyData:', err.message);
        return res.status(500).json({ error: 'Erreur lors de la génération de l\'export.' });
    }
};

/**
 * POST /api/gdpr/delete-account
 * Demande de suppression de compte (Art. 17 RGPD — droit à l'effacement)
 * Anonymise les données et enqueue une suppression définitive après 30 jours.
 */
export const requestAccountDeletion = async (req, res) => {
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    if (!userId) return res.status(401).json({ error: 'Utilisateur non authentifié.' });

    if (!hasServiceRoleKey) {
        return res.status(503).json({ error: 'Suppression de compte indisponible (clé service manquante).' });
    }

    try {
        const deletedAt = new Date();
        const scheduledDeletion = new Date(deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 jours

        // Marquer le compte comme "suppression en attente"
        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({
                status: 'deletion_pending',
                deletion_requested_at: deletedAt.toISOString(),
                deletion_scheduled_at: scheduledDeletion.toISOString(),
                // Anonymiser immédiatement les données sensibles
                name: '[Supprimé]',
                store_phone: null,
                company_name: null,
                cover_image: null,
            })
            .eq('id', userId);

        if (updateError) throw updateError;

        // Révoquer toutes les sessions Supabase Auth
        try {
            await supabaseAdmin.auth.admin.signOut(userId, 'global');
        } catch (signOutErr) {
            console.warn('[RGPD] Impossible de révoquer les sessions:', signOutErr.message);
        }

        console.log(`[RGPD] Demande de suppression enregistrée pour userId=${userId} email=${userEmail} — suppression définitive le ${scheduledDeletion.toISOString()}`);

        return res.json({
            success: true,
            message: 'Votre demande de suppression a été enregistrée. Votre compte sera définitivement supprimé dans 30 jours. Pour annuler, contactez privacy@newket.com.',
            deletion_scheduled_at: scheduledDeletion.toISOString(),
        });
    } catch (err) {
        console.error('[RGPD] Erreur requestAccountDeletion:', err.message);
        return res.status(500).json({ error: 'Erreur lors de la demande de suppression.' });
    }
};

/**
 * GET /api/gdpr/consent-history
 * Historique des consentements de l'utilisateur (Art. 7(1) RGPD)
 */
export const getConsentHistory = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Utilisateur non authentifié.' });

    const sb = hasServiceRoleKey ? supabaseAdmin : createUserSupabaseClient(req.token);

    try {
        const { data, error } = await sb
            .from('consent_log')
            .select('id, consent_type, consent_given, consent_version, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        return res.json({ consents: data || [] });
    } catch (err) {
        console.error('[RGPD] Erreur getConsentHistory:', err.message);
        return res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique.' });
    }
};
