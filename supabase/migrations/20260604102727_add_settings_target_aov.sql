-- Migration: Persist admin average order value target.

ALTER TABLE IF EXISTS public.settings
ADD COLUMN IF NOT EXISTS target_aov NUMERIC DEFAULT 0;

UPDATE public.settings
SET target_aov = 0
WHERE target_aov IS NULL;
