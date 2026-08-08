-- Migration: Add missing settings table (20260327_add_settings_table.sql)

-- Create settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY
);

ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS shop_name TEXT DEFAULT 'NewKet EMarket';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS contact_email TEXT DEFAULT 'contact@newket.com';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS support_phone TEXT DEFAULT '+243 000 000 000';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC DEFAULT 2800;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS currency_symbol TEXT DEFAULT 'CDF';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC DEFAULT 5;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS free_shipping_threshold NUMERIC DEFAULT 50;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS instagram_link TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS facebook_link TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS twitter_link TEXT;

-- Enable RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Anyone can view settings" ON public.settings;
CREATE POLICY "Anyone can view settings" ON public.settings
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage settings" ON public.settings;
CREATE POLICY "Admins can manage settings" ON public.settings
    FOR ALL USING (
        COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', FALSE)
    );

-- Insert global settings row if not exists
INSERT INTO public.settings (id, shop_name, contact_email, exchange_rate, currency_symbol)
VALUES ('global-settings', 'NewKet EMarket', 'contact@newket.com', 2800, 'CDF')
ON CONFLICT (id) DO NOTHING;
