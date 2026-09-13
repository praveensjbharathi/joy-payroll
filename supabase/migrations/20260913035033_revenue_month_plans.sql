-- Monthly client calendars and commercial assumptions are private to the
-- authenticated Super Admin payroll API. No browser Data API grants or policies.
create table public.revenue_month_plans (
  id text primary key,
  month text not null check (month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
  client_unit_id text not null references public.client_units(id),
  config_json text not null check (jsonb_typeof(config_json::jsonb) = 'object'),
  revision integer not null default 1 check (revision > 0),
  confirmed_at text,
  updated_at text not null,
  updated_by text not null
);
create unique index revenue_month_unit_unique on public.revenue_month_plans(month, client_unit_id);
create index revenue_month_client_idx on public.revenue_month_plans(client_unit_id);
alter table public.revenue_month_plans enable row level security;
revoke all on public.revenue_month_plans from public, anon, authenticated;
grant select, insert, update, delete on public.revenue_month_plans to service_role;
comment on table public.revenue_month_plans is 'Super Admin only: a separately confirmed operating calendar and billing setup for each client unit and calendar month.';
