-- NewKet Migration: add missing storage buckets and RLS policies for avatars and vendor covers
-- Goal: allow authenticated users to upload their own avatar/cover assets and expose public URLs.

-- 1. Ensure buckets exist and are public because the frontend uses getPublicUrl(...)
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-assets', 'user-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-covers', 'vendor-covers', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Clean up legacy policies if they already exist for these buckets
DROP POLICY IF EXISTS "Public Access User Assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload User Assets" ON storage.objects;
DROP POLICY IF EXISTS "Owner Management User Assets" ON storage.objects;

DROP POLICY IF EXISTS "Public Access Vendor Covers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Vendor Covers" ON storage.objects;
DROP POLICY IF EXISTS "Owner Management Vendor Covers" ON storage.objects;

-- 3. Public read access for assets served via public URLs
CREATE POLICY "Public Access User Assets"
ON storage.objects
FOR SELECT
USING (bucket_id = 'user-assets');

CREATE POLICY "Public Access Vendor Covers"
ON storage.objects
FOR SELECT
USING (bucket_id = 'vendor-covers');

-- 4. Authenticated users can upload into these buckets
CREATE POLICY "Authenticated Upload User Assets"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'user-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated Upload Vendor Covers"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'vendor-covers' AND auth.role() = 'authenticated');

-- 5. Object owners can update or delete their own files
CREATE POLICY "Owner Management User Assets"
ON storage.objects
FOR ALL
USING (bucket_id = 'user-assets' AND owner = auth.uid())
WITH CHECK (bucket_id = 'user-assets' AND owner = auth.uid());

CREATE POLICY "Owner Management Vendor Covers"
ON storage.objects
FOR ALL
USING (bucket_id = 'vendor-covers' AND owner = auth.uid())
WITH CHECK (bucket_id = 'vendor-covers' AND owner = auth.uid());
