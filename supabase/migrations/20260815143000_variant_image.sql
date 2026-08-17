-- Migration to add image_url to product_variants

ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS image_url TEXT;
