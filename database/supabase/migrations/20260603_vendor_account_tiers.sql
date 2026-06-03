BEGIN;

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS seller_type TEXT DEFAULT 'normal';

ALTER TABLE public.users
    DROP CONSTRAINT IF EXISTS users_seller_type_check;

ALTER TABLE public.users
    ADD CONSTRAINT users_seller_type_check
    CHECK (seller_type IN ('normal', 'certified'));

COMMENT ON COLUMN public.users.seller_type IS 'Vendor account tier: normal or certified.';

UPDATE public.users
SET seller_type = 'certified'
WHERE role = 'supplier'
  AND status IN ('approved', 'verified')
  AND COALESCE(seller_type, 'normal') <> 'certified';

UPDATE public.users
SET seller_type = 'normal'
WHERE seller_type IS NULL
   OR seller_type = '';

COMMIT;
