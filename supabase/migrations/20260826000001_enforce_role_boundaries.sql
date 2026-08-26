-- Enforce account role boundaries for direct Supabase requests.
-- Service-role scripts retain their explicit privileged access.
CREATE OR REPLACE FUNCTION public.enforce_product_seller_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    actor_role text;
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    IF auth.uid() IS NULL OR NEW.user_id::text <> auth.uid()::text THEN
        RAISE EXCEPTION 'Le propriétaire du produit doit être le compte connecté.'
            USING ERRCODE = '42501';
    END IF;

    SELECT role INTO actor_role
    FROM public.users
    WHERE id::text = auth.uid()::text;

    IF actor_role IS DISTINCT FROM 'supplier' THEN
        RAISE EXCEPTION 'Seuls les comptes vendeur peuvent publier des produits.'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_product_seller_role ON public.products;
CREATE TRIGGER enforce_product_seller_role
BEFORE INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION public.enforce_product_seller_role();

CREATE OR REPLACE FUNCTION public.prevent_self_product_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    IF auth.uid() IS NULL OR NEW.user_id::text <> auth.uid()::text THEN
        RAISE EXCEPTION 'Un avis doit être publié par le compte connecté.'
            USING ERRCODE = '42501';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.users
        WHERE id::text = auth.uid()::text AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Un administrateur ne peut pas donner d’avis.'
            USING ERRCODE = '42501';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.products
        WHERE id = NEW.product_id AND user_id::text = auth.uid()::text
    ) THEN
        RAISE EXCEPTION 'Vous ne pouvez pas donner votre avis sur votre propre produit.'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;
