-- ============================================================
-- Migration : Fix payout_status constraint for DEFERRED_CLEARANCE
-- Date       : 2026-07-22
-- Description: - Autorise 'DEFERRED_CLEARANCE' dans la colonne payout_status
-- ============================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.orders'::regclass 
        AND contype = 'c' 
        AND pg_get_constraintdef(oid) LIKE '%payout_status%'
    ) LOOP
        EXECUTE 'ALTER TABLE public.orders DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE public.orders
ADD CONSTRAINT orders_payout_status_check 
CHECK (payout_status IN ('PENDING', 'SUCCESS', 'FAILED', 'RETRYING', 'DEFERRED_CLEARANCE'));
