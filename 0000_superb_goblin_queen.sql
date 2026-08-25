CREATE TABLE `accommodation_charges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`room_number` text,
	`id_card` real DEFAULT 0 NOT NULL,
	`rent` real DEFAULT 0 NOT NULL,
	`bus` real DEFAULT 0 NOT NULL,
	`medical` real DEFAULT 0 NOT NULL,
	`ticket` real DEFAULT 0 NOT NULL,
	`shoe` real DEFAULT 0 NOT NULL,
	`advance` real DEFAULT 0 NOT NULL,
	`food` real DEFAULT 0 NOT NULL,
	`aadhaar_update` real DEFAULT 0 NOT NULL,
	`bank_account_charge` real DEFAULT 0 NOT NULL,
	`tshirt` real DEFAULT 0 NOT NULL,
	`old_pending` real DEFAULT 0 NOT NULL,
	`ration_share` real DEFAULT 0 NOT NULL,
	`return_amount` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `payroll_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `attendance_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` text NOT NULL,
	`attendance_date` text NOT NULL,
	`status_code` text NOT NULL,
	`shift_code` text NOT NULL,
	`overtime_hours` real DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`updated_by` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`summary` text NOT NULL,
	`actor_email` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `client_units` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor_id` text NOT NULL,
	`client_name` text NOT NULL,
	`unit_name` text NOT NULL,
	`location` text NOT NULL,
	`employee_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor_id` text NOT NULL,
	`client_unit_id` text NOT NULL,
	`employee_code` text NOT NULL,
	`name` text NOT NULL,
	`department` text NOT NULL,
	`date_of_joining` text NOT NULL,
	`uan_masked` text,
	`esi_masked` text,
	`bank_account_masked` text,
	`ifsc_masked` text,
	`bank_name` text,
	`accommodation_type` text DEFAULT 'Tamil Own' NOT NULL,
	`room_number` text,
	`payment_mode` text DEFAULT 'bank' NOT NULL,
	`compliance_status` text DEFAULT 'ready' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_unit_id`) REFERENCES `client_units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employees_employee_code_unique` ON `employees` (`employee_code`);--> statement-breakpoint
CREATE TABLE `payroll_items` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`present_days` real DEFAULT 0 NOT NULL,
	`absent_days` real DEFAULT 0 NOT NULL,
	`leave_days` real DEFAULT 0 NOT NULL,
	`week_off_days` real DEFAULT 0 NOT NULL,
	`holiday_present_days` real DEFAULT 0 NOT NULL,
	`payable_days` real DEFAULT 0 NOT NULL,
	`overtime_hours` real DEFAULT 0 NOT NULL,
	`basic` real DEFAULT 0 NOT NULL,
	`da` real DEFAULT 0 NOT NULL,
	`hra` real DEFAULT 0 NOT NULL,
	`conveyance` real DEFAULT 0 NOT NULL,
	`food_allowance` real DEFAULT 0 NOT NULL,
	`night_allowance` real DEFAULT 0 NOT NULL,
	`overtime_wages` real DEFAULT 0 NOT NULL,
	`attendance_bonus` real DEFAULT 0 NOT NULL,
	`arrears` real DEFAULT 0 NOT NULL,
	`holiday_wages` real DEFAULT 0 NOT NULL,
	`production_incentive` real DEFAULT 0 NOT NULL,
	`medical_allowance` real DEFAULT 0 NOT NULL,
	`pf_deduction` real DEFAULT 0 NOT NULL,
	`esi_deduction` real DEFAULT 0 NOT NULL,
	`professional_tax` real DEFAULT 0 NOT NULL,
	`lwf` real DEFAULT 0 NOT NULL,
	`canteen` real DEFAULT 0 NOT NULL,
	`snacks` real DEFAULT 0 NOT NULL,
	`tent` real DEFAULT 0 NOT NULL,
	`advance` real DEFAULT 0 NOT NULL,
	`other_deduction` real DEFAULT 0 NOT NULL,
	`tds` real DEFAULT 0 NOT NULL,
	`medical_insurance` real DEFAULT 0 NOT NULL,
	`accommodation_deduction` real DEFAULT 0 NOT NULL,
	`return_amount` real DEFAULT 0 NOT NULL,
	`gross_earnings` real DEFAULT 0 NOT NULL,
	`total_deductions` real DEFAULT 0 NOT NULL,
	`net_payable` real DEFAULT 0 NOT NULL,
	`validation_status` text DEFAULT 'ready' NOT NULL,
	`validation_message` text,
	FOREIGN KEY (`run_id`) REFERENCES `payroll_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payroll_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor_id` text NOT NULL,
	`client_unit_id` text NOT NULL,
	`pay_period` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`employee_count` integer DEFAULT 0 NOT NULL,
	`gross_earnings` real DEFAULT 0 NOT NULL,
	`statutory_deductions` real DEFAULT 0 NOT NULL,
	`other_deductions` real DEFAULT 0 NOT NULL,
	`accommodation_deductions` real DEFAULT 0 NOT NULL,
	`net_payable` real DEFAULT 0 NOT NULL,
	`bank_payable` real DEFAULT 0 NOT NULL,
	`cash_payable` real DEFAULT 0 NOT NULL,
	`issue_count` integer DEFAULT 0 NOT NULL,
	`approved_by` text,
	`approved_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_unit_id`) REFERENCES `client_units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`legal_name` text NOT NULL,
	`epf_code` text,
	`esi_code` text,
	`gstin` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vendors_code_unique` ON `vendors` (`code`);