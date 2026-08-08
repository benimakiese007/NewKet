-- Migration : Frais KPay par Opérateur (2026-07-25)
-- ADAPTÉE : Suppression des ALTER TABLE public.orders (table supprimée en 20260401)

-- 1. Table kpay_operator_fees
CREATE TABLE IF NOT EXISTS public.kpay_operator_fees (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    currency     TEXT NOT NULL CHECK (currency IN ('CDF', 'USD')),
    operator     TEXT NOT NULL,
    label        TEXT NOT NULL,
    payin_rate   NUMERIC NOT NULL DEFAULT 0 CHECK (payin_rate >= 0 AND payin_rate <= 100),
    payout_rate  NUMERIC NOT NULL DEFAULT 0 CHECK (payout_rate >= 0 AND payout_rate <= 100),
    is_active    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (currency, operator)
);

CREATE INDEX IF NOT EXISTS idx_kpay_operator_fees_currency
    ON public.kpay_operator_fees(currency, is_active);

ALTER TABLE public.kpay_operator_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture publique des frais KPay" ON public.kpay_operator_fees;
CREATE POLICY "Lecture publique des frais KPay"
    ON public.kpay_operator_fees FOR SELECT USING (true);

-- 2. Données initiales
INSERT INTO public.kpay_operator_fees (currency, operator, label, payin_rate, payout_rate, is_active)
VALUES
    ('CDF', 'vodacom_mpesa', 'Vodacom M-Pesa', 3.0, 3.0, true),
    ('CDF', 'airtel',        'Airtel Money',   4.0, 4.0, true),
    ('CDF', 'orange',        'Orange Money',   4.0, 4.0, true),
    ('USD', 'kpay_default',  'KPay USD',       2.0, 2.0, true)
ON CONFLICT (currency, operator) DO UPDATE
    SET payin_rate  = EXCLUDED.payin_rate,
        payout_rate = EXCLUDED.payout_rate,
        label       = EXCLUDED.label,
        updated_at  = NOW();

-- 3. Colonne operator sur vendor_payout_methods
ALTER TABLE public.vendor_payout_methods ADD COLUMN IF NOT EXISTS operator TEXT;

ALTER TABLE public.vendor_payout_methods DROP CONSTRAINT IF EXISTS vendor_payout_methods_provider_check;
ALTER TABLE public.vendor_payout_methods ADD CONSTRAINT vendor_payout_methods_provider_check
    CHECK (provider IN ('flexpaie', 'stripe', 'kpay', 'mobile_money', 'MOBILE_MONEY', 'KPAY', 'FLEXPAIE', 'STRIPE'));

-- 4. Colonnes orders SUPPRIMÉES (table orders inexistante depuis 20260401)

-- 5. Nettoyage settings
ALTER TABLE public.settings DROP COLUMN IF EXISTS payout_fee_rate_usd;
ALTER TABLE public.settings DROP COLUMN IF EXISTS payout_fee_rate_cdf;

-- 6. Index (hors orders)
CREATE INDEX IF NOT EXISTS idx_vendor_payout_methods_operator
    ON public.vendor_payout_methods(operator) WHERE operator IS NOT NULL;
