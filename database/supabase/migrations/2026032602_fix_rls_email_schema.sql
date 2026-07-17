-- =========================================================================
-- MIGRATION: FIX RLS INFINITE RECURSION (FOR EMAIL-BASED SCHEMA)
-- =========================================================================
-- PROBLEM: The database is still using the email-based schema (supplier_email,
-- customer_email, etc.), and the old policies queried public.users to check
-- admin status, creating an infinite loop (42P17).
--
-- FIX: We recreate the policies using the existing `*_email` columns and
-- the `is_admin()` function, which safely checks the JWT without recursion.
-- =========================================================================

BEGIN;

-- =========================================================================
-- STEP 1: Helper function (already created, but we ensure it exists)
-- =========================================================================
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

-- =========================================================================
-- STEP 2: Drop ALL conflicting policies to prevent errors
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

DROP POLICY IF EXISTS "Anyone can view products" ON public.products;
DROP POLICY IF EXISTS "Suppliers can manage their own products" ON public.products;
DROP POLICY IF EXISTS "Admins can manage all products" ON public.products;
DROP POLICY IF EXISTS "Customers can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Suppliers can view orders containing their products" ON public.orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Suppliers can manage their own withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Admins can manage all withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Users can view their own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can view promos" ON public.promos;
DROP POLICY IF EXISTS "Admins can manage promos" ON public.promos;

-- =========================================================================
-- STEP 3: Create safe policies matching the current EMAIL schema
-- =========================================================================

-- USERS
CREATE POLICY "Users can view their own profile" ON public.users FOR SELECT
USING (email = auth.jwt() ->> 'email' OR public.is_admin());

CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE
USING (email = auth.jwt() ->> 'email');

CREATE POLICY "Admins can insert users" ON public.users FOR INSERT
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete users" ON public.users FOR DELETE
USING (public.is_admin());

-- PRODUCTS (Uses supplier_email)
CREATE POLICY "Anyone can view products" ON public.products FOR SELECT
USING (true);

CREATE POLICY "Suppliers can manage their own products" ON public.products FOR ALL
USING (supplier_email = auth.jwt() ->> 'email' OR public.is_admin());

-- ORDERS (Uses customer_email and looks inside `items` JSON for supplier_email)
CREATE POLICY "Customers can view their own orders" ON public.orders FOR SELECT
USING (customer_email = auth.jwt() ->> 'email' OR public.is_admin());

CREATE POLICY "Customers can create orders" ON public.orders FOR INSERT
WITH CHECK (customer_email = auth.jwt() ->> 'email');

CREATE POLICY "Suppliers can view orders containing their products" ON public.orders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(items) as item
    WHERE item->>'supplier_email' = auth.jwt() ->> 'email'
  )
);

-- WITHDRAWALS (Uses supplier_email)
CREATE POLICY "Suppliers can manage their own withdrawals" ON public.withdrawals FOR ALL
USING (supplier_email = auth.jwt() ->> 'email' OR public.is_admin());

-- ACTIVITIES (Uses user_email)
CREATE POLICY "Users can view their own activities" ON public.activities FOR SELECT
USING (user_email = auth.jwt() ->> 'email' OR public.is_admin());

CREATE POLICY "Users can create activities" ON public.activities FOR INSERT
WITH CHECK (user_email = auth.jwt() ->> 'email');

-- NOTIFICATIONS (Uses user_email)
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT
USING (user_email = auth.jwt() ->> 'email' OR public.is_admin());

CREATE POLICY "Users can create notifications" ON public.notifications FOR INSERT
WITH CHECK (user_email = auth.jwt() ->> 'email');

-- PROMOS
CREATE POLICY "Anyone can view promos" ON public.promos FOR SELECT
USING (true);

CREATE POLICY "Admins can manage promos" ON public.promos FOR ALL
USING (public.is_admin());

COMMIT;
