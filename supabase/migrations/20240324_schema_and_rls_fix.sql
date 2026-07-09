-- Security Overhaul & RLS Fixes (20240324)
-- This migration updates the schema to support RLS and implements policies for all roles.

-- 1. ADD MISSING COLUMNS
ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS supplier_email TEXT;
ALTER TABLE IF EXISTS public.activities ADD COLUMN IF NOT EXISTS user_email TEXT;
ALTER TABLE IF EXISTS public.notifications ADD COLUMN IF NOT EXISTS user_email TEXT;

-- 2. CREATE MISSING TABLE: withdrawals
CREATE TABLE IF NOT EXISTS public.withdrawals (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    supplier_email TEXT,
    amount NUMERIC NOT NULL,
    method TEXT,
    phone_number TEXT,
    status TEXT DEFAULT 'En attente'
);

-- 3. ENABLE RLS ON ALL TABLES
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

-- 4. DROP EXISTING POLICIES (TO AVOID CONFLICTS)
DO $$
BEGIN
    -- Users
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can do everything on users' AND tablename = 'users') THEN DROP POLICY "Admins can do everything on users" ON users; END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own profile' AND tablename = 'users') THEN DROP POLICY "Users can view their own profile" ON users; END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own profile' AND tablename = 'users') THEN DROP POLICY "Users can update their own profile" ON users; END IF;

    -- Products
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view products' AND tablename = 'products') THEN DROP POLICY "Anyone can view products" ON products; END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Suppliers can manage their own products' AND tablename = 'products') THEN DROP POLICY "Suppliers can manage their own products" ON products; END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage all products' AND tablename = 'products') THEN DROP POLICY "Admins can manage all products" ON products; END IF;

    -- Orders
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers can view their own orders' AND tablename = 'orders') THEN DROP POLICY "Customers can view their own orders" ON orders; END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Suppliers can view orders containing their products' AND tablename = 'orders') THEN DROP POLICY "Suppliers can view orders containing their products" ON orders; END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all orders' AND tablename = 'orders') THEN DROP POLICY "Admins can view all orders" ON orders; END IF;

    -- Withdrawals
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Suppliers can view their own withdrawals' AND tablename = 'withdrawals') THEN DROP POLICY "Suppliers can view their own withdrawals" ON withdrawals; END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage all withdrawals' AND tablename = 'withdrawals') THEN DROP POLICY "Admins can manage all withdrawals" ON withdrawals; END IF;
END $$;

-- 5. IMPLEMENT POLICIES

-- USERS
CREATE POLICY "Users can view their own profile" ON public.users
FOR SELECT USING (email = auth.jwt() ->> 'email' OR (auth.jwt() ->> 'email') IN (SELECT email FROM public.users WHERE role = 'admin'));

CREATE POLICY "Users can update their own profile" ON public.users
FOR UPDATE USING (email = auth.jwt() ->> 'email');

-- PRODUCTS
CREATE POLICY "Anyone can view products" ON public.products
FOR SELECT USING (true);

CREATE POLICY "Suppliers can manage their own products" ON public.products
FOR ALL USING (supplier_email = auth.jwt() ->> 'email' OR (auth.jwt() ->> 'email') IN (SELECT email FROM public.users WHERE role = 'admin'));

-- ORDERS
CREATE POLICY "Customers can view their own orders" ON public.orders
FOR SELECT USING (customer_email = auth.jwt() ->> 'email' OR (auth.jwt() ->> 'email') IN (SELECT email FROM public.users WHERE role = 'admin'));

CREATE POLICY "Suppliers can view orders containing their products" ON public.orders
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(items) as item
    WHERE item->>'supplier_email' = auth.jwt() ->> 'email'
  )
);

-- WITHDRAWALS
CREATE POLICY "Suppliers can manage their own withdrawals" ON public.withdrawals
FOR ALL USING (supplier_email = auth.jwt() ->> 'email' OR (auth.jwt() ->> 'email') IN (SELECT email FROM public.users WHERE role = 'admin'));

-- ACTIVITIES & NOTIFICATIONS
CREATE POLICY "Users can view their own activities" ON public.activities
FOR SELECT USING (user_email = auth.jwt() ->> 'email' OR (auth.jwt() ->> 'email') IN (SELECT email FROM public.users WHERE role = 'admin'));

CREATE POLICY "Users can view their own notifications" ON public.notifications
FOR SELECT USING (user_email = auth.jwt() ->> 'email' OR (auth.jwt() ->> 'email') IN (SELECT email FROM public.users WHERE role = 'admin'));

-- PROMOS
CREATE POLICY "Anyone can view promos" ON public.promos
FOR SELECT USING (true);

CREATE POLICY "Admins can manage promos" ON public.promos
FOR ALL USING ((auth.jwt() ->> 'email') IN (SELECT email FROM public.users WHERE role = 'admin'));

-- DEFAULT: FALLBACK FOR OTHERS
-- Deny by default is inherent to RLS being enabled without a matching policy.
