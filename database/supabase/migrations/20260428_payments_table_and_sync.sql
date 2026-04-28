-- ============================================================================
-- MIGRATION: Payments table (align with "Arborescence Paiement") (2026-04-28)
-- - Materialize payment lifecycle per order
-- - Keep it synced from orders state/escrow state
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    vendor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
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

ALTER TABLE public.payments
    DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments
    ADD CONSTRAINT payments_status_check CHECK (status IN (
        'PENDING',
        'SUCCESS',
        'FAILED',
        'COMPLETED',
        'BLOCKED',
        'REFUNDED',
        'PARTIAL_REFUND'
    ));

ALTER TABLE public.payments
    DROP CONSTRAINT IF EXISTS payments_escrow_status_check;
ALTER TABLE public.payments
    ADD CONSTRAINT payments_escrow_status_check CHECK (escrow_status IN (
        'NONE',
        'HELD',
        'RELEASED',
        'AUTO_RELEASED',
        'FROZEN',
        'REFUNDED'
    ));

-- Sync logic: orders is the source of truth for transaction_ref, status, escrow.
CREATE OR REPLACE FUNCTION public.sync_payment_from_order(p_order_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_order RECORD;
    v_payment_status TEXT;
    v_escrow_status TEXT;
    v_status TEXT;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    SELECT
        o.id,
        o.customer_id,
        o.vendor_id,
        o.transaction_id,
        o.payment_status,
        o.total_amount,
        o.escrow_status,
        o.failure_reason
    INTO v_order
    FROM public.orders o
    WHERE o.id = p_order_id;

    IF v_order.id IS NULL THEN
        RETURN;
    END IF;

    v_payment_status := COALESCE(v_order.payment_status, 'PENDING');
    v_escrow_status := COALESCE(v_order.escrow_status, 'NONE');

    -- Map to the arborescence statuses.
    v_status := CASE
        WHEN v_escrow_status IN ('RELEASED', 'AUTO_RELEASED') THEN 'COMPLETED'
        WHEN v_escrow_status = 'FROZEN' THEN 'BLOCKED'
        WHEN v_escrow_status = 'REFUNDED' THEN 'REFUNDED'
        WHEN v_payment_status IN ('FAILED') THEN 'FAILED'
        WHEN v_payment_status IN ('PAID', 'SUCCESS') THEN 'SUCCESS'
        ELSE 'PENDING'
    END;

    INSERT INTO public.payments (
        order_id,
        customer_id,
        vendor_id,
        transaction_ref,
        amount,
        status,
        escrow_status,
        failure_reason,
        created_at,
        updated_at,
        succeeded_at,
        failed_at,
        completed_at,
        blocked_at,
        refunded_at
    )
    VALUES (
        v_order.id,
        v_order.customer_id,
        v_order.vendor_id,
        v_order.transaction_id,
        v_order.total_amount,
        v_status,
        v_escrow_status,
        v_order.failure_reason,
        v_now,
        v_now,
        CASE WHEN v_status = 'SUCCESS' THEN v_now ELSE NULL END,
        CASE WHEN v_status = 'FAILED' THEN v_now ELSE NULL END,
        CASE WHEN v_status = 'COMPLETED' THEN v_now ELSE NULL END,
        CASE WHEN v_status = 'BLOCKED' THEN v_now ELSE NULL END,
        CASE WHEN v_status = 'REFUNDED' THEN v_now ELSE NULL END
    )
    ON CONFLICT (order_id)
    DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        vendor_id = EXCLUDED.vendor_id,
        transaction_ref = EXCLUDED.transaction_ref,
        amount = EXCLUDED.amount,
        status = EXCLUDED.status,
        escrow_status = EXCLUDED.escrow_status,
        failure_reason = EXCLUDED.failure_reason,
        updated_at = v_now,
        succeeded_at = COALESCE(public.payments.succeeded_at, EXCLUDED.succeeded_at),
        failed_at = COALESCE(public.payments.failed_at, EXCLUDED.failed_at),
        completed_at = COALESCE(public.payments.completed_at, EXCLUDED.completed_at),
        blocked_at = COALESCE(public.payments.blocked_at, EXCLUDED.blocked_at),
        refunded_at = COALESCE(public.payments.refunded_at, EXCLUDED.refunded_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_payment_from_orders()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM public.sync_payment_from_order(NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_payment_from_orders ON public.orders;
CREATE TRIGGER trg_sync_payment_from_orders
AFTER INSERT OR UPDATE OF
    customer_id,
    vendor_id,
    transaction_id,
    payment_status,
    total_amount,
    escrow_status,
    failure_reason
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_payment_from_orders();

-- Backfill existing orders into payments.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.orders LOOP
        PERFORM public.sync_payment_from_order(r.id);
    END LOOP;
END $$;

