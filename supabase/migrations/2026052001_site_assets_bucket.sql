-- Migration: Public site-assets bucket (branding assets) (20260520_site_assets_bucket.sql)

-- 1) Create Storage Bucket (Public: icons are fetched by all visitors)
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-assets', 'site-assets', true)
ON CONFLICT (id) DO NOTHING;

-- 2) Storage policies
-- Public read for site assets
CREATE POLICY "Public Read Site Assets" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'site-assets');

-- Admin-only write
CREATE POLICY "Admin Insert Site Assets" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'site-assets'
    AND EXISTS (
      SELECT 1 FROM public.users WHERE email = auth.jwt() ->> 'email' AND role = 'admin'
    )
  );

CREATE POLICY "Admin Update Site Assets" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'site-assets'
    AND EXISTS (
      SELECT 1 FROM public.users WHERE email = auth.jwt() ->> 'email' AND role = 'admin'
    )
  );

CREATE POLICY "Admin Delete Site Assets" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'site-assets'
    AND EXISTS (
      SELECT 1 FROM public.users WHERE email = auth.jwt() ->> 'email' AND role = 'admin'
    )
  );

