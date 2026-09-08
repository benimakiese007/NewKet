-- ============================================================
-- PATCH: Fix dispute CHECK constraints
-- Date: 2026-09-08
-- Ajoute AWAITING_RETURN dans status et REFUND_WITH_RETURN dans resolution
-- ============================================================

-- 1. Fix disputes.status -> ajouter AWAITING_RETURN
ALTER TABLE disputes DROP CONSTRAINT IF EXISTS disputes_status_check;
ALTER TABLE disputes ADD CONSTRAINT disputes_status_check
    CHECK (status = ANY (ARRAY[
        'OPEN',
        'SELLER_PENDING',
        'BUYER_PENDING',
        'UNDER_REVIEW',
        'AWAITING_RETURN',
        'RESOLVED',
        'REJECTED'
    ]));

-- 2. Fix disputes.resolution -> ajouter REFUND_WITH_RETURN
ALTER TABLE disputes DROP CONSTRAINT IF EXISTS disputes_resolution_check;
ALTER TABLE disputes ADD CONSTRAINT disputes_resolution_check
    CHECK ((resolution IS NULL) OR (resolution = ANY (ARRAY[
        'FULL_REFUND',
        'PARTIAL_REFUND',
        'RELEASE_TO_SELLER',
        'REFUND_WITH_RETURN'
    ])));

-- 3. Fix disputes.proposed_resolution -> ajouter REFUND_WITH_RETURN
ALTER TABLE disputes DROP CONSTRAINT IF EXISTS disputes_proposed_resolution_check;
ALTER TABLE disputes ADD CONSTRAINT disputes_proposed_resolution_check
    CHECK ((proposed_resolution IS NULL) OR (proposed_resolution = ANY (ARRAY[
        'FULL_REFUND',
        'PARTIAL_REFUND',
        'RELEASE_TO_SELLER',
        'REFUND_WITH_RETURN'
    ])));
