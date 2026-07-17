-- Analytics produits : colonne views + RPC (IDs produits = TEXT dans ce projet)
-- Appliqué aussi via Supabase migrations : database/supabase/migrations/20260430_product_views_analytics.sql

ALTER TABLE products ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS product_views_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
    viewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

DROP FUNCTION IF EXISTS public.increment_product_views(uuid);
DROP FUNCTION IF EXISTS public.increment_product_views(text);

CREATE OR REPLACE FUNCTION public.increment_product_views(product_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE products
    SET views = COALESCE(views, 0) + 1
    WHERE id = product_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_product_views(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_product_views(text) TO service_role;
