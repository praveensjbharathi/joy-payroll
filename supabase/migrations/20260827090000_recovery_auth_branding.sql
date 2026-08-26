alter table public.vendors add column if not exists logo_data_url text;

create table if not exists public.recovery_entries (
  id text primary key,
  run_id text not null references public.payroll_runs(id) on delete cascade,
  employee_id text not null references public.employees(id),
  recovery_date date not null,
  recovery_type text not null check (recovery_type in ('rent','bus','food','advance','idCard','medical','ticket','shoe','aadhaarUpdate','bankAccountCharge','tshirt','oldPending','returnAmount')),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  reference text,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists recovery_entries_run_date_idx on public.recovery_entries(run_id, recovery_date);
create index if not exists recovery_entries_employee_idx on public.recovery_entries(employee_id);
alter table public.recovery_entries enable row level security;
revoke all on table public.recovery_entries from anon, authenticated;
