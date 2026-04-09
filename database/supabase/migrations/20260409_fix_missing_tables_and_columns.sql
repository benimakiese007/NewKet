-- =========================================================================
-- MIGRATION: Fix Missing Tables & Columns (20260409)
-- =========================================================================
-- PROBLEM 1: Table `user_favorites` does not exist in production
--   → Error: "Could not find the table 'public.favorites' in the schema cache"
--   → The favorite.controller.js queries `user_favorites` table
--
-- PROBLEM 2: Column `notifications.user_id` does not exist
--   → Error: "column notifications.user_id does not exist"
--   → RLS policies reference user_id but it was never added
-- =========================================================================

BEGIN;

-- =========================================================================
-- FIX 1: Create user_favorites table if it doesn't exist
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.user_favorites (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    favorites_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

-- Drop old policies if any
DROP POLICY IF EXISTS "Users can manage their own favorites" ON public.user_favorites;
DROP POLICY IF EXISTS "Users can read own favorites" ON public.user_favorites;
DROP POLICY IF EXISTS "Users can write own favorites" ON public.user_favorites;

-- Create RLS policies
CREATE POLICY "Users can read own favorites"
ON public.user_favorites FOR SELECT
USING (user_id::text = auth.uid()::text OR public.is_admin());

CREATE POLICY "Users can write own favorites"
ON public.user_favorites FOR ALL
USING (user_id::text = auth.uid()::text OR public.is_admin());

-- =========================================================================
-- FIX 2: Add user_id column to notifications if it doesn't exist
-- =========================================================================
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Try to populate user_id from existing user_email matches
-- (Best effort, won't fail if auth.users doesn't have matching emails)
UPDATE public.notifications n
SET user_id = u.id
FROM auth.users u
WHERE n.user_id IS NULL
  AND n.user_email IS NOT NULL
  AND u.email = n.user_email;

-- =========================================================================
-- FIX 3: Ensure notifications RLS policies use the right column
-- =========================================================================
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can manage notifications" ON public.notifications;

-- Users can see their notifications (by user_id if set, fallback to email)
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (
    user_id::text = auth.uid()::text
    OR user_email = auth.jwt() ->> 'email'
    OR public.is_admin()
);

-- Users can create notifications for themselves
CREATE POLICY "Users can create notifications"
ON public.notifications FOR INSERT
WITH CHECK (
    user_id::text = auth.uid()::text
    OR user_email = auth.jwt() ->> 'email'
    OR public.is_admin()
);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (
    user_id::text = auth.uid()::text
    OR user_email = auth.jwt() ->> 'email'
    OR public.is_admin()
);

COMMIT;
