-- =========================================================================
-- MIGRATION: Scale Hotpath Indexes (20260428)
-- =========================================================================
-- Objectif:
--   Ajouter des index sur les tables "hot path" (livraison, litige, paiement)
--   pour tenir la charge quand le trafic/volume augmente.
--
-- Notes importantes (prod-friendly):
--   - IF NOT EXISTS => idempotent (safe si rejoue).
--   - lock_timeout court => si la table est busy, la migration echoue vite
--     plutot que de bloquer l'app. Tu peux relancer plus tard (heures creuses).
--   - On n'utilise pas CREATE INDEX CONCURRENTLY ici car la plupart des runners
--     de migrations executent dans une transaction, ce que Postgres interdit
--     avec CONCURRENTLY.
-- =========================================================================

SET lock_timeout = '2s';
SET statement_timeout = '10min';

-- =========================================================================
-- TABLE: deliveries
-- =========================================================================
DO $$
BEGIN
  IF to_regclass('public.deliveries') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_deliveries_order_id   ON public.deliveries (order_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_deliveries_vendor_id  ON public.deliveries (vendor_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_deliveries_status     ON public.deliveries (status)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON public.deliveries (created_at DESC)';
  END IF;
END $$;

-- =========================================================================
-- TABLE: delivery_quotes
-- =========================================================================
DO $$
BEGIN
  IF to_regclass('public.delivery_quotes') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_delivery_quotes_order_id   ON public.delivery_quotes (order_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_delivery_quotes_vendor_id  ON public.delivery_quotes (vendor_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_delivery_quotes_status     ON public.delivery_quotes (status)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_delivery_quotes_created_at ON public.delivery_quotes (created_at DESC)';
  END IF;
END $$;

-- =========================================================================
-- TABLE: disputes
-- =========================================================================
DO $$
BEGIN
  IF to_regclass('public.disputes') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_disputes_order_id     ON public.disputes (order_id)';
    -- complainant_id supprimé (colonne inexistante dans ce schéma)
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_disputes_opened_by    ON public.disputes (opened_by)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_disputes_status       ON public.disputes (status)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_disputes_created_at   ON public.disputes (created_at DESC)';
  END IF;
END $$;

-- =========================================================================
-- TABLE: escrow_events (si existe)
-- =========================================================================
DO $$
BEGIN
  IF to_regclass('public.escrow_events') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_escrow_events_order_id   ON public.escrow_events (order_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_escrow_events_created_at ON public.escrow_events (created_at DESC)';
  END IF;
END $$;

-- =========================================================================
-- TABLE: payments (si existe / si tu l'utilises)
-- =========================================================================
DO $$
BEGIN
  IF to_regclass('public.payments') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_payments_order_id   ON public.payments (order_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_payments_status     ON public.payments (status)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments (created_at DESC)';
  END IF;
END $$;
