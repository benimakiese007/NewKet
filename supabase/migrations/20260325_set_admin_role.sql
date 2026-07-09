-- =========================================================================
-- SCRIPT SQL: DEFINITION DU ROLE ADMIN DANS LES METADONNEES AUTH
-- =========================================================================

-- Note: Les emails ci-dessous étaient auparavant codés en dur dans le frontend.
-- Ce script les définit proprement dans Supabase pour une sécurité renforcée.

-- 1. Attribution du rôle admin aux emails spécifiés
UPDATE auth.users 
SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
WHERE email IN (
    'benimakiese1234@gmail.com', 
    'tmautuimane00@gmail.com', 
    'admin@newket.com'
);

-- 2. Vérification des changements (Optionnel)
-- SELECT email, raw_user_meta_data->>'role' as role FROM auth.users WHERE email IN ('benimakiese1234@gmail.com', 'tmautuimane00@gmail.com', 'admin@newket.com');

-- 3. Mise à jour de la table public.users pour cohérence (si la table existe et contient ces utilisateurs)
UPDATE public.users
SET role = 'admin'
WHERE email IN (
    'benimakiese1234@gmail.com', 
    'tmautuimane00@gmail.com', 
    'admin@newket.com'
);
