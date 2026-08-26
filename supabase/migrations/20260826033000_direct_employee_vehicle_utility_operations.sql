begin;

alter table public.employees add column if not exists employment_type text not null default 'client';
alter table public.employees add column if not exists processing_stage text not null default 'field_hr_draft';
alter table public.employees add column if not exists finalized_by text;
alter table public.employees add column if not exists finalized_at timestamptz;
alter table public.employees drop constraint if exists employees_employment_type_check;
alter table public.employees add constraint employees_employment_type_check check (employment_type in ('client','direct'));
alter table public.employees drop constraint if exists employees_processing_stage_check;
alter table public.employees add constraint employees_processing_stage_check check (processing_stage in ('field_hr_draft','field_hr_finalized','payroll_processed','hr_manager_reviewed','approved'));

create table if not exists public.vehicles (
 id text primary key, vendor_id text not null references public.vendors(id), registration_number text not null unique,
 vehicle_name text not null, vehicle_type text not null default 'car', current_odometer double precision not null default 0,
 permit_expiry date, insurance_expiry date, fc_expiry date, pollution_expiry date, next_service_date date,
 next_service_km double precision, tyre_changed_date date, tyre_changed_km double precision,
 last_water_wash_date date, last_wheel_alignment_date date, status text not null default 'active', remarks text,
 created_at timestamptz not null default now(), check (status in ('active','inactive')), check (current_odometer >= 0)
);
create index if not exists vehicles_vendor_status_idx on public.vehicles(vendor_id,status);
create index if not exists vehicles_compliance_dates_idx on public.vehicles(permit_expiry,insurance_expiry,fc_expiry,pollution_expiry);

create table if not exists public.vehicle_records (
 id text primary key, vehicle_id text not null references public.vehicles(id), record_date date not null, record_type text not null,
 trip_from text, trip_to text, purpose text, start_km double precision, end_km double precision,
 litres double precision not null default 0, amount double precision not null default 0, vendor_name text,
 next_due_date date, next_due_km double precision, remarks text, entered_by text, approved_by text, approved_at timestamptz,
 status text not null default 'draft', created_at timestamptz not null default now(),
 check (record_type in ('trip','fuel','service','tyre','water_wash','wheel_alignment','permit','insurance','fc','pollution','other')),
 check (status in ('draft','approved')), check (litres >= 0 and amount >= 0), check (end_km is null or start_km is null or end_km >= start_km)
);
create index if not exists vehicle_records_vehicle_date_idx on public.vehicle_records(vehicle_id,record_date desc);
create index if not exists vehicle_records_type_date_idx on public.vehicle_records(record_type,record_date desc);

create table if not exists public.utility_meters (
 id text primary key, vendor_id text not null references public.vendors(id), location_type text not null,
 location_name text not null, meter_number text, status text not null default 'active', remarks text,
 created_at timestamptz not null default now(), check (location_type in ('hostel','office')), check (status in ('active','inactive'))
);
create index if not exists utility_meters_vendor_status_idx on public.utility_meters(vendor_id,status);

create table if not exists public.eb_readings (
 id text primary key, meter_id text not null references public.utility_meters(id), reading_date date not null,
 reading_value double precision not null, units_consumed double precision not null default 0, amount double precision not null default 0,
 remarks text, entered_by text, approved_by text, approved_at timestamptz, status text not null default 'draft',
 created_at timestamptz not null default now(), unique(meter_id,reading_date),
 check (reading_value >= 0 and units_consumed >= 0 and amount >= 0), check (status in ('draft','approved'))
);
create index if not exists eb_readings_meter_date_idx on public.eb_readings(meter_id,reading_date desc);

alter table public.vehicles enable row level security;
alter table public.vehicle_records enable row level security;
alter table public.utility_meters enable row level security;
alter table public.eb_readings enable row level security;
revoke all on public.vehicles, public.vehicle_records, public.utility_meters, public.eb_readings from anon, authenticated;

commit;
