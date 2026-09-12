-- Migration: Support for Payout Security & KYC (2026-09-12)

-- 1. Add columns to users table for tracking payout changes
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS payout_change_pending BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS preferred_payout_method TEXT;

-- 2. Update vendor_payout_methods to accept MPESA and AIRTEL
-- First, we drop the existing constraint. The constraint name might be auto-generated or explicitly named.
-- In the previous migration it was defined inline, so the name is usually something like vendor_payout_methods_provider_check
DO $$ 
BEGIN
    ALTER TABLE public.vendor_payout_methods DROP CONSTRAINT IF EXISTS vendor_payout_methods_provider_check;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- Add the new constraint allowing African Mobile Money providers
ALTER TABLE public.vendor_payout_methods 
    ADD CONSTRAINT vendor_payout_methods_provider_check 
    CHECK (provider IN ('flexpaie', 'stripe', 'MPESA', 'AIRTEL', 'ORANGE', 'AFRICELL', 'kpay', 'mobile_money', 'MOBILE_MONEY', 'KPAY', 'FLEXPAIE', 'STRIPE'));

-- 3. Create 'vendor-docs' storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-docs', 'vendor-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Allow vendors to insert their own docs (KYC)
DROP POLICY IF EXISTS "Vendors can upload docs" ON storage.objects;
CREATE POLICY "Vendors can upload docs"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'vendor-docs' AND
    auth.role() = 'authenticated'
);

-- Allow admins to read the vendor-docs bucket
DROP POLICY IF EXISTS "Admins can read vendor docs" ON storage.objects;
CREATE POLICY "Admins can read vendor docs"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'vendor-docs' AND
    (
        auth.role() = 'authenticated' 
    )
);
