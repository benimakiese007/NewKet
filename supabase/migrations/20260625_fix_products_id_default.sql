-- =========================================================================
-- MIGRATION: Fix products.id missing DEFAULT (2026-06-25)
-- =========================================================================
-- PROBLEM:
--   INSERT into `products` fails with:
--     "null value in column "id" of relation "products" violates not-null constraint"
--
-- ROOT CAUSE:
--   The `products` table was created without a DEFAULT value on the `id` column.
--   When the backend inserts a product via Supabase (RLS-scoped client), it does NOT
--   supply an explicit `id` — it expects Postgres to auto-generate one via
--   gen_random_uuid(). Without the DEFAULT, Postgres receives NULL and rejects the row.
--
-- FIX:
--   1. Because the `id` column currently contains text like 'prod-XXXXXXX', we CANNOT cast it to UUID.
--   2. We will keep the column as TEXT but set its DEFAULT to `gen_random_uuid()::text`.
-- =========================================================================

BEGIN;

-- Step 1: Ensure pgcrypto extension is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Step 2: Add DEFAULT gen_random_uuid()::text to products.id if not already set.
DO $$
DECLARE
    col_type   TEXT;
    col_default TEXT;
BEGIN
    SELECT data_type, column_default
    INTO col_type, col_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'products'
      AND column_name  = 'id';

    -- If column doesn't exist, bail (table not yet created)
    IF col_type IS NULL THEN
        RAISE NOTICE 'products.id column not found — skipping migration.';
        RETURN;
    END IF;

    -- If a default is already set, nothing to do
    IF col_default IS NOT NULL THEN
        RAISE NOTICE 'products.id already has a DEFAULT (%) — skipping.', col_default;
        RETURN;
    END IF;

    -- Set the DEFAULT
    ALTER TABLE public.products
        ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

    RAISE NOTICE 'SUCCESS: products.id DEFAULT set to gen_random_uuid()::text.';
END $$;

-- Step 3: Sanity-check — make sure NOT NULL constraint is present
ALTER TABLE public.products
    ALTER COLUMN id SET NOT NULL;

COMMIT;
