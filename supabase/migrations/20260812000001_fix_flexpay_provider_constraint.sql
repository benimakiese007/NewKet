-- Fix provider constraint: rename from 'flexpay' to 'flexpaie' (correct brand name)
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_provider_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_provider_check CHECK (provider = 'flexpaie');
