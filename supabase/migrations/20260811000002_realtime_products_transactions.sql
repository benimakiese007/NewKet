-- Enable realtime for products and transactions tables
do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
        and tablename = 'products'
    ) then
        alter publication supabase_realtime add table public.products;
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
        and tablename = 'transactions'
    ) then
        alter publication supabase_realtime add table public.transactions;
    end if;
end
$$;
