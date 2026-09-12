-- Migration: Add Orange Money and Afrimoney to allowed providers
-- while preserving legacy KPAY and MOBILE_MONEY entries

ALTER TABLE public.vendor_payout_methods 
DROP CONSTRAINT IF EXISTS vendor_payout_methods_provider_check;

ALTER TABLE public.vendor_payout_methods 
ADD CONSTRAINT vendor_payout_methods_provider_check 
CHECK (provider IN ('MPESA', 'AIRTEL', 'ORANGE', 'AFRIMONEY', 'BANK', 'CASH', 'KPAY', 'MOBILE_MONEY'));
