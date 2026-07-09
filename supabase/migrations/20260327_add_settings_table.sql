-- Migration: Add missing settings table (20260327_add_settings_table.sql)

-- Create settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    shop_name TEXT DEFAULT 'NewKet EMarket',
    contact_email TEXT DEFAULT 'contact@newket.com',
    support_phone TEXT DEFAULT '+243 000 000 000',
    exchange_rate NUMERIC DEFAULT 2800,
    currency_symbol TEXT DEFAULT 'CDF',
    shipping_fee NUMERIC DEFAULT 5,
    free_shipping_threshold NUMERIC DEFAULT 50,
    maintenance_mode BOOLEAN DEFAULT FALSE,
    instagram_link TEXT,
    facebook_link TEXT,
    twitter_link TEXT
);

-- Enable RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view settings" ON public.settings
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage settings" ON public.settings
    FOR ALL USING (
        (auth.jwt() ->> 'email') IN (SELECT email FROM public.users WHERE role = 'admin')
    );

-- Insert global settings row if not exists
INSERT INTO public.settings (id, shop_name, contact_email, exchange_rate, currency_symbol)
VALUES ('global-settings', 'NewKet EMarket', 'contact@newket.com', 2800, 'CDF')
ON CONFLICT (id) DO NOTHING;
