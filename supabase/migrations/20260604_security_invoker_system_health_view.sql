-- Make the system-health mismatch view respect the caller's privileges and RLS.
alter view public.v_system_payment_order_mismatches
set (security_invoker = true);
