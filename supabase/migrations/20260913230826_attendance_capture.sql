-- Raw punches remain separate from payable attendance until an authorised HR review.
create table public.attendance_devices (
  id text primary key,
  client_unit_id text not null references public.client_units(id),
  name text not null check (length(name) between 1 and 120),
  model text,
  status text not null default 'active' check (status in ('active','inactive')),
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  created_by text not null,
  created_at text not null default (now()::text),
  updated_at text not null default (now()::text)
);
create index attendance_devices_unit_idx on public.attendance_devices(client_unit_id);
create table public.attendance_device_mappings (
  id text primary key,
  device_id text not null references public.attendance_devices(id),
  device_user_id text not null check (length(device_user_id) between 1 and 100),
  employee_id text not null references public.employees(id),
  shift_code text not null,
  status text not null default 'active' check (status in ('active','inactive')),
  created_by text not null,
  created_at text not null default (now()::text),
  updated_at text not null default (now()::text),
  unique(device_id,device_user_id)
);
create index attendance_device_mappings_employee_idx on public.attendance_device_mappings(employee_id);
create table public.attendance_punches (
  id text primary key,
  client_unit_id text not null references public.client_units(id),
  employee_id text not null references public.employees(id),
  device_id text references public.attendance_devices(id),
  device_user_id text,
  punched_at text not null check (punched_at ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'),
  direction text not null check(direction in ('in','out')),
  source text not null check(source in ('qr','biometric_api','biometric_import','hr_correction')),
  event_key text not null unique,
  external_event_id text,
  shift_code text not null,
  status text not null default 'pending' check(status in ('pending','posted','ignored')),
  attendance_date text,
  approval_id text,
  remarks text,
  created_by text not null,
  created_at text not null default (now()::text),
  reviewed_by text,
  reviewed_at text
);
create index attendance_punches_unit_time_idx on public.attendance_punches(client_unit_id,punched_at);
create index attendance_punches_employee_time_idx on public.attendance_punches(employee_id,punched_at);
create index attendance_punches_device_idx on public.attendance_punches(device_id);
create unique index attendance_punches_device_event_idx on public.attendance_punches(device_id,external_event_id) where external_event_id is not null;
create unique index if not exists attendance_employee_date_unique on public.attendance_entries(employee_id,attendance_date);

alter table public.attendance_devices enable row level security;
alter table public.attendance_device_mappings enable row level security;
alter table public.attendance_punches enable row level security;
revoke all on public.attendance_devices, public.attendance_device_mappings, public.attendance_punches from anon, authenticated;
grant all on public.attendance_devices, public.attendance_device_mappings, public.attendance_punches to service_role;

create function public.validate_attendance_punch() returns trigger
language plpgsql set search_path = '' as $$
declare e public.employees; d public.attendance_devices; work_date text; previous public.attendance_punches; picked text; clock_minute integer;
begin
  select * into e from public.employees where id=new.employee_id for update;
  work_date := to_char(new.punched_at::timestamptz at time zone 'Asia/Kolkata','YYYY-MM-DD');
  if e.id is null or e.client_unit_id<>new.client_unit_id or e.date_of_joining>work_date
    or (e.date_of_leaving is not null and e.date_of_leaving<>'' and e.date_of_leaving<work_date)
    or (e.status<>'active' and (e.date_of_leaving is null or e.date_of_leaving='')) then
    raise exception 'Punch employee or employment date does not match this client unit';
  end if;
  if new.source like 'biometric_%' then
    select * into d from public.attendance_devices where id=new.device_id for share;
    if d.id is null or d.status<>'active' or d.client_unit_id<>new.client_unit_id or not exists (
      select 1 from public.attendance_device_mappings m where m.device_id=d.id
      and m.device_user_id=new.device_user_id and m.employee_id=e.id and m.status='active'
    ) then raise exception 'Device or employee mapping is inactive or outside this unit'; end if;
  elsif new.device_id is not null then raise exception 'Only biometric punches may specify a device';
  end if;
  if new.source<>'hr_correction' then
    -- Serialize captures for an employee across QR and all devices; a second scan cannot flip OUT.
    if exists(select 1 from public.attendance_punches where event_key=new.event_key) then return null; end if;
    select * into previous from public.attendance_punches where employee_id=e.id and status<>'ignored' order by punched_at desc,id desc limit 1;
    if previous.id is not null then
      if new.punched_at::timestamptz<previous.punched_at::timestamptz then raise exception 'Out-of-order punch requires HR missed-punch correction'; end if;
      if new.punched_at::timestamptz<previous.punched_at::timestamptz+interval '10 minutes' then return null; end if;
    end if;
    new.direction := case when previous.direction='in' and new.punched_at::timestamptz<=previous.punched_at::timestamptz+interval '24 hours' then 'out' else 'in' end;
    if new.direction='out' then new.shift_code:=previous.shift_code;
    else
      clock_minute:=extract(hour from new.punched_at::timestamptz at time zone 'Asia/Kolkata')*60+extract(minute from new.punched_at::timestamptz at time zone 'Asia/Kolkata');
      select s.name into picked from public.shift_definitions s where s.vendor_id=e.vendor_id and (s.client_unit_id is null or s.client_unit_id=e.client_unit_id) and s.status='active'
        and (s.name=e.default_shift or (e.shift_pattern='rotational' and s.name in(select jsonb_array_elements_text(e.applicable_shifts_json::jsonb))))
        order by least(abs(clock_minute-(extract(hour from s.start_time::time)*60+extract(minute from s.start_time::time))),1440-abs(clock_minute-(extract(hour from s.start_time::time)*60+extract(minute from s.start_time::time)))),(s.name=e.default_shift) desc,s.name limit 1;
      if picked is null then raise exception 'Configure an eligible employee-master shift before capturing attendance'; end if;
      new.shift_code:=picked;
    end if;
  end if;
  return new;
end $$;
create trigger attendance_punch_scope before insert on public.attendance_punches for each row execute function public.validate_attendance_punch();
revoke all on function public.validate_attendance_punch() from public,anon,authenticated;

-- Service-only, invoked after verified JWT, active DB profile, permission and unit checks.
-- Locks the employee, affected runs and attendance row in the same transaction as posting.
create function public.post_captured_attendance(
 p_unit text,p_employee text,p_date text,p_ids text[],p_values jsonb,p_actor text,p_expected text,p_approval text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare e public.employees; r public.payroll_runs; existing public.attendance_entries; count_pending integer; updated text;
begin
  if cardinality(p_ids) not between 2 and 100 or cardinality(p_ids)<>(select count(distinct x) from unnest(p_ids) x) then raise exception 'Select complete punch pairs (maximum 100 punches)'; end if;
  if p_date !~ '^\d{4}-\d{2}-\d{2}$' or to_char(p_date::date,'YYYY-MM-DD')<>p_date then raise exception 'Invalid attendance date'; end if;
  if p_values->>'statusCode' not in ('P','HD','A','L','WO','H','HP') or coalesce(p_values->>'shiftCode','')='' then raise exception 'Invalid attendance status or shift'; end if;
  if (p_values->>'overtimeHours')::numeric not between 0 and 24 or (p_values->>'workedHours')::numeric not between 0 and 24 then raise exception 'Invalid attendance hours'; end if;
  select * into e from public.employees where id=p_employee for update;
  if e.id is null or e.client_unit_id<>p_unit or p_date<e.date_of_joining or (nullif(e.date_of_leaving,'') is not null and p_date>e.date_of_leaving) then raise exception 'Employee or attendance date does not belong to this employment'; end if;
  for r in select * from public.payroll_runs where client_unit_id=p_unit
      and p_date>=coalesce(nullif(period_start,''),pay_period||'-01')
      and p_date<=coalesce(nullif(period_end,''),to_char((pay_period||'-01')::date+interval '1 month - 1 day','YYYY-MM-DD'))
      order by id for update loop
    if r.status='approved' or exists(select 1 from public.payment_export_batches b where b.run_id=r.id and b.status='downloaded') then
      raise exception 'Approved payroll or downloaded bank payments lock attendance for this date';
    end if;
  end loop;
  perform id from public.attendance_punches where id=any(p_ids) order by id for update;
  select count(*) into count_pending from public.attendance_punches where id=any(p_ids) and employee_id=p_employee and client_unit_id=p_unit and status='pending';
  if count_pending<>cardinality(p_ids) then raise exception 'Punches changed or were already reviewed. Refresh before posting'; end if;
  select * into existing from public.attendance_entries where employee_id=p_employee and attendance_date=p_date for update;
  if existing.id is not null and (p_expected is null or existing.updated_at<>p_expected) then raise exception 'Attendance already exists or changed. Refresh and explicitly replace it'; end if;
  if existing.id is null and p_expected is not null then raise exception 'Attendance changed. Refresh before posting'; end if;
  if existing.id is not null and length(trim(coalesce(p_values->>'remarks','')))<5 then raise exception 'A replacement reason is required'; end if;
  updated := to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  insert into public.attendance_entries(employee_id,attendance_date,status_code,shift_code,overtime_hours,punch_in,punch_out,worked_hours,deduction_hours,remarks,source,updated_by,updated_at)
  values(p_employee,p_date,p_values->>'statusCode',p_values->>'shiftCode',(p_values->>'overtimeHours')::float,p_values->>'punchIn',p_values->>'punchOut',(p_values->>'workedHours')::float,(p_values->>'deductionHours')::float,p_values->>'remarks','capture:'||p_approval,p_actor,updated)
  on conflict(employee_id,attendance_date) do update set status_code=excluded.status_code,shift_code=excluded.shift_code,overtime_hours=excluded.overtime_hours,punch_in=excluded.punch_in,punch_out=excluded.punch_out,worked_hours=excluded.worked_hours,deduction_hours=excluded.deduction_hours,remarks=excluded.remarks,source=excluded.source,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
  update public.attendance_punches set status='posted',attendance_date=p_date,approval_id=p_approval,reviewed_by=p_actor,reviewed_at=updated where id=any(p_ids);
  insert into public.audit_events(action,entity_type,entity_id,summary,actor_email,created_at)
  values('attendance_capture_posted','attendance',p_employee,
    'Posted '||cardinality(p_ids)||' punches on '||p_date||'. Approval '||p_approval||'. Values: '||p_values::text||case when existing.id is not null then '. Previous: '||row_to_json(existing)::text else '' end,p_actor,updated);
  return jsonb_build_object('posted',cardinality(p_ids),'attendanceDate',p_date,'approvalId',p_approval);
end $$;
revoke all on function public.post_captured_attendance(text,text,text,text[],jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.post_captured_attendance(text,text,text,text[],jsonb,text,text,text) to service_role;

create table public.client_attendance_records (
 id text primary key,run_id text not null references public.payroll_runs(id) on delete cascade,
 employee_id text not null references public.employees(id),attendance_date text not null,
 status_code text not null check(status_code in ('P','HD','A','L','WO','H','HP')),
 shift_code text not null,overtime_hours double precision not null default 0 check(overtime_hours between 0 and 24),
 source_file text,updated_by text,updated_at text not null,
 unique(run_id,employee_id,attendance_date)
);
create index client_attendance_records_employee_idx on public.client_attendance_records(employee_id);
create table public.payroll_attendance_confirmations (
 run_id text primary key references public.payroll_runs(id) on delete cascade,
 source text not null default 'system' check(source in ('system','client_attendance','client_salary')),
 status text not null default 'pending' check(status in ('pending','confirmed')),
 notes text,confirmed_by text,confirmed_at text,client_salary_imported_at text,client_file text
);
alter table public.client_attendance_records enable row level security;
alter table public.payroll_attendance_confirmations enable row level security;
revoke all on public.client_attendance_records,public.payroll_attendance_confirmations from anon,authenticated;
grant all on public.client_attendance_records,public.payroll_attendance_confirmations to service_role;

create function public.payroll_attendance_review(p_run text) returns jsonb language sql stable security invoker set search_path='' as $$
 with run as (select *,coalesce(nullif(period_start,''),pay_period||'-01')::date first_day,
 coalesce(nullif(period_end,''),to_char((pay_period||'-01')::date+interval '1 month - 1 day','YYYY-MM-DD'))::date last_day from public.payroll_runs where id=p_run),
 staff as (select e.* from public.employees e join public.payroll_items i on i.employee_id=e.id where i.run_id=p_run),
 expected as (select s.id employee_id,to_char(d,'YYYY-MM-DD') as calendar_day from staff s cross join run r
 cross join lateral generate_series(greatest(r.first_day,s.date_of_joining::date),least(r.last_day,coalesce(nullif(s.date_of_leaving,'')::date,r.last_day)),interval '1 day') d),
 actual as (select a.* from public.attendance_entries a join staff s on s.id=a.employee_id cross join run r where a.attendance_date between r.first_day::text and r.last_day::text),
 client as (select * from public.client_attendance_records where run_id=p_run),
 summary as (select s.id,s.employee_code,s.name,
 coalesce((select sum(case when status_code in ('P','HP') then 1 when status_code='HD' then .5 else 0 end) from actual where employee_id=s.id),0) system_days,
 coalesce((select sum(overtime_hours) from actual where employee_id=s.id),0) system_ot,
 coalesce((select sum(case when status_code in ('P','HP') then 1 when status_code='HD' then .5 else 0 end) from client where employee_id=s.id),0) client_days,
 coalesce((select sum(overtime_hours) from client where employee_id=s.id),0) client_ot,
 (select count(*) from expected x where x.employee_id=s.id and not exists(select 1 from actual a where a.employee_id=x.employee_id and a.attendance_date=x.calendar_day)) system_missing,
 (select count(*) from expected x where x.employee_id=s.id and not exists(select 1 from client c where c.employee_id=x.employee_id and c.attendance_date=x.calendar_day)) client_missing
 from staff s)
 select jsonb_build_object('runId',p_run,'confirmation',(select row_to_json(c) from public.payroll_attendance_confirmations c where run_id=p_run),
 'systemRecords',(select count(*) from actual),'clientRecords',(select count(*) from client),
 'missingSystemDays',(select coalesce(sum(system_missing),0) from summary),'missingClientDays',(select coalesce(sum(client_missing),0) from summary),
 'pendingPunches',(select count(*) from public.attendance_punches p cross join run r where p.client_unit_id=r.client_unit_id and p.status='pending'
 and (p.punched_at::timestamptz at time zone 'Asia/Kolkata')::date between r.first_day and r.last_day),
 'employees',coalesce((select jsonb_agg(summary order by employee_code) from summary),'[]'::jsonb));
$$;
revoke all on function public.payroll_attendance_review(text) from public,anon,authenticated;
grant execute on function public.payroll_attendance_review(text) to service_role;

create function public.confirm_payroll_attendance(p_run text,p_source text,p_actor text,p_notes text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.payroll_runs; review jsonb;
begin
 select * into r from public.payroll_runs where id=p_run for update;
 if r.id is null or r.status='approved' or exists(select 1 from public.payment_export_batches where run_id=p_run and status='downloaded') then raise exception 'Approved or paid payroll cannot change its attendance source'; end if;
 if p_source not in ('system','client_attendance','client_salary') or length(trim(coalesce(p_notes,'')))<5 then raise exception 'Choose an attendance source and enter the final review note'; end if;
 review:=public.payroll_attendance_review(p_run);
 if jsonb_array_length(review->'employees')=0 then raise exception 'Add payroll employees before confirming attendance'; end if;
 if p_source='client_salary' then
   if r.processing_mode<>'salary_import' or not exists(select 1 from public.payroll_attendance_confirmations where run_id=p_run and client_salary_imported_at is not null) then raise exception 'Import the client salary register before confirming this source'; end if;
 else
   if r.processing_mode='salary_import' then raise exception 'This payroll uses a client salary register. Use an attendance-mode payroll for daily attendance'; end if;
   if p_source='client_attendance' and ((review->>'clientRecords')::int=0 or (review->>'missingClientDays')::int>0) then raise exception 'Client file is incomplete. Upload attendance for every payroll employee and employment date, including WO/H/A days'; end if;
   if p_source='system' and ((review->>'systemRecords')::int=0 or (review->>'pendingPunches')::int>0) then raise exception 'Post or resolve pending punches and review system attendance before final confirmation'; end if;
 end if;
 insert into public.payroll_attendance_confirmations(run_id,source,status,notes,confirmed_by,confirmed_at)
 values(p_run,p_source,'confirmed',p_notes,p_actor,now()::text)
 on conflict(run_id) do update set source=excluded.source,status=excluded.status,notes=excluded.notes,confirmed_by=excluded.confirmed_by,confirmed_at=excluded.confirmed_at;
 insert into public.audit_events(action,entity_type,entity_id,summary,actor_email,created_at)
 values('attendance_source_confirmed','payroll_run',p_run,'Final salary source: '||p_source||'. '||p_notes,p_actor,now()::text);
 return jsonb_build_object('confirmed',true,'source',p_source);
end $$;
revoke all on function public.confirm_payroll_attendance(text,text,text,text) from public,anon,authenticated;
grant execute on function public.confirm_payroll_attendance(text,text,text,text) to service_role;

create function public.invalidate_attendance_confirmation() returns trigger language plpgsql set search_path='' as $$
declare emp text;work_day text;target_run text;
begin
 if tg_table_name='client_attendance_records' then
   target_run:=coalesce(new.run_id,old.run_id);
   update public.payroll_attendance_confirmations set status='pending' where run_id=target_run and source='client_attendance';
 elsif tg_table_name='payroll_items' then
   target_run:=coalesce(new.run_id,old.run_id);
   update public.payroll_attendance_confirmations set status='pending' where run_id=target_run;
 else
   emp:=coalesce(new.employee_id,old.employee_id); work_day:=coalesce(new.attendance_date,old.attendance_date);
   update public.payroll_attendance_confirmations c set status='pending' from public.payroll_runs r,public.employees e
   where c.run_id=r.id and c.source='system' and e.id=emp and r.client_unit_id=e.client_unit_id
   and work_day>=coalesce(nullif(r.period_start,''),r.pay_period||'-01')
   and work_day<=coalesce(nullif(r.period_end,''),to_char((r.pay_period||'-01')::date+interval '1 month - 1 day','YYYY-MM-DD'));
 end if;
 return coalesce(new,old);
end $$;
create trigger attendance_confirmation_changed after insert or update or delete on public.attendance_entries for each row execute function public.invalidate_attendance_confirmation();
create trigger client_attendance_confirmation_changed after insert or update or delete on public.client_attendance_records for each row execute function public.invalidate_attendance_confirmation();
create trigger payroll_staff_confirmation_changed after insert or delete on public.payroll_items for each row execute function public.invalidate_attendance_confirmation();
revoke all on function public.invalidate_attendance_confirmation() from public,anon,authenticated;

create function public.check_payroll_attendance_confirmation() returns trigger language plpgsql set search_path='' as $$
begin
 if new.period_start is distinct from old.period_start or new.period_end is distinct from old.period_end or new.processing_mode is distinct from old.processing_mode or (old.status='approved' and new.status<>'approved') then
   update public.payroll_attendance_confirmations set status='pending' where run_id=new.id;
 end if;
 if new.status='approved' and old.status<>'approved' and not exists(select 1 from public.payroll_attendance_confirmations where run_id=new.id and status='confirmed') then
   raise exception 'Confirm the final system or client attendance source before payroll approval';
 end if;
 return new;
end $$;
create trigger payroll_attendance_approval_gate before update on public.payroll_runs for each row execute function public.check_payroll_attendance_confirmation();
revoke all on function public.check_payroll_attendance_confirmation() from public,anon,authenticated;

-- One database round trip per biometric batch, with row-level failures reported separately.
create function public.ingest_attendance_punches(p_rows jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare item jsonb; affected integer; saved integer:=0; ignored integer:=0; rejected jsonb:='[]'::jsonb;
begin
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>500 then raise exception 'Maximum 500 punch rows per batch'; end if;
 for item in select value from jsonb_array_elements(p_rows) order by value->>'punched_at',value->>'id' loop
  begin
   insert into public.attendance_punches(id,client_unit_id,employee_id,device_id,device_user_id,punched_at,direction,source,event_key,external_event_id,shift_code,status,created_by,created_at)
   values(item->>'id',item->>'client_unit_id',item->>'employee_id',item->>'device_id',item->>'device_user_id',item->>'punched_at',item->>'direction',item->>'source',item->>'event_key',item->>'external_event_id',item->>'shift_code','pending',item->>'created_by',item->>'created_at')
   on conflict(event_key) do nothing;
   get diagnostics affected=row_count;
   if affected=1 then saved:=saved+1; else ignored:=ignored+1; end if;
  exception when unique_violation then
   rejected:=rejected||jsonb_build_array(jsonb_build_object('row',(item->>'row_index')::int,'reason','Event ID was already used for another punch. Review the source file.'));
  when raise_exception then
   rejected:=rejected||jsonb_build_array(jsonb_build_object('row',(item->>'row_index')::int,'reason',sqlerrm));
  end;
 end loop;
 return jsonb_build_object('inserted',saved,'duplicates',ignored,'rejected',rejected);
end $$;
revoke all on function public.ingest_attendance_punches(jsonb) from public,anon,authenticated;
grant execute on function public.ingest_attendance_punches(jsonb) to service_role;
