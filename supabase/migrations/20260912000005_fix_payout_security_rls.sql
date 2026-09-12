-- Migration: Add RLS policies for vendor_payout_methods and support_tickets for admins (2026-09-12)

-- 0. Ensure resolved_at column exists on support_tickets
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- Update status check constraint on support_tickets to allow 'rejete', 'ferme', 'en_cours'
ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check;
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_status_check 
CHECK (status IN ('ouvert', 'resolu', 'rejete', 'ferme', 'en_cours', 'PENDING', 'RESOLVED', 'REJECTED'));

-- 1. Enable RLS on vendor_payout_methods
ALTER TABLE public.vendor_payout_methods ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Les vendeurs voient leurs propres méthodes" ON public.vendor_payout_methods;
DROP POLICY IF EXISTS "vendors_can_only_view_own_payout_methods" ON public.vendor_payout_methods;
DROP POLICY IF EXISTS "Les vendeurs gèrent leurs propres méthodes" ON public.vendor_payout_methods;
DROP POLICY IF EXISTS "Admins can manage payout methods" ON public.vendor_payout_methods;
DROP POLICY IF EXISTS "Vendors and admins can view payout methods" ON public.vendor_payout_methods;
DROP POLICY IF EXISTS "Vendors and admins can manage payout methods" ON public.vendor_payout_methods;

-- Create unified policies for vendor_payout_methods allowing both vendors and admins
CREATE POLICY "Vendors and admins can view payout methods"
ON public.vendor_payout_methods
FOR SELECT
USING ((auth.uid()::text = vendor_id) OR public.is_admin());

CREATE POLICY "Vendors and admins can manage payout methods"
ON public.vendor_payout_methods
FOR ALL
USING ((auth.uid()::text = vendor_id) OR public.is_admin())
WITH CHECK ((auth.uid()::text = vendor_id) OR public.is_admin());

-- 2. Support tickets admin update policy
DROP POLICY IF EXISTS "Admins can update support_tickets" ON public.support_tickets;
CREATE POLICY "Admins can update support_tickets"
ON public.support_tickets
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());
