-- ============================================================================
-- MIGRATION: Fix recursive users RLS policies
-- ============================================================================
-- This migration removes any remaining recursive policies on public.users and
-- recreates them with a safe admin helper that only reads trusted JWT claims.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    FALSE
  );
$$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users can view their own profile"
ON public.users
FOR SELECT
USING (id::text = auth.uid()::text OR public.is_admin());

CREATE POLICY "Users can insert their own profile"
ON public.users
FOR INSERT
WITH CHECK (id::text = auth.uid()::text OR public.is_admin());

CREATE POLICY "Users can update their own profile"
ON public.users
FOR UPDATE
USING (id::text = auth.uid()::text OR public.is_admin())
WITH CHECK (id::text = auth.uid()::text OR public.is_admin());

CREATE POLICY "Admins can delete users"
ON public.users
FOR DELETE
USING (public.is_admin());

COMMIT;
