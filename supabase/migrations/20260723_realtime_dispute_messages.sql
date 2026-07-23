-- ============================================================
-- ⚡ NEWKET — Activer le Realtime Supabase pour dispute_messages
-- ============================================================
-- Sans cette publication, les clients Supabase ne reçoivent
-- jamais les INSERT en temps réel malgré le canal souscrit.

do $$
begin
    -- dispute_messages : nécessaire pour le chat litige en temps réel
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'dispute_messages'
    ) then
        alter publication supabase_realtime add table public.dispute_messages;
    end if;

    -- disputes : pour mettre à jour le statut du litige en temps réel
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'disputes'
    ) then
        alter publication supabase_realtime add table public.disputes;
    end if;
end $$;
