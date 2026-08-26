-- Extend the existing Joy Payroll production schema without exposing employee,
-- salary, room, or compliance records through Supabase's browser Data API.
-- Client/unit authorization is enforced by the authenticated payroll Edge Function.

begin;

alter table public.app_users
  add column if not exists client_scope_json text not null default '[]',
  add column if not exists unit_scope_json text not null default '[]';

alter table public.client_units
  add column if not exists payslip_title text,
  add column if not exists payslip_subtitle text,
  add column if not exists payslip_address text,
  add column if not exists payslip_contact text,
  add column if not exists payslip_footer text;

create table if not exists public.accommodation_types (
  id text primary key,
  vendor_id text not null references public.vendors(id),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  remarks text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at text not null default (to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

create unique index if not exists accommodation_type_client_name_unique
  on public.accommodation_types(vendor_id, name);

create table if not exists public.accommodation_rooms (
  id text primary key,
  vendor_id text not null references public.vendors(id),
  accommodation_type_id text not null references public.accommodation_types(id),
  room_number text not null check (char_length(btrim(room_number)) between 1 and 100),
  capacity integer not null default 0 check (capacity between 0 and 1000),
  address text,
  remarks text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at text not null default (to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

create unique index if not exists accommodation_room_client_type_number_unique
  on public.accommodation_rooms(vendor_id, accommodation_type_id, room_number);

alter table public.employees
  add column if not exists date_of_leaving text,
  add column if not exists room_id text references public.accommodation_rooms(id);

alter table public.employees
  drop constraint if exists employees_accommodation_type_check;

alter table public.employees
  alter column accommodation_type set default 'Tamil';

update public.employees
set accommodation_type = 'Tamil'
where accommodation_type = 'Tamil Own';

alter table public.payroll_runs
  add column if not exists period_start text,
  add column if not exists period_end text,
  add column if not exists working_days integer not null default 26;

update public.payroll_runs as run
set period_start = coalesce(run.period_start, run.pay_period || '-01'),
    period_end = coalesce(run.period_end,
      to_char(((run.pay_period || '-01')::date + interval '1 month - 1 day')::date, 'YYYY-MM-DD')),
    working_days = coalesce(rule.standard_working_days, run.working_days)
from public.vendors as client
left join public.payroll_rules as rule on rule.vendor_id = client.id
where run.vendor_id = client.id;

create table if not exists public.accommodation_room_expenses (
  id text primary key,
  room_id text not null references public.accommodation_rooms(id),
  pay_period text not null check (pay_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  gas_amount double precision not null default 0 check (gas_amount >= 0),
  ration_amount double precision not null default 0 check (ration_amount >= 0),
  provision_amount double precision not null default 0 check (provision_amount >= 0),
  occupant_count integer not null default 0 check (occupant_count >= 0),
  status text not null default 'draft' check (status in ('draft', 'finalized')),
  notes text,
  finalized_by text,
  finalized_at text,
  updated_at text not null default (to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

create unique index if not exists accommodation_room_period_unique
  on public.accommodation_room_expenses(room_id, pay_period);

create table if not exists public.payroll_batches (
  id text primary key,
  run_id text not null references public.payroll_runs(id),
  accommodation_type text not null,
  employee_count integer not null default 0 check (employee_count >= 0),
  gross_earnings double precision not null default 0,
  net_payable double precision not null default 0,
  status text not null default 'prepared' check (status in ('prepared', 'cleared')),
  payment_reference text,
  prepared_by text,
  prepared_at text,
  cleared_by text,
  cleared_at text,
  updated_at text not null default (to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

create unique index if not exists payroll_batch_run_accommodation_unique
  on public.payroll_batches(run_id, accommodation_type);

alter table public.accommodation_charges
  add column if not exists room_expense_id text references public.accommodation_room_expenses(id),
  add column if not exists gas_share double precision not null default 0,
  add column if not exists provision_share double precision not null default 0;

-- Load the two real payroll clients requested by the account owner. No example
-- employers, workers, salary records, or payroll runs are inserted.
insert into public.vendors (id, code, name, legal_name, epf_code, esi_code, gstin, status)
values
  ('vendor-jms', 'JMS', 'Joy Manpower Service', 'Joy Manpower Service',
    'CBCBE1724259000', '56001195190001001', '33AOAPR4773D1Z2', 'active'),
  ('vendor-jcs', 'JCS', 'Joy Corporate Solutions Private Limited',
    'Joy Corporate Solutions Private Limited', 'CBCBE3415419000',
    '56001461400000999', '33AAGCJ6200N1ZL', 'active')
on conflict (code) do update
set name = excluded.name,
    legal_name = excluded.legal_name,
    epf_code = excluded.epf_code,
    esi_code = excluded.esi_code,
    gstin = excluded.gstin;

-- Every real client starts with editable accommodation and shift masters.
insert into public.accommodation_types (id, vendor_id, name)
select 'ACCTYPE-' || client.code || '-' || defaults.key, client.id, defaults.name
from public.vendors as client
cross join (values
  ('TAMIL', 'Tamil'),
  ('OUTSIDE', 'Outside Room'),
  ('JOY', 'Joy Room')
) as defaults(key, name)
on conflict (vendor_id, name) do nothing;

insert into public.accommodation_types (id, vendor_id, name)
select 'ACCTYPE-LEGACY-' || md5(employee.vendor_id || ':' || employee.accommodation_type),
  employee.vendor_id, employee.accommodation_type
from public.employees as employee
where btrim(employee.accommodation_type) <> ''
group by employee.vendor_id, employee.accommodation_type
on conflict (vendor_id, name) do nothing;

insert into public.accommodation_rooms (id, vendor_id, accommodation_type_id, room_number)
select 'ROOM-LEGACY-' || md5(employee.vendor_id || ':' || type.id || ':' || employee.room_number),
  employee.vendor_id, type.id, employee.room_number
from public.employees as employee
join public.accommodation_types as type
  on type.vendor_id = employee.vendor_id and type.name = employee.accommodation_type
where employee.room_number is not null and btrim(employee.room_number) <> ''
group by employee.vendor_id, type.id, employee.room_number
on conflict (vendor_id, accommodation_type_id, room_number) do nothing;

update public.employees as employee
set room_id = room.id
from public.accommodation_rooms as room
join public.accommodation_types as type on type.id = room.accommodation_type_id
where employee.room_id is null
  and room.vendor_id = employee.vendor_id
  and type.name = employee.accommodation_type
  and room.room_number = employee.room_number;

insert into public.shift_definitions (id, vendor_id, name, start_time, end_time)
select 'SHIFT-' || client.code || '-' || defaults.key,
  client.id, defaults.name, defaults.start_time, defaults.end_time
from public.vendors as client
cross join (values
  ('GENERAL', 'General', '09:00', '18:00'),
  ('FIRST', '1st Shift', '06:00', '14:00'),
  ('SECOND', '2nd Shift', '14:00', '22:00'),
  ('THIRD', '3rd Shift', '22:00', '06:00')
) as defaults(key, name, start_time, end_time)
on conflict (vendor_id, name) do nothing;

-- Foreign-key and common dashboard/scope filters are indexed explicitly.
create index if not exists accommodation_types_vendor_idx
  on public.accommodation_types(vendor_id, status);
create index if not exists accommodation_rooms_vendor_idx
  on public.accommodation_rooms(vendor_id, status);
create index if not exists accommodation_rooms_type_idx
  on public.accommodation_rooms(accommodation_type_id, status);
create index if not exists accommodation_expenses_period_idx
  on public.accommodation_room_expenses(pay_period, status);
create index if not exists employees_room_status_idx
  on public.employees(room_id, status);
create index if not exists employees_vendor_status_joining_idx
  on public.employees(vendor_id, status, date_of_joining);
create index if not exists employees_unit_status_idx
  on public.employees(client_unit_id, status);
create index if not exists accommodation_charge_employee_idx
  on public.accommodation_charges(employee_id);
create index if not exists accommodation_charge_room_expense_idx
  on public.accommodation_charges(room_expense_id);
create index if not exists payroll_batches_status_idx
  on public.payroll_batches(run_id, status);
create index if not exists payroll_remarks_vendor_idx
  on public.payroll_remarks(vendor_id);
create index if not exists audit_actor_created_idx
  on public.audit_events(actor_email, created_at desc);

alter table public.accommodation_types enable row level security;
alter table public.accommodation_rooms enable row level security;
alter table public.accommodation_room_expenses enable row level security;
alter table public.payroll_batches enable row level security;

revoke all on public.accommodation_types, public.accommodation_rooms,
  public.accommodation_room_expenses, public.payroll_batches
  from public, anon, authenticated;

comment on table public.accommodation_types is
  'Client-specific, editable room categories; read and write through the authenticated payroll Edge Function only.';
comment on table public.accommodation_rooms is
  'Client-specific employee accommodation rooms; protected from direct browser Data API access.';
comment on table public.accommodation_room_expenses is
  'Finalized gas, ration, and provision room totals that are split exactly across allocated roommates.';
comment on table public.payroll_batches is
  'Accommodation-wise payroll preparation and payment-clearance audit records.';

commit;
