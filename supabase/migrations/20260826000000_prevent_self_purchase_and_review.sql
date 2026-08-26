-- Prevent sellers from reviewing their own products even when a request
-- bypasses the browser and talks directly to Supabase.
CREATE OR REPLACE FUNCTION public.prevent_self_product_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM public.products
           WHERE id = NEW.product_id
             AND user_id::text = auth.uid()::text
       ) THEN
        RAISE EXCEPTION 'Vous ne pouvez pas donner votre avis sur votre propre produit.'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_self_product_review ON public.product_reviews;

CREATE TRIGGER prevent_self_product_review
BEFORE INSERT OR UPDATE OF product_id ON public.product_reviews
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_product_review();
