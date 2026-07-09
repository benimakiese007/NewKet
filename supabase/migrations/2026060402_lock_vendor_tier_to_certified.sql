BEGIN;

-- Normalize existing data before tightening the constraint.
UPDATE public.users
SET seller_type = 'certified'
WHERE role = 'supplier'
  AND COALESCE(seller_type, '') <> 'certified';

UPDATE public.users
SET seller_type = NULL
WHERE role IS DISTINCT FROM 'supplier'
  AND seller_type = 'normal';

ALTER TABLE public.users
    ALTER COLUMN seller_type SET DEFAULT 'certified';

ALTER TABLE public.users
    DROP CONSTRAINT IF EXISTS users_seller_type_check;

ALTER TABLE public.users
    ADD CONSTRAINT users_seller_type_check
    CHECK (seller_type IS NULL OR seller_type = 'certified');

COMMENT ON COLUMN public.users.seller_type IS 'Vendor account tier: certified only for suppliers; null for non-suppliers.';

COMMIT;
