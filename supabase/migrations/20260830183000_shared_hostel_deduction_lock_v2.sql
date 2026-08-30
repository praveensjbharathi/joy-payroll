alter table public.hostels
  add column if not exists group_company_scope_json text not null default '[]';

update public.hostels
set group_company_scope_json = json_build_array(vendor_id)::text
where group_company_scope_json is null or group_company_scope_json = '[]';

alter table public.payroll_runs
  add column if not exists deductions_status text not null default 'open';
alter table public.payroll_runs
  add column if not exists deductions_locked_by text;
alter table public.payroll_runs
  add column if not exists deductions_locked_at text;

update public.payroll_runs
set deductions_status = 'locked',
    deductions_locked_by = coalesce(approved_by, 'historical approval'),
    deductions_locked_at = coalesce(approved_at, updated_at)
where status = 'approved' and deductions_status = 'open';

alter table public.accommodation_room_expenses
  add column if not exists other_amount double precision not null default 0;

alter table public.accommodation_charges
  add column if not exists other_share double precision not null default 0;

create table if not exists public.room_recovery_entries (
  id text primary key,
  room_id text not null references public.accommodation_rooms(id),
  pay_period text not null,
  entry_date text not null,
  recovery_type text not null,
  amount double precision not null default 0,
  reference text,
  notes text,
  created_by text,
  created_at text not null default CURRENT_TIMESTAMP,
  updated_by text,
  updated_at text not null default CURRENT_TIMESTAMP
);

create index if not exists room_recovery_room_period_date_idx
  on public.room_recovery_entries(room_id, pay_period, entry_date);
