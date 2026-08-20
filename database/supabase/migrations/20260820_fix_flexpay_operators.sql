-- ============================================================
-- Migration : Correction taux FlexPaie + ajout operateurs manquants
-- Date       : 2026-08-20
-- Description: - Correction des taux existants (tous a 2.5% payin / 2% payout)
--              - Ajout : Afrimoney (CDF), Mastercard (USD), Visa (USD)
--              - Desactivation de l operateur generique kpay_default
-- ============================================================

INSERT INTO public.kpay_operator_fees (currency, operator, label, payin_rate, payout_rate, is_active)
VALUES
    ('CDF', 'vodacom_mpesa', 'Vodacom M-Pesa', 2.5, 2.0, true),
    ('CDF', 'airtel',        'Airtel Money',   2.5, 2.0, true),
    ('CDF', 'orange',        'Orange Money',   2.5, 2.0, true),
    ('CDF', 'afrimoney',     'Afrimoney',      2.5, 2.0, true),
    ('USD', 'mastercard',    'Mastercard',     2.5, 2.0, true),
    ('USD', 'visa',          'Visa',           2.5, 2.0, true),
    ('USD', 'kpay_default',  'KPay USD',       2.5, 2.0, false)
ON CONFLICT (currency, operator) DO UPDATE
    SET payin_rate  = EXCLUDED.payin_rate,
        payout_rate = EXCLUDED.payout_rate,
        label       = EXCLUDED.label,
        is_active   = EXCLUDED.is_active,
        updated_at  = NOW();
