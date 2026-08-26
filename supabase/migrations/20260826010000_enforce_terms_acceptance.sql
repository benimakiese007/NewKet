-- Keep an auditable record of the mandatory agreements and reject protected
-- actions when that record is absent. Client-side checkboxes remain a UX aid;
-- these triggers are the authoritative enforcement point.

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS seller_terms_accepted_at TIMESTAMPTZ;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.terms_accepted_at IS
  'When the user accepted the Terms of Use and Privacy Policy.';
COMMENT ON COLUMN public.users.seller_terms_accepted_at IS
  'When the user accepted the seller declaration and terms.';
COMMENT ON COLUMN public.products.terms_accepted_at IS
  'When the seller declared that this product complies with the selling rules.';

CREATE OR REPLACE FUNCTION public.nk_enforce_terms_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'users' THEN
    -- A supplier application is only valid after its specific declaration.
    IF NEW.status = 'submitted'
       AND NEW.seller_terms_accepted_at IS NULL
       AND (
         TG_OP = 'INSERT'
         OR OLD.status IS DISTINCT FROM 'submitted'
       ) THEN
      RAISE EXCEPTION 'L''acceptation des conditions vendeur est obligatoire.'
        USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'products' THEN
    -- A new or newly-published listing must carry the seller declaration.
    IF (TG_OP = 'INSERT' OR NEW.status = 'published')
       AND NEW.terms_accepted_at IS NULL THEN
      RAISE EXCEPTION 'L''acceptation des règles de vente est obligatoire pour publier.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_user_terms_acceptance ON public.users;
CREATE TRIGGER trg_enforce_user_terms_acceptance
BEFORE INSERT OR UPDATE OF status, terms_accepted_at, seller_terms_accepted_at
ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.nk_enforce_terms_acceptance();

DROP TRIGGER IF EXISTS trg_enforce_product_terms_acceptance ON public.products;
CREATE TRIGGER trg_enforce_product_terms_acceptance
BEFORE INSERT OR UPDATE OF status, terms_accepted_at
ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.nk_enforce_terms_acceptance();

-- Auth signup happens before a public profile is created. Reject direct Auth
-- API registrations that omit the mandatory agreement metadata.
CREATE OR REPLACE FUNCTION public.nk_enforce_auth_signup_terms()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- OAuth providers do not display this email-signup checkbox; their protected
  -- seller and publishing actions remain covered by the public-table triggers.
  IF COALESCE(NEW.raw_app_meta_data ->> 'provider', 'email') = 'email'
     AND COALESCE(NEW.raw_user_meta_data ->> 'terms_accepted_at', '') = '' THEN
    RAISE EXCEPTION 'L''acceptation des conditions d''utilisation est obligatoire.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_auth_signup_terms ON auth.users;
CREATE TRIGGER trg_enforce_auth_signup_terms
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.nk_enforce_auth_signup_terms();

COMMIT;
