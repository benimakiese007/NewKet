-- NewKet Migration: Make Storage Public and Fix RLS for Products
-- Goal: Ensure images are visible to everyone and products are accessible in the catalog.

-- 1. Ensure Storage Bucket is Public
DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('product-images', 'product-images', true)
    ON CONFLICT (id) DO UPDATE SET public = true;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Bucket product-images might already exist or permission denied. Ensuring public access via update.';
        UPDATE storage.buckets SET public = true WHERE id = 'product-images';
END $$;

-- 2. Storage Policies for product-images
-- Delete existing to avoid conflicts
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Owner Management" ON storage.objects;

-- Allow Anyone to view images (Fix for Issue 4: Invisible products)
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');

-- Allow Authenticated users (Suppliers) to upload
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');

-- Allow Owners to manage their images
CREATE POLICY "Owner Management" ON storage.objects FOR ALL USING (bucket_id = 'product-images' AND owner = auth.uid());

-- 3. Fix Product RLS (Issue 5: Catalog not filling)
-- Ensure 'select' is allowed for everyone even if they are not the supplier
DROP POLICY IF EXISTS "Anyone can view products" ON public.products;
CREATE POLICY "Anyone can view products" ON public.products FOR SELECT USING (true);

-- Ensure suppliers can manage their own
DROP POLICY IF EXISTS "Suppliers can manage their own products" ON public.products;
CREATE POLICY "Suppliers can manage their own products" ON public.products
FOR ALL USING (supplier_email = auth.jwt() ->> 'email' OR (SELECT role FROM public.users WHERE email = auth.jwt() ->> 'email') = 'admin');

-- 4. Fix User Status (KYC) Reliability
-- Ensure users can read their own row to check their status
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (email = auth.jwt() ->> 'email' OR role = 'admin');
