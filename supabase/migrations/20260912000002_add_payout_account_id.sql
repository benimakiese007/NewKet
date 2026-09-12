-- Migration: Add payout_account_id column to users table
-- This stores the vendor's mobile money number collected at onboarding

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS payout_account_id TEXT DEFAULT NULL;
