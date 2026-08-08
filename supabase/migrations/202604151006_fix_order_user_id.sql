-- =========================================================================
-- MIGRATION: Add user_id to orders table (20260415)
-- =========================================================================

BEGIN;

-- Add user_id column if it doesn't exist
-- ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Add index for performance in dashboards
-- CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);

-- Note: We don't make it NOT NULL because some old WhatsApp leads might not have accounts.
-- But for new payments, we will enforce it via application logic.

COMMIT;
