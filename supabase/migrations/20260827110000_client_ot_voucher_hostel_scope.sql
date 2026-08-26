alter table public.client_units add column if not exists overtime_multiplier numeric(6,2) not null default 1 check (overtime_multiplier > 0 and overtime_multiplier <= 5);
alter table public.client_units add column if not exists voucher_header text;
alter table public.hostels add column if not exists client_scope_json text not null default '[]';
