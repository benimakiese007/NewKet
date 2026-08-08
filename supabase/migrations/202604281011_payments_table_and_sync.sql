-- ============================================================================
-- MIGRATION: Payments table (2026-04-28) — ADAPTEE (table orders supprimée)
-- La table public.orders a été supprimée dans la migration 20260401.
-- On crée la table payments sans FK vers orders, et sans trigger.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT, -- ancienne référence, conservée sans contrainte FK
    customer_id TEXT,
    vendor_id TEXT,
    transaction_ref TEXT,
    amount NUMERIC(12,2),
    currency TEXT NOT NULL DEFAULT 'XAF',
    provider TEXT,
    provider_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'PENDING',
    escrow_status TEXT NOT NULL DEFAULT 'NONE',
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    succeeded_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    blocked_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_ref ON public.payments(transaction_ref);

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_status_check CHECK (status IN (
    'PENDING','SUCCESS','FAILED','COMPLETED','BLOCKED','REFUNDED','PARTIAL_REFUND'
));

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_escrow_status_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_escrow_status_check CHECK (escrow_status IN (
    'NONE','HELD','RELEASED','AUTO_RELEASED','FROZEN','REFUNDED'
));

-- RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Vendors can view own payments" ON public.payments;
CREATE POLICY "Vendors can view own payments" ON public.payments
    FOR SELECT USING ((vendor_id::text) = (auth.uid()::text) OR public.is_admin());
