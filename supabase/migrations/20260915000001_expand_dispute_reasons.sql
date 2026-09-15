-- ============================================================================
-- MIGRATION: Expand dispute reasons from 4 to 7
-- Date: 2026-09-15
-- Adds: MISSING_ITEM, WRONG_ITEM, COUNTERFEIT
-- Decisions:
--   WRONG_ITEM  → REFUND_WITH_RETURN (vendeur supporte les frais retour)
--   COUNTERFEIT → UNDER_REVIEW systématique (pas de résolution amiable)
--   MISSING_ITEM → PARTIAL_REFUND (vendeur propose le montant)
-- ============================================================================

-- 1. Étendre la contrainte reason sur la table disputes
ALTER TABLE public.disputes
    DROP CONSTRAINT IF EXISTS disputes_reason_check;

ALTER TABLE public.disputes
    ADD CONSTRAINT disputes_reason_check CHECK (
        reason IS NULL OR reason IN (
            'NOT_RECEIVED',
            'DAMAGED',
            'NOT_AS_DESCRIBED',
            'MISSING_ITEM',
            'WRONG_ITEM',
            'COUNTERFEIT',
            'OTHER'
        )
    );

-- 2. Étendre aussi reason_category (colonne miroir utilisée dans certains anciens inserts)
ALTER TABLE public.disputes
    DROP CONSTRAINT IF EXISTS disputes_reason_category_check;

-- Vérifier si la colonne reason_category existe avant d'ajouter la contrainte
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'disputes'
          AND column_name  = 'reason_category'
    ) THEN
        EXECUTE $sql$
            ALTER TABLE public.disputes
                ADD CONSTRAINT disputes_reason_category_check CHECK (
                    reason_category IS NULL OR reason_category IN (
                        'NOT_RECEIVED',
                        'DAMAGED',
                        'NOT_AS_DESCRIBED',
                        'MISSING_ITEM',
                        'WRONG_ITEM',
                        'COUNTERFEIT',
                        'OTHER'
                    )
                )
        $sql$;
    END IF;
END;
$$;

-- 3. Ajouter colonne reason_flag pour marquer les litiges à traitement spécial
--    Valeurs : NULL (normal), 'FRAUD_ALERT' (COUNTERFEIT), 'ADMIN_ONLY' (OTHER)
ALTER TABLE public.disputes
    ADD COLUMN IF NOT EXISTS reason_flag TEXT DEFAULT NULL;

ALTER TABLE public.disputes
    DROP CONSTRAINT IF EXISTS disputes_reason_flag_check;

ALTER TABLE public.disputes
    ADD CONSTRAINT disputes_reason_flag_check CHECK (
        reason_flag IS NULL OR reason_flag IN ('FRAUD_ALERT', 'ADMIN_ONLY')
    );

-- 4. Backfill reason_flag pour les litiges existants
UPDATE public.disputes
SET reason_flag = CASE
    WHEN reason = 'COUNTERFEIT' THEN 'FRAUD_ALERT'
    WHEN reason = 'OTHER'       THEN 'ADMIN_ONLY'
    ELSE NULL
END
WHERE reason_flag IS NULL AND reason IN ('COUNTERFEIT', 'OTHER');

-- 5. Index sur reason_flag pour que l'admin puisse filtrer rapidement
CREATE INDEX IF NOT EXISTS idx_disputes_reason_flag
    ON public.disputes(reason_flag)
    WHERE reason_flag IS NOT NULL;

-- 6. Index sur reason pour filtrage/stats
CREATE INDEX IF NOT EXISTS idx_disputes_reason
    ON public.disputes(reason);
