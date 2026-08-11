-- Enable realtime for orders table
do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
        and tablename = 'orders'
    ) then
        alter publication supabase_realtime add table public.orders;
    end if;
end
$$;
