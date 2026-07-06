-- ============================================================================
-- MIGRATION: Payment integrity, webhook idempotency, ledger foundations (2026-04-28)
-- - Add server-side expected amount/currency fields on orders (source of truth)
-- - Add order payment locking fields (prevent edits during payment)
-- - Persist webhook deliveries for idempotency + audit
-- - Add minimal financial ledger table (traceability)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    ALTER TABLE public.orders
        ADD COLUMN IF NOT EXISTS payment_provider TEXT,
        ADD COLUMN IF NOT EXISTS payment_provider_tx_id TEXT,
        ADD COLUMN IF NOT EXISTS payment_expected_amount NUMERIC(12,2),
        ADD COLUMN IF NOT EXISTS payment_expected_currency TEXT,
        ADD COLUMN IF NOT EXISTS payment_locked_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS payment_lock_reason TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_payment_provider_tx_id ON public.orders(payment_provider_tx_id);

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    event_type TEXT NOT NULL,
    provider_event_id TEXT NOT NULL,
    tx_ref TEXT,
    order_id TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    signature_valid BOOLEAN,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    process_status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (process_status IN ('RECEIVED', 'IGNORED', 'PROCESSED', 'FAILED', 'PROCESSING_FAILED')),
    process_error TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_webhook_events_provider_event
    ON public.payment_webhook_events(provider, provider_event_id);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_tx_ref
    ON public.payment_webhook_events(tx_ref);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_order_id
    ON public.payment_webhook_events(order_id);

CREATE TABLE IF NOT EXISTS public.financial_ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN (
        'CUSTOMER_CHARGE',
        'PLATFORM_COMMISSION',
        'VENDOR_PAYOUT',
        'REFUND'
    )),
    amount NUMERIC(12,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'XAF',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency at ledger-level for core entries.
CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_ledger_entries_order_type
    ON public.financial_ledger_entries(order_id, entry_type);

