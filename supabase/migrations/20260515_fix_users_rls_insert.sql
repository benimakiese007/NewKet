-- =========================================================================
-- MIGRATION: FIX USERS RLS INSERT (SELF-PROFILE CREATION)
-- =========================================================================
-- Problem observed in prod:
--   new row violates row-level security policy for table "users"
-- This blocks first-time OAuth sign-in because the app upserts a profile row.
--
-- Fix:
--   Allow an authenticated user to INSERT/UPDATE their own row (id = auth.uid()).
--   Keep admin override via public.is_admin().
-- =========================================================================

BEGIN;

-- Ensure helper exists (no recursion; checks JWT claims only)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin',
    FALSE
  );
$$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

CREATE POLICY "Users can view their own profile" ON public.users
FOR SELECT
USING (id = auth.uid()::text OR public.is_admin());

CREATE POLICY "Users can insert their own profile" ON public.users
FOR INSERT
WITH CHECK (id = auth.uid()::text OR public.is_admin());

CREATE POLICY "Users can update their own profile" ON public.users
FOR UPDATE
USING (id = auth.uid()::text OR public.is_admin())
WITH CHECK (id = auth.uid()::text OR public.is_admin());

CREATE POLICY "Admins can delete users" ON public.users
FOR DELETE
USING (public.is_admin());

COMMIT;

