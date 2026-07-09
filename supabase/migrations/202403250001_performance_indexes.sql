-- Performance Index for Product Loading (20240325)
-- This migration adds a descending index on created_at to speed up product fetching.

CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products (created_at DESC);

-- Optional: Performance Index for Orders if they grow large
CREATE INDEX IF NOT EXISTS idx_orders_date ON public.orders (date DESC);

-- Optional: Analytics index for supplier queries
CREATE INDEX IF NOT EXISTS idx_products_supplier_email ON public.products (supplier_email);
