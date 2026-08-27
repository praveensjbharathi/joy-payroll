alter table public.employees add column if not exists room_rent_amount numeric not null default 0;
alter table public.employees add column if not exists photo_data_url text;
