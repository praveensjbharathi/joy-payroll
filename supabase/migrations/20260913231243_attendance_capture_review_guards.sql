-- Preserve the assigned workday on raw punches and invalidate final confirmation on later captures.
create or replace function public.validate_attendance_punch() returns trigger
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
  select s.name into picked from public.shift_definitions s where s.vendor_id=e.vendor_id and s.name=new.shift_code limit 1;
  new.attendance_date := to_char(new.punched_at::timestamptz at time zone 'Asia/Kolkata','YYYY-MM-DD');
  if new.direction='out' and new.source<>'hr_correction' and previous.attendance_date is not null then
    new.attendance_date:=previous.attendance_date;
  elsif exists(select 1 from public.shift_definitions s where s.vendor_id=e.vendor_id and s.name=picked and s.end_time::time<=s.start_time::time
    and (new.punched_at::timestamptz at time zone 'Asia/Kolkata')::time<s.end_time::time) then
    new.attendance_date:=to_char((new.attendance_date::date-1),'YYYY-MM-DD');
  end if;
  return new;
end $$;
create or replace function public.invalidate_attendance_confirmation() returns trigger language plpgsql set search_path='' as $$
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
create trigger raw_punch_confirmation_changed after insert or update or delete on public.attendance_punches for each row execute function public.invalidate_attendance_confirmation();
create or replace function public.payroll_attendance_review(p_run text) returns jsonb language sql stable security invoker set search_path='' as $$
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
 and coalesce(p.attendance_date,(p.punched_at::timestamptz at time zone 'Asia/Kolkata')::date::text) between r.first_day::text and r.last_day::text),
 'employees',coalesce((select jsonb_agg(summary order by employee_code) from summary),'[]'::jsonb));
$$;
