alter table public.payroll_items
  add column if not exists fixed_working_days double precision not null default 0,
  add column if not exists nfh_days double precision not null default 0,
  add column if not exists comp_off_days double precision not null default 0,
  add column if not exists on_duty_days double precision not null default 0,
  add column if not exists sunday_days double precision not null default 0,
  add column if not exists pl_days double precision not null default 0,
  add column if not exists cl_days double precision not null default 0,
  add column if not exists sl_days double precision not null default 0,
  add column if not exists imported_gross_earnings double precision,
  add column if not exists imported_total_deductions double precision,
  add column if not exists imported_net_payable double precision;

create index if not exists recovery_finalizations_employee_idx
  on public.recovery_finalizations(employee_id);
