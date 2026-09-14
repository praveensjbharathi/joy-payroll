-- Client attendance must follow the current custom payroll period.
create or replace function public.payroll_attendance_review(p_run text) returns jsonb language sql stable security invoker set search_path='' as $$
 with run as (select *,coalesce(nullif(period_start,''),pay_period||'-01')::date first_day,
 coalesce(nullif(period_end,''),to_char((pay_period||'-01')::date+interval '1 month - 1 day','YYYY-MM-DD'))::date last_day from public.payroll_runs where id=p_run),
 staff as (select e.* from public.employees e join public.payroll_items i on i.employee_id=e.id where i.run_id=p_run),
 expected as (select s.id employee_id,to_char(d,'YYYY-MM-DD') as calendar_day from staff s cross join run r
 cross join lateral generate_series(greatest(r.first_day,s.date_of_joining::date),least(r.last_day,coalesce(nullif(s.date_of_leaving,'')::date,r.last_day)),interval '1 day') d),
 actual as (select a.* from public.attendance_entries a join staff s on s.id=a.employee_id cross join run r where a.attendance_date between r.first_day::text and r.last_day::text),
 client as (select c.* from public.client_attendance_records c cross join run r where c.run_id=p_run and c.attendance_date between r.first_day::text and r.last_day::text),
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
