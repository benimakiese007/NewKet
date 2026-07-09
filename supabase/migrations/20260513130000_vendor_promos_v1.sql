BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_promos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
    discount_value NUMERIC NOT NULL CHECK (discount_value >= 0),
    min_order_amount NUMERIC NOT NULL DEFAULT 0 CHECK (min_order_amount >= 0),
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    max_uses INTEGER CHECK (max_uses IS NULL OR max_uses >= 0),
    max_uses_per_customer INTEGER CHECK (max_uses_per_customer IS NULL OR max_uses_per_customer >= 0),
    current_uses INTEGER NOT NULL DEFAULT 0 CHECK (current_uses >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    scope_type TEXT NOT NULL DEFAULT 'shop' CHECK (scope_type IN ('shop', 'products')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT vendor_promos_vendor_code_unique UNIQUE (vendor_id, code)
);

CREATE TABLE IF NOT EXISTS public.vendor_promo_products (
    promo_id UUID NOT NULL REFERENCES public.vendor_promos(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (promo_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.vendor_promo_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promo_id UUID NOT NULL REFERENCES public.vendor_promos(id) ON DELETE CASCADE,
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    discount_amount NUMERIC NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT vendor_promo_usages_unique_order UNIQUE (promo_id, order_id)
);

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS promo_id UUID REFERENCES public.vendor_promos(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS promo_code TEXT,
    ADD COLUMN IF NOT EXISTS promo_discount_amount NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC,
    ADD COLUMN IF NOT EXISTS final_total_amount NUMERIC;

UPDATE public.orders
SET
    subtotal_amount = COALESCE(subtotal_amount, merchandise_amount, total_amount, total, 0),
    final_total_amount = COALESCE(final_total_amount, total_amount, total, 0),
    promo_discount_amount = COALESCE(promo_discount_amount, 0)
WHERE subtotal_amount IS NULL
   OR final_total_amount IS NULL
   OR promo_discount_amount IS NULL;

CREATE INDEX IF NOT EXISTS idx_vendor_promos_vendor_id ON public.vendor_promos(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_promos_vendor_code ON public.vendor_promos(vendor_id, code);
CREATE INDEX IF NOT EXISTS idx_orders_promo_id ON public.orders(promo_id);
CREATE INDEX IF NOT EXISTS idx_vendor_promo_products_product_id ON public.vendor_promo_products(product_id);
CREATE INDEX IF NOT EXISTS idx_vendor_promo_usages_promo_customer ON public.vendor_promo_usages(promo_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_vendor_promo_usages_customer_id ON public.vendor_promo_usages(customer_id);
CREATE INDEX IF NOT EXISTS idx_vendor_promo_usages_order_id ON public.vendor_promo_usages(order_id);

ALTER TABLE public.vendor_promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_promo_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_promo_usages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendors manage their own promo codes" ON public.vendor_promos;
CREATE POLICY "Vendors manage their own promo codes"
ON public.vendor_promos
FOR ALL
USING (
    vendor_id::text = auth.uid()::text
    OR public.is_admin()
)
WITH CHECK (
    vendor_id::text = auth.uid()::text
    OR public.is_admin()
);

DROP POLICY IF EXISTS "Vendors manage their own promo products" ON public.vendor_promo_products;
CREATE POLICY "Vendors manage their own promo products"
ON public.vendor_promo_products
FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM public.vendor_promos vp
        WHERE vp.id = vendor_promo_products.promo_id
          AND (vp.vendor_id::text = auth.uid()::text OR public.is_admin())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.vendor_promos vp
        WHERE vp.id = vendor_promo_products.promo_id
          AND (vp.vendor_id::text = auth.uid()::text OR public.is_admin())
    )
);

DROP POLICY IF EXISTS "Promo usages are visible to owners and admins" ON public.vendor_promo_usages;
CREATE POLICY "Promo usages are visible to owners and admins"
ON public.vendor_promo_usages
FOR SELECT
USING (
    customer_id::text = auth.uid()::text
    OR public.is_admin()
    OR EXISTS (
        SELECT 1
        FROM public.vendor_promos vp
        WHERE vp.id = vendor_promo_usages.promo_id
          AND vp.vendor_id::text = auth.uid()::text
    )
);

CREATE OR REPLACE FUNCTION public.increment_vendor_promo_usage(target_promo_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.vendor_promos
    SET
        current_uses = COALESCE(current_uses, 0) + 1,
        updated_at = now()
    WHERE id = target_promo_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_vendor_promo_usage(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_vendor_promo_usage(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.increment_vendor_promo_usage(UUID) FROM authenticated;

COMMIT;
