-- 20260401_lead_gen_schema.sql
-- Pivot to Freemium Lead Generation Architecture

-- 1. TERRITOIRES
CREATE TABLE IF NOT EXISTS public.provinces (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.communes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    province_id UUID REFERENCES public.provinces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(province_id, name)
);

CREATE TABLE IF NOT EXISTS public.quartiers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    commune_id UUID REFERENCES public.communes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(commune_id, name)
);

-- Ajouter l'association geographique au user
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS province_id UUID REFERENCES public.provinces(id);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS commune_id UUID REFERENCES public.communes(id);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS quartier_id UUID REFERENCES public.quartiers(id);

-- 2. SUIVI DES LEADS (WHATSAPP CLICKS)
CREATE TABLE IF NOT EXISTS public.whatsapp_clicks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    clicked_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    visitor_ip TEXT -- anonymized or hashed to prevent abuse counting
);

-- RLS sur whatsapp_clicks:
-- - Tout le monde peut INSERER
-- - Seul l'admin ou le vendeur peuvent LIRE
ALTER TABLE public.whatsapp_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can insert clicks" ON public.whatsapp_clicks FOR INSERT WITH CHECK (true);
CREATE POLICY "Vendors can see their clicks" ON public.whatsapp_clicks FOR SELECT USING (vendor_id = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

-- 3. ABONNEMENTS VENDOR (STRIPE)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vendor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    stripe_subscription_id TEXT UNIQUE,
    stripe_customer_id TEXT,
    plan_tier TEXT DEFAULT 'free', -- 'free', 'basic', 'pro', 'premium' (ex: 0.99, 2.99, 3.99)
    status TEXT DEFAULT 'active', -- active, past_due, canceled
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS sur Subscriptions:
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vendors can view own sub" ON public.subscriptions FOR SELECT USING (vendor_id = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

-- 4. PUBLICITES (Bannières externes)
CREATE TABLE IF NOT EXISTS public.advertisements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slot_name TEXT NOT NULL, -- e.g. 'home_top', 'catalog_inline', 'product_sidebar'
    banner_url TEXT NOT NULL,
    target_url TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    clicks INT DEFAULT 0,
    impressions INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active ads" ON public.advertisements FOR SELECT USING (active = true);
CREATE POLICY "Admin can completely manage ads" ON public.advertisements FOR ALL USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

-- 5. NETTOYAGE DU LEGACY (CART ET COMMANDES)
-- ATTENTION : Ceci supprime les commandes et factures du modèle précédent.
-- Comme validé par le client, le modèle e-commerce ancien est détruit.
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.user_credits CASCADE;
DROP TABLE IF EXISTS public.withdrawals CASCADE;

-- On conserve les produits mais on s'assure que price peut servir juste d'indication
-- et la quantité gère juste la visibilité.
