-- ============================================================================
-- MIGRATION: Payment integrity, webhook idempotency, ledger foundations (2026-04-28)
-- ADAPTÉE : Suppression des references à public.orders (table supprimée en 20260401)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- orders table supprimée, on ignore les ALTER TABLE orders

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    event_type TEXT NOT NULL,
    provider_event_id TEXT NOT NULL,
    tx_ref TEXT,
    order_id TEXT, -- ancienne référence sans FK
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
    order_id TEXT, -- ancienne référence sans FK
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_ledger_entries_order_type
    ON public.financial_ledger_entries(order_id, entry_type);
