-- Make rccm_number unique to prevent duplicate vendor accounts with the same business registry number
ALTER TABLE public.users ADD CONSTRAINT users_rccm_number_key UNIQUE (rccm_number);
