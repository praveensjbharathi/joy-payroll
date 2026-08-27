alter table public.employees add column if not exists pf_applicable integer not null default 1;
alter table public.employees add column if not exists pf_wage_amount numeric not null default 0;
alter table public.employees add column if not exists esi_applicable integer not null default 1;
alter table public.employees add column if not exists esi_wage_amount numeric not null default 0;
alter table public.employees add column if not exists pt_applicable integer not null default 1;
alter table public.employees add column if not exists lwf_applicable integer not null default 1;
