create table if not exists public.employee_invitations (
  id text primary key,
  email_address text not null,
  name text not null default '',
  vendor_id text not null references public.vendors(id),
  client_unit_id text not null references public.client_units(id),
  employment_type text not null check (employment_type in ('client','direct')),
  token_hash text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  created_by text not null,
  submitted_at timestamptz,
  application_json jsonb not null default '{}'::jsonb,
  unique(email_address, vendor_id, client_unit_id)
);
alter table public.employee_invitations enable row level security;
revoke all on public.employee_invitations from anon, authenticated;
grant select, insert, update, delete on public.employee_invitations to service_role;
create index if not exists employee_invitations_unit_idx on public.employee_invitations(client_unit_id);
create index if not exists employee_invitations_vendor_idx on public.employee_invitations(vendor_id);
