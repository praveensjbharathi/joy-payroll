create table recovery_finalizations (
  id text primary key,
  run_id text not null references payroll_runs(id) on delete cascade,
  employee_id text not null references employees(id),
  voucher_number text not null unique,
  finalized_by text,
  finalized_at text not null default current_timestamp
);
create unique index recovery_finalization_run_employee_unique on recovery_finalizations(run_id, employee_id);
