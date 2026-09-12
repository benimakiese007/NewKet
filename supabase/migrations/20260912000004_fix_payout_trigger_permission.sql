-- Migration: Allow backend and admin writes on vendor_payout_methods
CREATE OR REPLACE FUNCTION public.block_direct_payout_method_writes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS \$
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin')
     OR current_setting('role', true) IN ('service_role', 'postgres')
     OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
     OR is_admin() THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Security violation: payout methods can only be modified through the admin approval process. Please submit a payout change request.';
END;
\$;
