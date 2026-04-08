-- EXÉCUTER CE SCRIPT DANS L'ÉDITEUR SQL DE SUPABASE
-- https://supabase.com/dashboard/project/[votre-id]/sql

-- 1. Ajouter la colonne 'views' à la table products
ALTER TABLE products ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;

-- 2. Créer une table pour le tracking détaillé des vues (optionnel mais recommandé pour des analytics futurs)
CREATE TABLE IF NOT EXISTS product_views_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    viewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Fonction pour incrémenter les vues (utilisée par le backend via RPC)
CREATE OR REPLACE FUNCTION increment_product_views(product_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE products
    SET views = COALESCE(views, 0) + 1
    WHERE id = product_id;
END;
$$;
