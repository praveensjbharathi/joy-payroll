create table if not exists public.application_documents (id text primary key, employee_id text not null references public.employees(id), category text not null, filename text not null, data_url text not null);
create unique index if not exists application_documents_employee_category on public.application_documents(employee_id, category);
alter table public.application_documents enable row level security;
revoke all on public.application_documents from anon, authenticated;
comment on table public.application_documents is 'Private application attachments. Access exclusively through payroll API employee permission and company/unit scope checks.';
