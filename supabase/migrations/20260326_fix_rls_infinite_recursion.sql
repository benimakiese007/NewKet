-- =========================================================================
-- MIGRATION: FIX RLS INFINITE RECURSION (42P17)
-- =========================================================================
-- PROBLEM: Policies on public.users were querying public.users to check the
-- admin role, causing PostgreSQL infinite recursion (error 42P17).
--
-- FIX STRATEGY:
-- 1. Create a SECURITY DEFINER function `is_admin()` that bypasses RLS
--    to safely read the current user's role from JWT metadata.
-- 2. Replace all recursive policies with safe equivalents.
-- =========================================================================

BEGIN;

-- =========================================================================
-- STEP 1: Helper function (SECURITY DEFINER = bypasses RLS)
-- =========================================================================
-- Helper function to check if current user is admin (safe, no recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- First check JWT app_metadata (fastest, set by set_admin_role.sql)
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    -- Fallback: check raw_user_meta_data
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin',
    FALSE
  );
$$;

-- =========================================================================
-- STEP 2: Drop ALL existing policies on users table (clean slate)
-- =========================================================================
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
  END LOOP;
END $$;

-- Drop conflicting policies on other tables that also had recursion
DROP POLICY IF EXISTS "Suppliers can manage their own products" ON public.products;
DROP POLICY IF EXISTS "Customers can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Suppliers can manage their own withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Admins can manage all withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Users can view their own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can manage promos" ON public.promos;

-- =========================================================================
-- STEP 3: Create safe, non-recursive policies on USERS table
-- Use auth.jwt() for admin check — NEVER query public.users here
-- =========================================================================

-- Users can read their own row
CREATE POLICY "Users can view their own profile"
ON public.users FOR SELECT
USING (
  id::text = auth.uid()::text
  OR public.is_admin()
);

-- Users can update their own row
CREATE POLICY "Users can update their own profile"
ON public.users FOR UPDATE
USING (id::text = auth.uid()::text);

-- Admins can insert users (e.g., manual user creation)
CREATE POLICY "Admins can insert users"
ON public.users FOR INSERT
WITH CHECK (public.is_admin());

-- Admins can delete users
CREATE POLICY "Admins can delete users"
ON public.users FOR DELETE
USING (public.is_admin());

-- =========================================================================
-- STEP 4: Fix policies on other tables using is_admin()
-- =========================================================================

-- PRODUCTS: Suppliers manage their own; admins manage all
CREATE POLICY "Suppliers can manage their own products"
ON public.products FOR ALL
USING (
  user_id::text = auth.uid()::text
  OR public.is_admin()
);

-- ORDERS: Customers see their own; admins see all
CREATE POLICY "Customers can view their own orders"
ON public.orders FOR SELECT
USING (
  customer_id::text = auth.uid()::text
  OR public.is_admin()
);

-- WITHDRAWALS: Suppliers see their own; admins see all
CREATE POLICY "Suppliers can manage their own withdrawals"
ON public.withdrawals FOR ALL
USING (
  supplier_id::text = auth.uid()::text
  OR public.is_admin()
);

-- ACTIVITIES: Users see their own; admins see all
CREATE POLICY "Users can view their own activities"
ON public.activities FOR SELECT
USING (
  user_id::text = auth.uid()::text
  OR public.is_admin()
);

-- NOTIFICATIONS: Users see their own; admins see all
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (
  user_id::text = auth.uid()::text
  OR public.is_admin()
);

-- PROMOS: Admins manage promos
CREATE POLICY "Admins can manage promos"
ON public.promos FOR ALL
USING (public.is_admin());

COMMIT;
