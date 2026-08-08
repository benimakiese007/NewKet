-- Migration : Paramètres de Payout Vendeur & OTP (2026-06-26)
-- ADAPTÉE : Suppression des références à public.orders

-- 1. Ajout escrow_timer_hours sur public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS escrow_timer_hours INT DEFAULT 24;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS check_escrow_timer_hours;
ALTER TABLE public.users ADD CONSTRAINT check_escrow_timer_hours
CHECK (escrow_timer_hours >= 24 AND escrow_timer_hours <= 72);

-- 2. Table vendor_payout_methods
CREATE TABLE IF NOT EXISTS public.vendor_payout_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('flexpaie', 'stripe')),
    account_id TEXT NOT NULL,
    account_name TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_payout_methods_vendor_id ON public.vendor_payout_methods(vendor_id);

ALTER TABLE public.vendor_payout_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Les vendeurs voient leurs propres méthodes" ON public.vendor_payout_methods;
CREATE POLICY "Les vendeurs voient leurs propres méthodes"
ON public.vendor_payout_methods FOR SELECT
USING ((auth.uid()::text) = vendor_id);

DROP POLICY IF EXISTS "Les vendeurs gèrent leurs propres méthodes" ON public.vendor_payout_methods;
CREATE POLICY "Les vendeurs gèrent leurs propres méthodes"
ON public.vendor_payout_methods FOR ALL
USING ((auth.uid()::text) = vendor_id);

-- 3. Table otp_verifications
CREATE TABLE IF NOT EXISTS public.otp_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_verifications_user_id ON public.otp_verifications(user_id);

ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own active OTPs" ON public.otp_verifications;
CREATE POLICY "Users can read their own active OTPs"
ON public.otp_verifications FOR SELECT
USING (auth.uid() = user_id);

-- 4. Fonction finalize_delivery_confirmation désactivée (référençait public.orders)
-- La fonction est remplacée par un stub qui retourne une erreur claire.
CREATE OR REPLACE FUNCTION public.finalize_delivery_confirmation(p_order_id TEXT, p_otp TEXT)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN jsonb_build_object('success', false, 'message', 'La table orders a été supprimée. Cette fonction est obsolète.');
END;
$$;
