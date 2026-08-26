ALTER TABLE `client_units` ADD `attendance_cycle_start_day` integer DEFAULT 1 NOT NULL;
ALTER TABLE `client_units` ADD `attendance_cycle_end_day` integer DEFAULT 31 NOT NULL;
ALTER TABLE `client_units` ADD `attendance_working_days` integer DEFAULT 26 NOT NULL;
ALTER TABLE `client_units` ADD `payslip_earnings_json` text DEFAULT '["basic","da","hra","conveyance","foodAllowance","nightAllowance","overtimeWages","attendanceBonus","arrears","holidayWages","productionIncentive","medicalAllowance"]' NOT NULL;
ALTER TABLE `client_units` ADD `payslip_deductions_json` text DEFAULT '["pfDeduction","esiDeduction","professionalTax","lwf","canteen","snacks","tent","advance","otherDeduction","tds","medicalInsurance","accommodationDeduction"]' NOT NULL;
