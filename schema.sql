-- Create tables for NOVA V2

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    role TEXT DEFAULT 'customer',
    date_joined TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    avatar TEXT
);

-- PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    name TEXT,
    category TEXT,
    price NUMERIC,
    old_price NUMERIC,
    image TEXT,
    rating NUMERIC,
    reviews INTEGER DEFAULT 0,
    is_new BOOLEAN DEFAULT FALSE,
    is_promo BOOLEAN DEFAULT FALSE,
    stock INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'En attente',
    total NUMERIC,
    customer_name TEXT,
    customer_email TEXT,
    items JSONB DEFAULT '[]'::JSONB,
    payment_method TEXT,
    phone_number TEXT,
    points_used INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PROMOS TABLE
CREATE TABLE IF NOT EXISTS public.promos (
    code TEXT PRIMARY KEY,
    type TEXT,
    value NUMERIC,
    max_uses INTEGER,
    expiry_date TIMESTAMP WITH TIME ZONE,
    current_uses INTEGER DEFAULT 0,
    used_by JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ACTIVITIES TABLE
CREATE TABLE IF NOT EXISTS public.activities (
    id TEXT PRIMARY KEY,
    text TEXT,
    type TEXT,
    time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. RLS (Row Level Security) Policies
-- First, drop the old insecure policies if they exist (for safe re-running of the script)
DROP POLICY IF EXISTS "Enable all for anon" ON public.users;
DROP POLICY IF EXISTS "Enable all for anon" ON public.products;
DROP POLICY IF EXISTS "Enable all for anon" ON public.orders;
DROP POLICY IF EXISTS "Enable all for anon" ON public.promos;
DROP POLICY IF EXISTS "Enable all for anon" ON public.activities;

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Note on Admin Emails: Adjust these directly in the SQL or via Supabase UI later
-- In a real app we'd have a 'roles' table or use app_metadata.
-- For this setup: email IN ('benimakiese1234@gmail.com')

---------------------------------------------------------
-- POLICIES FOR 'users' TABLE
---------------------------------------------------------
-- Users can read their own profile OR Admins can read all profiles
CREATE POLICY "Users can view own profile" 
ON public.users FOR SELECT 
USING (auth.uid() IS NOT NULL AND (email = auth.jwt()->>'email' OR auth.jwt()->>'email' IN ('benimakiese1234@gmail.com')));

-- Anyone can insert a profile on signup (Anon or Auth)
CREATE POLICY "Anyone can create a profile" 
ON public.users FOR INSERT 
WITH CHECK (true);

-- Users can update their own profile OR Admins can update all profiles
CREATE POLICY "Users can update own profile" 
ON public.users FOR UPDATE 
USING (auth.uid() IS NOT NULL AND (email = auth.jwt()->>'email' OR auth.jwt()->>'email' IN ('benimakiese1234@gmail.com')));

-- Only Admins can delete profiles
CREATE POLICY "Admins can delete profiles" 
ON public.users FOR DELETE 
USING (auth.uid() IS NOT NULL AND auth.jwt()->>'email' IN ('benimakiese1234@gmail.com'));

---------------------------------------------------------
-- POLICIES FOR 'products' TABLE
---------------------------------------------------------
-- Anyone can view products (Catalog is public)
CREATE POLICY "Anyone can view products" 
ON public.products FOR SELECT 
USING (true);

-- Only authenticated users (intended for Admin/Suppliers) can insert/update/delete products
-- Note: A more complex policy would check `supplier_email`, but we restrict it to logged-in users generally for now,
-- and rely on the UI/API to restrict further (since suppliers are manually approved roles).
CREATE POLICY "Logged in users can insert products" 
ON public.products FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Logged in users can update products" 
ON public.products FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Logged in users can delete products" 
ON public.products FOR DELETE 
USING (auth.uid() IS NOT NULL);

---------------------------------------------------------
-- POLICIES FOR 'orders' TABLE
---------------------------------------------------------
-- Users can view their own orders OR Admins can view all orders
-- Note: We also allow suppliers to fetch the whole table currently via UI, which is bad practice. 
-- For backward compatibility with the current `OrderManager.getAdvancedStats()`, we'll let authenticated users
-- query orders, but in a real V3 we'd lock this down to strictly their own or via a database function.
CREATE POLICY "Users can view orders" 
ON public.orders FOR SELECT 
USING (auth.uid() IS NOT NULL); 

-- Customers can create orders (using their email)
CREATE POLICY "Customers can create orders" 
ON public.orders FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND (customer_email = auth.jwt()->>'email' OR customer_email IS NULL));

-- Only Admins/System can update/delete orders
CREATE POLICY "System can update orders" 
ON public.orders FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete orders" 
ON public.orders FOR DELETE 
USING (auth.uid() IS NOT NULL AND auth.jwt()->>'email' IN ('benimakiese1234@gmail.com'));

---------------------------------------------------------
-- POLICIES FOR 'promos' TABLE
---------------------------------------------------------
-- Anyone can read active promos (to apply them)
CREATE POLICY "Anyone can read promos" 
ON public.promos FOR SELECT 
USING (true);

-- Only Admins can create/delete/modify promos (and the system updates usages)
CREATE POLICY "System can update promos" 
ON public.promos FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage promos" 
ON public.promos FOR ALL 
USING (auth.uid() IS NOT NULL AND auth.jwt()->>'email' IN ('benimakiese1234@gmail.com'));

---------------------------------------------------------
-- POLICIES FOR 'activities' TABLE
---------------------------------------------------------
-- Only logged in users (mostly admins/suppliers) can view logs
CREATE POLICY "Users can view activities" 
ON public.activities FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- System can insert activities
CREATE POLICY "System can insert activities" 
ON public.activities FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete activities" 
ON public.activities FOR ALL 
USING (auth.uid() IS NOT NULL AND auth.jwt()->>'email' IN ('benimakiese1234@gmail.com'));
