-- ============================================================
-- Migration : Frais KPay par Opérateur (Option A)
-- Date       : 2026-07-25
-- Description: - Nouvelle table kpay_operator_fees (taux par opérateur/devise)
--              - Ajout colonne operator sur vendor_payout_methods
--              - Ajout colonnes payin/payout sur orders pour traçabilité complète
--              - Nettoyage des anciennes colonnes payout_fee_rate_* sur settings
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Table kpay_operator_fees
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kpay_operator_fees (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    currency     TEXT NOT NULL CHECK (currency IN ('CDF', 'USD')),
    operator     TEXT NOT NULL,   -- ex: 'vodacom_mpesa', 'airtel', 'orange', 'kpay_default'
    label        TEXT NOT NULL,   -- Nom affiché, ex: "Vodacom M-Pesa"
    payin_rate   NUMERIC NOT NULL DEFAULT 0 CHECK (payin_rate >= 0 AND payin_rate <= 100),
    payout_rate  NUMERIC NOT NULL DEFAULT 0 CHECK (payout_rate >= 0 AND payout_rate <= 100),
    is_active    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (currency, operator)
);

COMMENT ON TABLE public.kpay_operator_fees IS
    'Taux de frais KPay par opérateur Mobile Money et par devise. '
    'payin_rate = frais prélevés lors de la collecte (client → NewKet). '
    'payout_rate = frais prélevés lors du décaissement (NewKet → vendeur).';

-- Index
CREATE INDEX IF NOT EXISTS idx_kpay_operator_fees_currency
    ON public.kpay_operator_fees(currency, is_active);

-- RLS : lecture publique (les frais sont affichés aux clients/vendeurs), écriture admin seulement
ALTER TABLE public.kpay_operator_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture publique des frais KPay"
    ON public.kpay_operator_fees FOR SELECT
    USING (true);

-- ─────────────────────────────────────────────────────────────
-- 2. Données initiales — RDC (source: screenshot kpay.site/pricing)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.kpay_operator_fees (currency, operator, label, payin_rate, payout_rate, is_active)
VALUES
    ('CDF', 'vodacom_mpesa', 'Vodacom M-Pesa', 3.0, 3.0, true),
    ('CDF', 'airtel',        'Airtel Money',   4.0, 4.0, true),
    ('CDF', 'orange',        'Orange Money',   4.0, 4.0, true),
    ('USD', 'kpay_default',  'KPay USD',       2.0, 2.0, true)  -- À confirmer avec KPay
ON CONFLICT (currency, operator) DO UPDATE
    SET payin_rate  = EXCLUDED.payin_rate,
        payout_rate = EXCLUDED.payout_rate,
        label       = EXCLUDED.label,
        updated_at  = NOW();

-- ─────────────────────────────────────────────────────────────
-- 3. Colonne operator sur vendor_payout_methods
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.vendor_payout_methods
ADD COLUMN IF NOT EXISTS operator TEXT;
-- ex: 'vodacom_mpesa', 'airtel', 'orange', 'kpay_default'

COMMENT ON COLUMN public.vendor_payout_methods.operator IS
    'Opérateur Mobile Money du vendeur. Doit correspondre à un operator dans kpay_operator_fees. '
    'Utilisé pour déterminer le taux de frais de payout exact.';

-- Mettre à jour le CHECK constraint pour accepter kpay dans provider
-- (on élargit la liste des providers acceptés)
ALTER TABLE public.vendor_payout_methods
DROP CONSTRAINT IF EXISTS vendor_payout_methods_provider_check;

ALTER TABLE public.vendor_payout_methods
ADD CONSTRAINT vendor_payout_methods_provider_check
    CHECK (provider IN ('flexpaie', 'stripe', 'kpay', 'mobile_money', 'MOBILE_MONEY', 'KPAY', 'FLEXPAIE', 'STRIPE'));

-- ─────────────────────────────────────────────────────────────
-- 4. Nouvelles colonnes sur orders (traçabilité payin/payout)
-- ─────────────────────────────────────────────────────────────

-- Payin (côté client)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payin_operator TEXT;
-- Opérateur utilisé pour le payin (peut être null si inconnu ou taux max utilisé)

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payin_fee_rate NUMERIC DEFAULT 0;
-- Taux payin appliqué (ex: 4.0 pour 4%)

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payin_fee_amount NUMERIC DEFAULT 0;
-- Montant des frais payin payés par le client (ex: 4000 CDF)

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS client_total_paid NUMERIC DEFAULT 0;
-- Montant total réellement envoyé à KPay par le client (total_amount + payin_fee_amount)

-- Payout (côté vendeur)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payout_operator TEXT;
-- Opérateur du vendeur (lié à vendor_payout_methods.operator)

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payout_fee_rate NUMERIC DEFAULT 0;
-- Taux payout appliqué (ex: 4.0 pour 4%)

-- Note: payout_withdrawal_fee_amount existe déjà (migration précédente 20260724)
-- On le réutilise tel quel, il stocke le montant déduit du vendeur pour les frais payout

-- ─────────────────────────────────────────────────────────────
-- 5. Nettoyage — suppression des colonnes obsolètes sur settings
--    (remplacées par la table kpay_operator_fees)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.settings
DROP COLUMN IF EXISTS payout_fee_rate_usd;

ALTER TABLE public.settings
DROP COLUMN IF EXISTS payout_fee_rate_cdf;

-- ─────────────────────────────────────────────────────────────
-- 6. Index pour les jointures fréquentes
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_payin_operator
    ON public.orders(payin_operator) WHERE payin_operator IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_payout_operator
    ON public.orders(payout_operator) WHERE payout_operator IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vendor_payout_methods_operator
    ON public.vendor_payout_methods(operator) WHERE operator IS NOT NULL;
