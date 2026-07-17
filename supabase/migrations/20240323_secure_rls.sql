-- Security Migration for NewKet V2 (Updated with correct column names)
-- This script enables Row Level Security (RLS) on all relevant tables
-- You must execute this in your Supabase SQL Editor.

-- Enable RLS on all known tables
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.withdrawals ENABLE ROW LEVEL SECURITY;

-- 1. USERS Table Policies
-- Les utilisateurs peuvent lire/modifier uniquement leur propre profil (id = UUID)
CREATE POLICY "Users can view own profile" ON public.users 
    FOR SELECT USING (auth.uid()::text = id OR auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can update own profile" ON public.users 
    FOR UPDATE USING (auth.uid()::text = id OR auth.jwt() ->> 'email' = email);

-- 2. PRODUCTS Table Policies
-- Tout le monde peut voir les produits.
CREATE POLICY "Public products are viewable by everyone" ON public.products 
    FOR SELECT USING (true);

-- Seul le fournisseur correspondant à l'email peut modifier.
CREATE POLICY "Suppliers can insert their own products" ON public.products 
    FOR INSERT WITH CHECK (auth.jwt() ->> 'email' = supplier_email);

CREATE POLICY "Suppliers can update their own products" ON public.products 
    FOR UPDATE USING (auth.jwt() ->> 'email' = supplier_email);

CREATE POLICY "Suppliers can delete their own products" ON public.products 
    FOR DELETE USING (auth.jwt() ->> 'email' = supplier_email);

-- 3. ORDERS Table Policies
-- Les clients ne voient que leurs propres commandes (par email).
CREATE POLICY "Customers can view their own orders" ON public.orders 
    FOR SELECT USING (auth.jwt() ->> 'email' = customer_email);

-- Les clients ne peuvent créer une commande que pour eux-mêmes.
CREATE POLICY "Customers can create orders for themselves" ON public.orders
    FOR INSERT WITH CHECK (auth.jwt() ->> 'email' = customer_email);

-- 4. WITHDRAWALS (Retraits)
CREATE POLICY "Suppliers can view their own withdrawals" ON public.withdrawals 
    FOR SELECT USING (auth.jwt() ->> 'email' = supplier_email);

CREATE POLICY "Suppliers can request their own withdrawals" ON public.withdrawals 
    FOR INSERT WITH CHECK (auth.jwt() ->> 'email' = supplier_email);

-- 5. ACCESS ADMIN (via metadata ou liste spécifique)
-- Note: les admins héritent souvent de tout via bypass RLS sur Supabase dashboard, 
-- mais voici comment l'ajouter explicitement si besoin:
-- CREATE POLICY "Admins have full access" ON public.products USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');
