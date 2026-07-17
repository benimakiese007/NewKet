-- À exécuter dans le SQL Editor de Supabase
CREATE TABLE IF NOT EXISTS public.vendor_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  webhook_url TEXT,
  access_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(vendor_id, provider)
);

-- Activation de RLS
ALTER TABLE public.vendor_integrations ENABLE ROW LEVEL SECURITY;

-- Les vendeurs peuvent lire leurs propres intégrations
CREATE POLICY "Les vendeurs peuvent voir leurs propres intégrations" 
ON public.vendor_integrations FOR SELECT 
USING (auth.uid() = vendor_id);

-- Les vendeurs peuvent gérer leurs propres intégrations
CREATE POLICY "Les vendeurs peuvent gérer leurs propres intégrations" 
ON public.vendor_integrations FOR ALL 
USING (auth.uid() = vendor_id);
