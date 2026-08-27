alter table public.employees
  add column if not exists highest_qualification text;
