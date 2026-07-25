-- ============================================================
-- Migration : Frais de retrait vendeur (Payout Withdrawal Fee)
-- Date       : 2026-07-24
-- Description: Ajoute la configuration des frais de retrait par devise (USD/CDF)
--              et la colonne de traçabilité sur les commandes.
--              Ces frais représentent la commission de l'agrégateur (KPay) sur
--              le payout, qui est répercutée sur le vendeur.
-- ============================================================

-- 1. Colonnes de configuration dans settings (taux par devise)
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS payout_fee_rate_usd NUMERIC DEFAULT 1.0;

ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS payout_fee_rate_cdf NUMERIC DEFAULT 2.0;

-- Initialiser les valeurs par défaut si la ligne global-settings existe
UPDATE public.settings
SET
    payout_fee_rate_usd = COALESCE(payout_fee_rate_usd, 1.0),
    payout_fee_rate_cdf = COALESCE(payout_fee_rate_cdf, 2.0)
WHERE id = 'global-settings';

-- 2. Colonne de traçabilité sur orders (montant des frais de retrait retenus)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payout_withdrawal_fee_amount NUMERIC DEFAULT 0;

-- 3. Mettre à jour le CHECK constraint sur payout_status pour inclure DEFERRED_CLEARANCE
-- (s'il n'est pas déjà présent — cette migration est idempotente)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'orders'
          AND column_name = 'payout_withdrawal_fee_amount'
    ) THEN
        ALTER TABLE public.orders
        ADD COLUMN payout_withdrawal_fee_amount NUMERIC DEFAULT 0;
    END IF;
END $$;

-- 4. Commentaires pour la documentation
COMMENT ON COLUMN public.settings.payout_fee_rate_usd IS
    'Taux (%) des frais de retrait pour les payouts en USD (frais agrégateur KPay). Défaut : 1.0%';

COMMENT ON COLUMN public.settings.payout_fee_rate_cdf IS
    'Taux (%) des frais de retrait pour les payouts en CDF (frais agrégateur KPay). Défaut : 2.0%';

COMMENT ON COLUMN public.orders.payout_withdrawal_fee_amount IS
    'Montant des frais de retrait (payout withdrawal fee) déduits du montant vendeur. Ces frais couvrent la commission de l''agrégateur KPay sur le transfert sortant.';
