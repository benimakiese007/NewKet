-- Scalability & Performance Indexes setup array
-- These indexes drastically speed up queries and allow the system to scale predictably with larger data volumes.

-- 1. Index on Category to speed up catalog queries filtered by categories.
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category);

-- 2. Index on Creation date (Descending) because UI usually queries for most recent products first.
CREATE INDEX IF NOT EXISTS idx_products_created_at_desc ON public.products (created_at DESC);

-- 3. Composite Index on User ID and Category (Useful for filtering a vendor's products by category).
CREATE INDEX IF NOT EXISTS idx_products_user_id_category ON public.products (user_id, category);

-- 4. Index on Status or Promos (Assuming you query frequently by 'is_promo = true')
CREATE INDEX IF NOT EXISTS idx_products_is_promo ON public.products (is_promo) WHERE is_promo = true;

-- 5. Index on New Items (If frequently queried)
CREATE INDEX IF NOT EXISTS idx_products_is_new ON public.products (is_new) WHERE is_new = true;

-- 6. Index to speed up full-text or ilike searches on name
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON public.products USING gin (name gin_trgm_ops);

-- Notification scaling
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id, read) WHERE read = false;

-- Orders scaling
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON public.orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_supplier_status ON public.orders USING gin (supplier_emails);
