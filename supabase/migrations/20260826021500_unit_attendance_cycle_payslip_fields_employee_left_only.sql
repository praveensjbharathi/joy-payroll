begin;

alter table public.client_units
  add column if not exists attendance_cycle_start_day integer not null default 1,
  add column if not exists attendance_cycle_end_day integer not null default 31,
  add column if not exists attendance_working_days integer not null default 26,
  add column if not exists payslip_earnings_json text not null default '["basic","da","hra","conveyance","foodAllowance","nightAllowance","overtimeWages","attendanceBonus","arrears","holidayWages","productionIncentive","medicalAllowance"]',
  add column if not exists payslip_deductions_json text not null default '["pfDeduction","esiDeduction","professionalTax","lwf","canteen","snacks","tent","advance","otherDeduction","tds","medicalInsurance","accommodationDeduction"]';

alter table public.client_units
  drop constraint if exists client_units_attendance_cycle_start_day_check,
  add constraint client_units_attendance_cycle_start_day_check check (attendance_cycle_start_day between 1 and 31),
  drop constraint if exists client_units_attendance_cycle_end_day_check,
  add constraint client_units_attendance_cycle_end_day_check check (attendance_cycle_end_day between 1 and 31),
  drop constraint if exists client_units_attendance_working_days_check,
  add constraint client_units_attendance_working_days_check check (attendance_working_days between 1 and 31),
  drop constraint if exists client_units_payslip_earnings_json_check,
  add constraint client_units_payslip_earnings_json_check check (jsonb_typeof(payslip_earnings_json::jsonb) = 'array'),
  drop constraint if exists client_units_payslip_deductions_json_check,
  add constraint client_units_payslip_deductions_json_check check (jsonb_typeof(payslip_deductions_json::jsonb) = 'array');

update public.client_units
set payslip_earnings_json = '["basic","da","hra","conveyance","foodAllowance","nightAllowance","overtimeWages","attendanceBonus","arrears","holidayWages","productionIncentive","medicalAllowance"]'
where payslip_earnings_json = '[]';

update public.client_units
set payslip_deductions_json = '["pfDeduction","esiDeduction","professionalTax","lwf","canteen","snacks","tent","advance","otherDeduction","tds","medicalInsurance","accommodationDeduction"]'
where payslip_deductions_json = '[]';

comment on column public.client_units.attendance_cycle_start_day is 'Employer-unit attendance cycle start day; a start day greater than the end day begins in the previous month.';
comment on column public.client_units.attendance_cycle_end_day is 'Employer-unit attendance cycle inclusive end day.';
comment on column public.client_units.payslip_earnings_json is 'Validated payroll earning field keys displayed on this unit payslip.';
comment on column public.client_units.payslip_deductions_json is 'Validated payroll deduction field keys displayed on this unit payslip.';

commit;
