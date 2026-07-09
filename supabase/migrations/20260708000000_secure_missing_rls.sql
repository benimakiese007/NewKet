-- ============================================================================
-- MIGRATION: Secure missing tables with RLS
-- Date: 2026-07-08
-- ============================================================================

-- 1. Geographical tables
ALTER TABLE IF EXISTS public.provinces ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.communes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.quartiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view provinces" ON public.provinces FOR SELECT USING (true);
CREATE POLICY "Admin can manage provinces" ON public.provinces USING ((SELECT role FROM public.users WHERE id = auth.uid()::text) = 'admin');

CREATE POLICY "Public can view communes" ON public.communes FOR SELECT USING (true);
CREATE POLICY "Admin can manage communes" ON public.communes USING ((SELECT role FROM public.users WHERE id = auth.uid()::text) = 'admin');

CREATE POLICY "Public can view quartiers" ON public.quartiers FOR SELECT USING (true);
CREATE POLICY "Admin can manage quartiers" ON public.quartiers USING ((SELECT role FROM public.users WHERE id = auth.uid()::text) = 'admin');


-- 2. Delivery tables
ALTER TABLE IF EXISTS public.delivery_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.order_status_history ENABLE ROW LEVEL SECURITY;

-- delivery_quotes
CREATE POLICY "Vendors can view their own quotes" ON public.delivery_quotes FOR SELECT USING (vendor_id = auth.uid());
CREATE POLICY "Customers can view quotes for their orders" ON public.delivery_quotes FOR SELECT USING (
  order_id IN (SELECT id FROM public.orders WHERE customer_id = auth.uid()::text)
);
CREATE POLICY "Admin can manage delivery_quotes" ON public.delivery_quotes USING ((SELECT role FROM public.users WHERE id = auth.uid()::text) = 'admin');
CREATE POLICY "Vendors can insert quotes" ON public.delivery_quotes FOR INSERT WITH CHECK (vendor_id = auth.uid());
CREATE POLICY "Vendors can update their quotes" ON public.delivery_quotes FOR UPDATE USING (vendor_id = auth.uid());

-- deliveries
CREATE POLICY "Vendors can view their own deliveries" ON public.deliveries FOR SELECT USING (vendor_id = auth.uid());
CREATE POLICY "Customers can view their deliveries" ON public.deliveries FOR SELECT USING (
  order_id IN (SELECT id FROM public.orders WHERE customer_id = auth.uid()::text)
);
CREATE POLICY "Vendors can update their deliveries" ON public.deliveries FOR UPDATE USING (vendor_id = auth.uid());
CREATE POLICY "Admin can manage deliveries" ON public.deliveries USING ((SELECT role FROM public.users WHERE id = auth.uid()::text) = 'admin');

-- order_status_history
CREATE POLICY "Vendors can view order history" ON public.order_status_history FOR SELECT USING (
  order_id IN (SELECT id FROM public.orders WHERE vendor_id = auth.uid())
);
CREATE POLICY "Customers can view order history" ON public.order_status_history FOR SELECT USING (
  order_id IN (SELECT id FROM public.orders WHERE customer_id = auth.uid()::text)
);
CREATE POLICY "Admin can manage order_status_history" ON public.order_status_history USING ((SELECT role FROM public.users WHERE id = auth.uid()::text) = 'admin');


-- 3. Financial tables
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.financial_ledger_entries ENABLE ROW LEVEL SECURITY;

-- payments
CREATE POLICY "Vendors can view their payments" ON public.payments FOR SELECT USING (vendor_id = auth.uid());
CREATE POLICY "Customers can view their payments" ON public.payments FOR SELECT USING (customer_id = auth.uid()::text);
CREATE POLICY "Admin can manage payments" ON public.payments USING ((SELECT role FROM public.users WHERE id = auth.uid()::text) = 'admin');

-- webhook events and ledger: No public policies, restricting implicitly.
-- Adding explicit admin policies for dashboard viewing.
CREATE POLICY "Admin can view webhook events" ON public.payment_webhook_events FOR SELECT USING ((SELECT role FROM public.users WHERE id = auth.uid()::text) = 'admin');
CREATE POLICY "Admin can view financial ledger" ON public.financial_ledger_entries FOR SELECT USING ((SELECT role FROM public.users WHERE id = auth.uid()::text) = 'admin');


-- 4. Analytics
ALTER TABLE IF EXISTS public.product_views_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert views" ON public.product_views_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Vendors can view their product stats" ON public.product_views_log FOR SELECT USING (
  product_id IN (SELECT id::text FROM public.products WHERE user_id = auth.uid())
);
CREATE POLICY "Admin can view all stats" ON public.product_views_log FOR SELECT USING ((SELECT role FROM public.users WHERE id = auth.uid()::text) = 'admin');
