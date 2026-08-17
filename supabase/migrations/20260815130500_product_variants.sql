-- Migration to add Product Variants (Gestion des Variantes)

-- 1. Create the product_variants table
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    price_modifier DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);

-- 3. Enable RLS
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Anyone can view variants
CREATE POLICY "Anyone can view product variants" ON public.product_variants
FOR SELECT USING (true);

-- Suppliers can manage their own variants (by joining on products)
CREATE POLICY "Suppliers can manage their own product variants" ON public.product_variants
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_variants.product_id
        AND (p.user_id = auth.uid() OR p.supplier_email = auth.jwt() ->> 'email')
    )
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', FALSE)
);

-- 5. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_product_variants_modtime') THEN
        CREATE TRIGGER update_product_variants_modtime
        BEFORE UPDATE ON public.product_variants
        FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    END IF;
END $$;
