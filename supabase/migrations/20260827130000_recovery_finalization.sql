create table if not exists public.recovery_finalizations (
  id text primary key,
  run_id text not null references public.payroll_runs(id) on delete cascade,
  employee_id text not null references public.employees(id),
  voucher_number text not null unique,
  finalized_by text,
  finalized_at timestamptz not null default now(),
  unique(run_id, employee_id)
);
alter table public.recovery_finalizations enable row level security;
revoke all on table public.recovery_finalizations from anon, authenticated;
