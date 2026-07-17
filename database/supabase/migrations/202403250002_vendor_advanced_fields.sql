-- Add Advanced KYC fields to public.users table (20240325_phase2)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS store_description TEXT,
ADD COLUMN IF NOT EXISTS store_address TEXT,
ADD COLUMN IF NOT EXISTS store_phone_whatsapp TEXT,
ADD COLUMN IF NOT EXISTS preferred_payout_method TEXT;

COMMENT ON COLUMN public.users.store_description IS 'Bio/Description of the seller store';
COMMENT ON COLUMN public.users.store_address IS 'Physical address or city of the store';
COMMENT ON COLUMN public.users.store_phone_whatsapp IS 'WhatsApp contact number for buyers/admin';
COMMENT ON COLUMN public.users.preferred_payout_method IS 'M-Pesa, Orange Money, etc.';
