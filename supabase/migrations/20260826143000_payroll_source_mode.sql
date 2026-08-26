alter table public.payroll_runs
  add column if not exists processing_mode text not null default 'attendance'
  check (processing_mode in ('attendance', 'salary_import'));
