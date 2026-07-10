-- Migration: Ajout de la colonne is_archived dans la table products
-- À exécuter dans Supabase SQL Editor ou via Supabase CLI

ALTER TABLE products ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_products_is_archived ON products(is_archived);
