-- =========================================================================
-- MIGRATION: SET ADMIN ROLE IN app_metadata (raw_app_meta_data)
-- =========================================================================
-- IMPORTANT: Supabase JWT claims:
--   auth.jwt() -> 'app_metadata'  maps to auth.users.raw_app_meta_data
--   auth.jwt() -> 'user_metadata' maps to auth.users.raw_user_meta_data
--
-- The previous script `20260325_set_admin_role.sql` set the role only in
-- raw_user_meta_data. The is_admin() function needs it in raw_app_meta_data
-- for it to be trusted (user_metadata is user-editable, app_metadata is not).
-- =========================================================================

-- Set admin role in raw_app_meta_data (trusted, not user-editable)
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email IN (
    'benimakiese1234@gmail.com'
);

-- Verify (run separately to check):
-- SELECT email, raw_app_meta_data->>'role' as app_role, raw_user_meta_data->>'role' as user_role
-- FROM auth.users
-- WHERE email IN ('benimakiese1234@gmail.com');
