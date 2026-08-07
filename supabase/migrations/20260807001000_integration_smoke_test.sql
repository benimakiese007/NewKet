-- ============================================================================
-- MIGRATION: Integration smoke test (no-op)
-- Date: 2026-08-07
-- Purpose: Verify GitHub -> Supabase deployment without changing application data
-- ============================================================================

BEGIN;

DO $$
BEGIN
  RAISE NOTICE 'NewKet Supabase integration smoke test migration executed.';
END
$$;

COMMIT;
