-- =========================================================================
-- MIGRATION: UNIQUE SHOP SLUG (vendor store name uniqueness)
-- Date: 2026-04-29
-- =========================================================================

BEGIN;

-- 1) Add shop_slug column
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS shop_slug TEXT;

COMMENT ON COLUMN public.users.shop_slug IS 'Unique slug for vendor storefront URLs (/boutique/<shop_slug>/NewKet).';

-- 2) Helper: slugify (best-effort, no extensions required)
-- Mirrors frontend normalization: remove accents, drop quotes, non-alnum => '_', collapse, trim.
CREATE OR REPLACE FUNCTION public.nk_slugify(input TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  WITH base AS (
    SELECT
      translate(
        lower(coalesce(input, '')),
        'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ’''',
        'aaaaaaceeeeiiiinooooouuuuyy'
      ) AS s
  ),
  cleaned AS (
    SELECT
      regexp_replace(s, '[^a-z0-9]+', '_', 'g') AS s
    FROM base
  ),
  collapsed AS (
    SELECT regexp_replace(s, '_+', '_', 'g') AS s FROM cleaned
  )
  SELECT nullif(trim(both '_' from s), '') FROM collapsed;
$$;

-- 3) Backfill for existing suppliers (avoid breaking existing data)
-- If duplicates exist, disambiguate with a short id suffix.
WITH candidates AS (
  SELECT
    id,
    public.nk_slugify(coalesce(company_name, name)) AS base_slug
  FROM public.users
  WHERE role = 'supplier'
),
ranked AS (
  SELECT
    id,
    base_slug,
    row_number() OVER (PARTITION BY base_slug ORDER BY id) AS rn
  FROM candidates
  WHERE base_slug IS NOT NULL
)
UPDATE public.users u
SET shop_slug = CASE
  WHEN r.rn = 1 THEN r.base_slug
  ELSE (r.base_slug || '_' || substr(u.id::text, 1, 6))
END
FROM ranked r
WHERE u.id = r.id
  AND (u.shop_slug IS NULL OR u.shop_slug = '');

-- 4) Enforce uniqueness (case-insensitive) for suppliers only
CREATE UNIQUE INDEX IF NOT EXISTS users_unique_supplier_shop_slug
ON public.users (lower(shop_slug))
WHERE role = 'supplier' AND shop_slug IS NOT NULL AND shop_slug <> '';

COMMIT;

