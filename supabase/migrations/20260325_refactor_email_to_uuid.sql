-- =========================================================================
-- MIGRATION: REFONTE DES CLES ETRANGERES (EMAIL -> UUID)
-- =========================================================================

-- Cette migration ajoute des colonnes user_id (UUID) aux tables existantes,
-- migre les données depuis les colonnes email, et met à jour les politiques RLS.

BEGIN;

-- 1. AJOUT DES COLONNES user_id
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS id UUID REFERENCES auth.users(id);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES auth.users(id);
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES auth.users(id);
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. MIGRATION DES DONNEES
-- On récupère les UUID depuis auth.users en se basant sur l'email

-- Users
UPDATE public.users u
SET id = au.id
FROM auth.users au
WHERE u.email = au.email;

-- Products
UPDATE public.products p
SET user_id = au.id
FROM auth.users au
WHERE p.supplier_email = au.email;

-- Orders
UPDATE public.orders o
SET customer_id = au.id
FROM auth.users au
WHERE o.customer_email = au.email;

-- Withdrawals
UPDATE public.withdrawals w
SET supplier_id = au.id
FROM auth.users au
WHERE w.supplier_email = au.email;

-- Activities
UPDATE public.activities a
SET user_id = au.id
FROM auth.users au
WHERE a.user_email = au.email;

-- Notifications
UPDATE public.notifications n
SET user_id = au.id
FROM auth.users au
WHERE n.user_email = au.email;

-- 3. MISE À JOUR DES POLITIQUES RLS
-- On remplace les vérifications basées sur l'email par auth.uid()

-- Suppression des anciennes politiques
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Suppliers can manage their own products" ON public.products;
DROP POLICY IF EXISTS "Customers can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Suppliers can view orders containing their products" ON public.orders;
DROP POLICY IF EXISTS "Suppliers can manage their own withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Users can view their own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;

-- Nouvelles politiques basées sur UUID
CREATE POLICY "Users can view their own profile" ON public.users
FOR SELECT USING (id = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Users can update their own profile" ON public.users
FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Suppliers can manage their own products" ON public.products
FOR ALL USING (user_id = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Customers can view their own orders" ON public.orders
FOR SELECT USING (customer_id = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Suppliers can view orders containing their products" ON public.orders
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(items) as item
    WHERE (item->>'supplier_id')::uuid = auth.uid()
  )
);

CREATE POLICY "Suppliers can manage their own withdrawals" ON public.withdrawals
FOR ALL USING (supplier_id = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Users can view their own activities" ON public.activities
FOR SELECT USING (user_id = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Users can view their own notifications" ON public.notifications
FOR SELECT USING (user_id = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

COMMIT;
