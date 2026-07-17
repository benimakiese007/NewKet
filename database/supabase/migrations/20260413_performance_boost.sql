-- =========================================================================
-- MIGRATION: Performance Boost — Indexes Complets (20260413)
-- =========================================================================
-- Objectif : Accélérer toutes les requêtes courantes de NewKet en ajoutant
-- des index sur toutes les colonnes filtrées ou triées fréquemment.
--
-- Règle : Les index accélèrent les SELECT mais ont un coût minimal sur INSERT/UPDATE.
-- On utilise IF NOT EXISTS pour rendre la migration idempotente (safe à rejouer).
-- =========================================================================

-- =========================================================================
-- TABLE: products
-- =========================================================================
-- Index principal pour le tri par date (déjà en place — sécurité)
CREATE INDEX IF NOT EXISTS idx_products_created_at      ON public.products (created_at DESC);

-- Index pour filtrer par catégorie (très fréquent dans le catalogue)
CREATE INDEX IF NOT EXISTS idx_products_category        ON public.products (category);

-- Index pour filtrer par vendeur
CREATE INDEX IF NOT EXISTS idx_products_supplier_email  ON public.products (supplier_email);
CREATE INDEX IF NOT EXISTS idx_products_user_id         ON public.products (user_id);

-- Index pour les produits en promo / nouveaux (filtres fréquents)
CREATE INDEX IF NOT EXISTS idx_products_is_promo        ON public.products (is_promo) WHERE is_promo = true;
CREATE INDEX IF NOT EXISTS idx_products_is_new          ON public.products (is_new)   WHERE is_new   = true;

-- Index pour les recherches textuelles (ilike '%...%')
-- Note : pg_trgm permet de gérer efficacement les recherches ILIKE
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_products_name_trgm       ON public.products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_description_trgm ON public.products USING gin (description gin_trgm_ops);

-- =========================================================================
-- TABLE: users
-- =========================================================================
-- Index pour filtrer par email (auth lookup)
CREATE INDEX IF NOT EXISTS idx_users_email              ON public.users (email);

-- Index pour filtrer par rôle (admin, supplier, customer)
CREATE INDEX IF NOT EXISTS idx_users_role               ON public.users (role);

-- Index pour le statut des comptes
CREATE INDEX IF NOT EXISTS idx_users_status             ON public.users (status);

-- =========================================================================
-- TABLE: notifications
-- =========================================================================
-- Index pour le tri par date
CREATE INDEX IF NOT EXISTS idx_notifications_date       ON public.notifications (date DESC);

-- Index pour le filtre par user_id (principal)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id    ON public.notifications (user_id);

-- Index pour le filtre par email (fallback)
CREATE INDEX IF NOT EXISTS idx_notifications_user_email ON public.notifications (user_email);

-- Index pour le filtre par target_role (all, customers, suppliers)
CREATE INDEX IF NOT EXISTS idx_notifications_target_role ON public.notifications (target_role);

-- Index pour les notifications non lues (très fréquent)
CREATE INDEX IF NOT EXISTS idx_notifications_unread     ON public.notifications (read) WHERE read = false;

-- =========================================================================
-- TABLE: activities
-- =========================================================================
-- Index pour le tri par time
CREATE INDEX IF NOT EXISTS idx_activities_time          ON public.activities (time DESC);

-- Index pour filtrer par user_email
CREATE INDEX IF NOT EXISTS idx_activities_user_email    ON public.activities (user_email);

-- =========================================================================
-- TABLE: product_reviews
-- =========================================================================
-- Index pour filtrer les avis d'un produit
CREATE INDEX IF NOT EXISTS idx_reviews_product_id       ON public.product_reviews (product_id);

-- Index pour filtrer les avis d'un utilisateur
CREATE INDEX IF NOT EXISTS idx_reviews_user_id          ON public.product_reviews (user_id);

-- Index pour le tri par date
CREATE INDEX IF NOT EXISTS idx_reviews_created_at       ON public.product_reviews (created_at DESC);

-- =========================================================================
-- TABLE: user_favorites
-- =========================================================================
-- Index sur user_id (requête unique par utilisateur)
CREATE INDEX IF NOT EXISTS idx_favorites_user_id        ON public.user_favorites (user_id);

-- =========================================================================
-- TABLE: orders / whatsapp_clicks
-- =========================================================================
-- Index pour le tri par date
CREATE INDEX IF NOT EXISTS idx_orders_created_at        ON public.orders (created_at DESC);

-- Index pour filtrer par vendeur
CREATE INDEX IF NOT EXISTS idx_orders_vendor_id         ON public.orders (vendor_id);

-- Index pour filtrer par produit
CREATE INDEX IF NOT EXISTS idx_orders_product_id        ON public.orders (product_id);

-- =========================================================================
-- TABLE: subscriptions
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_subscriptions_vendor_id  ON public.subscriptions (vendor_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status     ON public.subscriptions (status);

-- =========================================================================
-- TABLE: advertisements
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_ads_slot_name            ON public.advertisements (slot_name);
CREATE INDEX IF NOT EXISTS idx_ads_active               ON public.advertisements (active) WHERE active = true;

-- =========================================================================
-- RÉSUMÉ: Cette migration ajoute ~25 index ciblés sur toutes les colonnes
-- filtrées ou triées fréquemment. Impact attendu : -60% à -90% de temps
-- de réponse sur les requêtes les plus courantes.
-- =========================================================================
