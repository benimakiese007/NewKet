-- Drop shipping_time column from users table
ALTER TABLE public.users DROP COLUMN IF EXISTS shipping_time;
