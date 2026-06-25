-- ============================================================
-- Migration : Commission, Payout Failure, Refund, Rate Limit
-- Date       : 2026-06-26
-- Description: Points manquants pour la production
-- ============================================================

-- 1. Commission plateforme (5% par défaut)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.settings WHERE id = 'global-settings'
    ) THEN
        INSERT INTO public.settings (id, "exchangeRate")
        VALUES ('global-settings', 2800);
    END IF;
END $$;

ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS platform_commission_rate NUMERIC DEFAULT 5.0;

-- Mettre à jour la valeur par défaut
UPDATE public.settings
SET platform_commission_rate = 5.0
WHERE id = 'global-settings' AND platform_commission_rate IS NULL;

-- 2. Colonnes Payout sur orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payout_status TEXT DEFAULT 'PENDING'
    CHECK (payout_status IN ('PENDING', 'SUCCESS', 'FAILED', 'RETRYING'));

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payout_attempts INT DEFAULT 0;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payout_last_error TEXT;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payout_amount NUMERIC;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS platform_commission_amount NUMERIC;

-- 3. Colonnes Refund sur orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS refund_status TEXT
    CHECK (refund_status IN ('NONE', 'REQUESTED', 'APPROVED', 'PROCESSED', 'FAILED'));

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS refund_amount NUMERIC;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- Valeur par défaut pour refund_status
UPDATE public.orders
SET refund_status = 'NONE'
WHERE refund_status IS NULL;

-- 4. Index pour le job de retry payout
CREATE INDEX IF NOT EXISTS idx_orders_payout_retry
ON public.orders(payout_status, payout_attempts)
WHERE payout_status IN ('FAILED', 'RETRYING') AND payout_attempts < 3;

-- 5. Index pour les OTP rate limit (recherche rapide par user + heure)
CREATE INDEX IF NOT EXISTS idx_otp_verifications_rate_limit
ON public.otp_verifications(user_id, created_at DESC);
