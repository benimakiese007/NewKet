-- ============================================================================
-- MIGRATION: Allow public reading of user profiles
-- ============================================================================
-- This migration adds a policy to allow anyone (including guests) to read the 
-- public.users table so that vendor names can be displayed on product cards.
-- ============================================================================

BEGIN;

CREATE POLICY "Public users are viewable by everyone" 
ON public.users
FOR SELECT 
USING (true);

COMMIT;
