-- Migration: Activer Supabase Realtime pour la table support_tickets
-- et ajouter la politique RLS SELECT nécessaire pour que Realtime
-- puisse envoyer les événements aux clients authentifiés.

do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'support_tickets'
    ) then
        alter publication supabase_realtime add table public.support_tickets;
    end if;
end $$;

-- Politique SELECT pour les utilisateurs authentifiés (requise pour Supabase Realtime)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets'
    AND policyname = 'Authenticated users can view support_tickets'
  ) THEN
    CREATE POLICY "Authenticated users can view support_tickets"
    ON public.support_tickets
    FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
