-- Enforce purchase restrictions for direct Supabase inserts as well.
CREATE OR REPLACE FUNCTION public.enforce_order_buyer_boundaries()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    IF auth.uid() IS NULL
       OR COALESCE(NEW.customer_id, NEW.user_id)::text <> auth.uid()::text THEN
        RAISE EXCEPTION 'Une commande doit être créée par le compte acheteur connecté.'
            USING ERRCODE = '42501';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.users
        WHERE id::text = auth.uid()::text AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Un administrateur ne peut pas effectuer d’achat.'
            USING ERRCODE = '42501';
    END IF;

    IF NEW.vendor_id::text = auth.uid()::text
       OR EXISTS (
           SELECT 1
           FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::jsonb)) AS item
           JOIN public.products p ON p.id = item->>'product_id'
           WHERE p.user_id::text = auth.uid()::text
       ) THEN
        RAISE EXCEPTION 'Vous ne pouvez pas acheter votre propre produit.'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_order_buyer_boundaries ON public.orders;
CREATE TRIGGER enforce_order_buyer_boundaries
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_buyer_boundaries();
