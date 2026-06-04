do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'analytics_events'
    ) then
        alter publication supabase_realtime add table public.analytics_events;
    end if;

    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'activities'
    ) then
        alter publication supabase_realtime add table public.activities;
    end if;

    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'order_status_history'
    ) then
        alter publication supabase_realtime add table public.order_status_history;
    end if;

    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'shop_views'
    ) then
        alter publication supabase_realtime add table public.shop_views;
    end if;

    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'system_health_incidents'
    ) then
        alter publication supabase_realtime add table public.system_health_incidents;
    end if;
end $$;
