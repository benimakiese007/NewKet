-- =========================================================================
-- MIGRATION: FIX USERS RLS INSERT (CAST-SAFE)
-- =========================================================================
-- Previous attempt failed with:
--   operator does not exist: text = uuid
-- Meaning: public.users.id is TEXT in this database, while auth.uid() is UUID.
-- We compare as TEXT to avoid type errors and allow self-profile creation.
-- =========================================================================

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
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin',
    FALSE
  );
$$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop prior variants
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- Cast auth.uid() (uuid) to text for compatibility with legacy text-based schema.
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

