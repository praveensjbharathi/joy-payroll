-- Applicant files stay private until HR copies them into the reviewed employee record.
alter table public.employee_invitations add column if not exists documents_json jsonb not null default '[]'::jsonb;
alter table public.employee_invitations add constraint invitation_documents_array check (jsonb_typeof(documents_json) = 'array' and jsonb_array_length(documents_json) <= 13);
revoke all on public.employee_invitations from anon, authenticated;
alter table public.employee_invitations enable row level security;

-- A submission and its employee attachments commit together or roll back together.
create or replace function public.submit_existing_onboarding(p_employee_id text, p_expected_application text, p_application text, p_documents jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare changed integer; doc jsonb;
begin
  if jsonb_typeof(p_documents) <> 'array' or jsonb_array_length(p_documents) > 13 then raise exception 'Invalid documents'; end if;
  update public.employees set application_json = p_application
  where id = p_employee_id and status = 'active' and application_json is not distinct from p_expected_application
    and (application_json::jsonb -> '_joyOnboarding' ->> 'hash') is not null
    and (application_json::jsonb -> '_joyOnboarding' ->> 'submitted') is null
    and (application_json::jsonb -> '_joyOnboarding' ->> 'expires')::numeric > extract(epoch from clock_timestamp()) * 1000;
  get diagnostics changed = row_count;
  if changed = 0 then return false; end if;
  for doc in select value from jsonb_array_elements(p_documents) loop
    insert into public.application_documents (id, employee_id, category, filename, data_url)
    values (gen_random_uuid()::text, p_employee_id, doc->>'category', doc->>'filename', doc->>'dataUrl')
    on conflict (employee_id, category) do update set filename = excluded.filename, data_url = excluded.data_url;
  end loop;
  return true;
end;
$$;
revoke all on function public.submit_existing_onboarding(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.submit_existing_onboarding(text, text, text, jsonb) to service_role;
