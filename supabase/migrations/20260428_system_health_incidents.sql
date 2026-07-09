-- System Health & Action Engine - incidents storage

create table if not exists public.system_health_incidents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  detected_at timestamptz not null default now(),

  priority text not null check (priority in ('P0','P1','P2')),
  severity text not null check (severity in ('critical','medium','low')),
  category text not null check (category in ('performance','payments','orders','users','vendors','security','ops')),

  title text not null,
  summary text not null,

  -- Evidence payload should never contain secrets.
  evidence jsonb not null default '{}'::jsonb,

  action_immediate text,
  action_robust text,
  owner text,

  status text not null default 'open' check (status in ('open','acknowledged','resolved','dismissed')),
  resolved_at timestamptz,

  -- Idempotence / dedupe
  fingerprint text
);

create index if not exists system_health_incidents_created_at_idx
  on public.system_health_incidents (created_at desc);

create index if not exists system_health_incidents_priority_idx
  on public.system_health_incidents (priority, created_at desc);

create unique index if not exists system_health_incidents_fingerprint_uniq
  on public.system_health_incidents (fingerprint)
  where fingerprint is not null;

-- Basic RLS: admins only (relies on existing admin role patterns in your project)
alter table public.system_health_incidents enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'system_health_incidents'
      and policyname = 'Admins can manage system incidents'
  ) then
    create policy "Admins can manage system incidents"
      on public.system_health_incidents
      for all
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- Views: payments vs orders mismatch (best-effort; adapt columns if needed)
create or replace view public.v_system_payment_order_mismatches as
select
  o.id as order_id,
  o.status as order_status,
  o.created_at as order_created_at,
  p.id as payment_id,
  p.status as payment_status,
  p.created_at as payment_created_at
from public.orders o
join public.payments p on p.order_id = o.id
where
  -- "payment succeeded but order not updated" (tune statuses as your schema evolves)
  (p.status in ('SUCCESSFUL','SUCCEEDED','PAID','completed','success') and o.status in ('En attente','PENDING','pending','WAITING_PAYMENT'))
  or
  (p.status in ('FAILED','CANCELLED','canceled','failed') and o.status in ('SUCCESSFUL','PAID','completed','success'));
