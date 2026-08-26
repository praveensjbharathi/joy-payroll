begin;
alter table public.employees add column if not exists applicable_shifts_json text not null default '[]';
alter table public.hostel_utility_readings add column if not exists activity_name text;
alter table public.hostel_utility_readings drop constraint if exists hostel_utility_readings_utility_type_check;
alter table public.hostel_utility_readings add constraint hostel_utility_readings_utility_type_check check (utility_type in ('eb','water','payment','housekeeping','other'));
commit;
