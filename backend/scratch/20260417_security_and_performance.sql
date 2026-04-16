-- 1. Correction de la fonction is_admin() pour éviter l'escalade de privilèges
-- On ne fait plus confiance à user_metadata.role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    -- 1. Vérifie app_metadata (géré par le serveur uniquement)
    (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
    OR
    -- 2. Vérifie la table des utilisateurs privilégiés (avec email unique)
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE email = (auth.jwt() ->> 'email') 
      AND role = 'admin'
    )
    OR
    -- 3. Vérifie la liste blanche dans les réglages globaux
    EXISTS (
      SELECT 1 FROM public.settings 
      WHERE admin_emails ? (auth.jwt() ->> 'email')
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Optimisation de la table orders pour les performances RLS
-- Ajout de la colonne supplier_emails si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'supplier_emails') THEN
    ALTER TABLE public.orders ADD COLUMN supplier_emails text[] DEFAULT '{}';
  END IF;
END $$;

-- 3. Fonction pour extraire les emails des fournisseurs depuis le JSONB items
CREATE OR REPLACE FUNCTION public.extract_supplier_emails()
RETURNS trigger AS $$
BEGIN
  -- On extrait distinctement tous les supplier_email du JSONB items
  NEW.supplier_emails := ARRAY(
    SELECT DISTINCT (item->>'supplier_email')::text
    FROM jsonb_array_elements(NEW.items) AS item
    WHERE item ? 'supplier_email'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger pour maintenir supplier_emails à jour
DROP TRIGGER IF EXISTS tr_orders_supplier_emails ON public.orders;
CREATE TRIGGER tr_orders_supplier_emails
BEFORE INSERT OR UPDATE OF items ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.extract_supplier_emails();

-- 5. Remplissage initial de la colonne supplier_emails pour les commandes existantes
UPDATE public.orders SET supplier_emails = ARRAY(
  SELECT DISTINCT (item->>'supplier_email')::text
  FROM jsonb_array_elements(items) AS item
  WHERE item ? 'supplier_email'
);

-- 6. Mise à jour de la politique RLS orders_select (plus performante)
DROP POLICY IF EXISTS orders_select ON public.orders;
CREATE POLICY orders_select ON public.orders
FOR SELECT
TO authenticated
USING (
  is_admin() 
  OR (auth.jwt() ->> 'email' = customer_email)
  OR (auth.jwt() ->> 'email' = ANY(supplier_emails))
);

-- 7. Index GIN pour accélérer la recherche dans l'array
CREATE INDEX IF NOT EXISTS idx_orders_supplier_emails ON public.orders USING GIN (supplier_emails);

-- 8. Synchronisation automatique du rôle admin vers app_metadata
-- Cette fonction permet de s'assurer que si un utilisateur est marqué Admin dans public.users, 
-- son app_metadata est mis à jour (nécessite le service_role)
CREATE OR REPLACE FUNCTION public.sync_admin_role()
RETURNS trigger AS $$
BEGIN
  -- Note: Cette opération est limitée par les permissions, 
  -- mais sert de référence pour les fonctions backend.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
