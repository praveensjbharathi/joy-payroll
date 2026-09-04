-- Persist the exact employee selection used for each bank export.
-- A payroll item may belong to only one export batch for its payroll run.

begin;

create table if not exists public.payment_export_batches (
  id text primary key,
  run_id text not null references public.payroll_runs(id),
  status text not null default 'locked'
    check (status in ('locked', 'downloaded')),
  export_format text,
  employee_count integer not null default 0 check (employee_count > 0),
  total_payable double precision not null default 0 check (total_payable >= 0),
  locked_by text not null,
  locked_at text not null,
  downloaded_by text,
  downloaded_at text,
  created_at text not null default (to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  updated_at text not null default (to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

create table if not exists public.payment_export_batch_items (
  id text primary key,
  batch_id text not null references public.payment_export_batches(id) on delete cascade,
  run_id text not null references public.payroll_runs(id),
  payroll_item_id text not null references public.payroll_items(id),
  employee_id text not null references public.employees(id),
  amount double precision not null default 0 check (amount >= 0),
  created_at text not null default (to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

create unique index if not exists payment_export_batch_run_item_unique
  on public.payment_export_batch_items(run_id, payroll_item_id);
create index if not exists payment_export_batches_run_status_idx
  on public.payment_export_batches(run_id, status);
create index if not exists payment_export_batch_items_batch_idx
  on public.payment_export_batch_items(batch_id);
create index if not exists payment_export_batch_items_payroll_item_idx
  on public.payment_export_batch_items(payroll_item_id);
create index if not exists payment_export_batch_items_employee_fk_idx
  on public.payment_export_batch_items(employee_id);
create index if not exists payment_export_batch_items_employee_idx
  on public.payment_export_batch_items(run_id, employee_id);

alter table public.payment_export_batches enable row level security;
alter table public.payment_export_batch_items enable row level security;
revoke all on public.payment_export_batches, public.payment_export_batch_items
  from public, anon, authenticated;

comment on table public.payment_export_batches is
  'Persistent employee-wise bank export locks; downloaded batches cannot be silently re-exported.';
comment on table public.payment_export_batch_items is
  'Individual payroll items included in one locked or downloaded bank export batch.';

commit;
