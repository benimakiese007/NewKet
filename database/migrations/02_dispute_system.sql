-- ============================================================
-- Migration: Système de Litige NewKet
-- Date   : 2026-07-04
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Colonne garantie acheteur sur les produits
-- ─────────────────────────────────────────────────────────────
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS escrow_timer_hours INTEGER NOT NULL DEFAULT 24
        CHECK (escrow_timer_hours IN (24, 48, 72, 168));

COMMENT ON COLUMN products.escrow_timer_hours IS
    'Durée (heures) de garantie acheteur définie par le vendeur lors de la publication. Valeurs autorisées : 24, 48, 72, 168.';

-- ─────────────────────────────────────────────────────────────
-- 2. Table disputes
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS disputes (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id                TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    opened_by               TEXT NOT NULL REFERENCES users(id),
    customer_id             TEXT REFERENCES users(id),
    vendor_id               TEXT REFERENCES users(id),

    reason                  TEXT NOT NULL CHECK (reason IN ('NOT_RECEIVED','DAMAGED','NOT_AS_DESCRIBED','OTHER')),
    reason_category         TEXT,
    description             TEXT NOT NULL,

    evidence                JSONB DEFAULT '[]',
    proof_urls              TEXT[],
    seller_evidence         JSONB DEFAULT '[]',

    status                  TEXT NOT NULL DEFAULT 'OPEN'
                                CHECK (status IN ('OPEN','SELLER_PENDING','BUYER_PENDING','UNDER_REVIEW','RESOLVED','REJECTED')),
    resolution              TEXT CHECK (resolution IN ('FULL_REFUND','PARTIAL_REFUND','RELEASE_TO_SELLER')),
    resolution_decision     TEXT,
    refund_amount           NUMERIC(12, 2) DEFAULT 0,
    proposed_resolution     TEXT,
    proposed_amount         NUMERIC(12, 2) DEFAULT 0,

    escrow_frozen_at        TIMESTAMPTZ,
    seller_response_due_at  TIMESTAMPTZ,
    buyer_response_due_at   TIMESTAMPTZ,
    review_due_at           TIMESTAMPTZ,
    expires_at              TIMESTAMPTZ,
    resolved_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    order_status_snapshot   TEXT,
    last_actor_role         TEXT CHECK (last_actor_role IN ('BUYER','SELLER','ADMIN','SYSTEM'))
);

CREATE INDEX IF NOT EXISTS disputes_order_id_idx     ON disputes (order_id);
CREATE INDEX IF NOT EXISTS disputes_customer_id_idx  ON disputes (customer_id);
CREATE INDEX IF NOT EXISTS disputes_vendor_id_idx    ON disputes (vendor_id);
CREATE INDEX IF NOT EXISTS disputes_status_idx       ON disputes (status);

-- ─────────────────────────────────────────────────────────────
-- 3. Table dispute_messages
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dispute_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id  UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
    sender_id   TEXT REFERENCES users(id),
    type        TEXT NOT NULL CHECK (type IN ('MESSAGE','OFFER','EVIDENCE','SYSTEM')),
    payload     JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dispute_messages_dispute_id_idx ON dispute_messages (dispute_id);

-- ─────────────────────────────────────────────────────────────
-- 4. Bucket Supabase Storage — dispute-evidence
-- ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'dispute-evidence',
    'dispute-evidence',
    false,
    5242880,
    ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY IF NOT EXISTS "dispute_evidence_upload"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'dispute-evidence');

CREATE POLICY IF NOT EXISTS "dispute_evidence_read"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'dispute-evidence');

-- ─────────────────────────────────────────────────────────────
-- 5. RLS disputes & dispute_messages
-- ─────────────────────────────────────────────────────────────
ALTER TABLE disputes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "disputes_participant_read"
    ON disputes FOR SELECT TO authenticated
    USING (
        customer_id = auth.uid()::text OR vendor_id = auth.uid()::text OR opened_by = auth.uid()::text
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'admin')
    );

CREATE POLICY "disputes_customer_insert"
    ON disputes FOR INSERT TO authenticated
    WITH CHECK (opened_by = auth.uid()::text);

CREATE POLICY "disputes_service_update"
    ON disputes FOR UPDATE TO service_role USING (true);

CREATE POLICY "dispute_messages_read"
    ON dispute_messages FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM disputes d WHERE d.id = dispute_id
            AND (d.customer_id = auth.uid()::text OR d.vendor_id = auth.uid()::text
                 OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'admin'))
        )
    );

CREATE POLICY "dispute_messages_service_insert"
    ON dispute_messages FOR INSERT TO service_role WITH CHECK (true);
