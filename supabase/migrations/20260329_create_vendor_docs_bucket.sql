-- NewKet Migration: Create vendor-docs bucket for KYC documents

-- 1. Create Storage Bucket (Private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-docs', 'vendor-docs', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies for vendor-docs
-- Allow Authenticated users to upload their KYC documents
CREATE POLICY "Authenticated Upload KYC" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'vendor-docs' AND auth.role() = 'authenticated');

-- Allow Owners to view their own documents
CREATE POLICY "Owner Access KYC" ON storage.objects FOR SELECT USING (bucket_id = 'vendor-docs' AND owner = auth.uid());

-- Allow Admins to access all documents (Checking role in users table)
CREATE POLICY "Admin Access KYC" ON storage.objects FOR SELECT USING (
  bucket_id = 'vendor-docs' AND 
  EXISTS (
    SELECT 1 FROM public.users WHERE email = auth.jwt() ->> 'email' AND role = 'admin'
  )
);
