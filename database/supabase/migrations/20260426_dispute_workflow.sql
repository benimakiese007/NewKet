-- ============================================================================
-- MIGRATION: NewKet dispute workflow
-- Date: 2026-04-26
-- ============================================================================

ALTER TABLE public.disputes
    ADD COLUMN IF NOT EXISTS opened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reason TEXT,
    ADD COLUMN IF NOT EXISTS evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS proposed_resolution TEXT,
    ADD COLUMN IF NOT EXISTS proposed_amount NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS seller_response_due_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS buyer_response_due_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS review_due_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_actor_role TEXT,
    ADD COLUMN IF NOT EXISTS seller_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS resolution TEXT,
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.disputes
SET
    opened_by = COALESCE(opened_by, customer_id),
    reason = COALESCE(reason, reason_category),
    evidence = CASE
        WHEN jsonb_array_length(COALESCE(evidence, '[]'::jsonb)) > 0 THEN evidence
        WHEN proof_urls IS NOT NULL THEN (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'url', proof_url,
                'kind', CASE WHEN proof_url ~* '\.(mp4|mov|avi|webm)$' THEN 'video' ELSE 'photo' END,
                'source', 'client'
            )), '[]'::jsonb)
            FROM unnest(proof_urls) AS proof_url
        )
        ELSE '[]'::jsonb
    END,
    last_actor_role = COALESCE(last_actor_role, 'BUYER'),
    updated_at = COALESCE(updated_at, created_at, NOW());

ALTER TABLE public.disputes
    DROP CONSTRAINT IF EXISTS disputes_status_check;

ALTER TABLE public.disputes
    ADD CONSTRAINT disputes_status_check CHECK (status IN (
        'OPEN',
        'SELLER_PENDING',
        'BUYER_PENDING',
        'UNDER_REVIEW',
        'RESOLVED',
        'REJECTED'
    ));

ALTER TABLE public.disputes
    DROP CONSTRAINT IF EXISTS disputes_resolution_check;

ALTER TABLE public.disputes
    ADD CONSTRAINT disputes_resolution_check CHECK (
        resolution IS NULL OR resolution IN ('FULL_REFUND', 'PARTIAL_REFUND', 'RELEASE_TO_SELLER')
    );

ALTER TABLE public.disputes
    DROP CONSTRAINT IF EXISTS disputes_proposed_resolution_check;

ALTER TABLE public.disputes
    ADD CONSTRAINT disputes_proposed_resolution_check CHECK (
        proposed_resolution IS NULL OR proposed_resolution IN ('FULL_REFUND', 'PARTIAL_REFUND', 'RELEASE_TO_SELLER')
    );

ALTER TABLE public.disputes
    DROP CONSTRAINT IF EXISTS disputes_reason_check;

ALTER TABLE public.disputes
    ADD CONSTRAINT disputes_reason_check CHECK (
        reason IS NULL OR reason IN ('NOT_RECEIVED', 'DAMAGED', 'NOT_AS_DESCRIBED', 'OTHER')
    );

ALTER TABLE public.disputes
    DROP CONSTRAINT IF EXISTS disputes_last_actor_role_check;

ALTER TABLE public.disputes
    ADD CONSTRAINT disputes_last_actor_role_check CHECK (
        last_actor_role IS NULL OR last_actor_role IN ('BUYER', 'SELLER', 'ADMIN', 'SYSTEM')
    );

CREATE INDEX IF NOT EXISTS idx_disputes_order_status ON public.disputes(order_id, status);
CREATE INDEX IF NOT EXISTS idx_disputes_seller_due ON public.disputes(seller_response_due_at);
CREATE INDEX IF NOT EXISTS idx_disputes_buyer_due ON public.disputes(buyer_response_due_at);
CREATE INDEX IF NOT EXISTS idx_disputes_review_due ON public.disputes(review_due_at);

ALTER TABLE public.dispute_messages
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'MESSAGE',
    ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.dispute_messages
SET
    type = COALESCE(type, 'MESSAGE'),
    payload = CASE
        WHEN payload IS NULL OR payload = '{}'::jsonb THEN jsonb_build_object('message', message)
        ELSE payload
    END;

ALTER TABLE public.dispute_messages
    DROP CONSTRAINT IF EXISTS dispute_messages_type_check;

ALTER TABLE public.dispute_messages
    ADD CONSTRAINT dispute_messages_type_check CHECK (type IN ('MESSAGE', 'OFFER', 'EVIDENCE', 'SYSTEM'));

ALTER TABLE public.escrow_events
    DROP CONSTRAINT IF EXISTS escrow_events_event_type_check;

ALTER TABLE public.escrow_events
    ADD CONSTRAINT escrow_events_event_type_check CHECK (
        event_type IN ('HELD', 'TIMER_STARTED', 'RELEASED', 'AUTO_RELEASED', 'FROZEN', 'REFUNDED', 'PARTIAL', 'MANUAL_OVERRIDE')
    );
