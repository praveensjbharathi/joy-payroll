CREATE TABLE `accommodation_room_expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`pay_period` text NOT NULL,
	`gas_amount` real DEFAULT 0 NOT NULL,
	`ration_amount` real DEFAULT 0 NOT NULL,
	`provision_amount` real DEFAULT 0 NOT NULL,
	`occupant_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`notes` text,
	`finalized_by` text,
	`finalized_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `accommodation_rooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accommodation_room_period_unique` ON `accommodation_room_expenses` (`room_id`,`pay_period`);--> statement-breakpoint
CREATE TABLE `accommodation_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor_id` text NOT NULL,
	`accommodation_type_id` text NOT NULL,
	`room_number` text NOT NULL,
	`capacity` integer DEFAULT 0 NOT NULL,
	`address` text,
	`remarks` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`accommodation_type_id`) REFERENCES `accommodation_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accommodation_room_client_type_number_unique` ON `accommodation_rooms` (`vendor_id`,`accommodation_type_id`,`room_number`);--> statement-breakpoint
CREATE TABLE `accommodation_types` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor_id` text NOT NULL,
	`name` text NOT NULL,
	`remarks` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accommodation_type_client_name_unique` ON `accommodation_types` (`vendor_id`,`name`);--> statement-breakpoint
CREATE TABLE `payroll_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`accommodation_type` text NOT NULL,
	`employee_count` integer DEFAULT 0 NOT NULL,
	`gross_earnings` real DEFAULT 0 NOT NULL,
	`net_payable` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'prepared' NOT NULL,
	`payment_reference` text,
	`prepared_by` text,
	`prepared_at` text,
	`cleared_by` text,
	`cleared_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `payroll_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_batch_run_accommodation_unique` ON `payroll_batches` (`run_id`,`accommodation_type`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_employees` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor_id` text NOT NULL,
	`client_unit_id` text NOT NULL,
	`employee_code` text NOT NULL,
	`name` text NOT NULL,
	`department` text NOT NULL,
	`date_of_joining` text NOT NULL,
	`date_of_leaving` text,
	`uan_masked` text,
	`esi_masked` text,
	`bank_account_masked` text,
	`ifsc_masked` text,
	`bank_name` text,
	`accommodation_type` text DEFAULT 'Tamil' NOT NULL,
	`room_id` text,
	`room_number` text,
	`payment_mode` text DEFAULT 'bank' NOT NULL,
	`salary_amount` real DEFAULT 0 NOT NULL,
	`salary_basis` text DEFAULT 'monthly' NOT NULL,
	`default_shift` text DEFAULT 'General' NOT NULL,
	`remarks` text,
	`compliance_status` text DEFAULT 'ready' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_unit_id`) REFERENCES `client_units`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`room_id`) REFERENCES `accommodation_rooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_employees`("id", "vendor_id", "client_unit_id", "employee_code", "name", "department", "date_of_joining", "date_of_leaving", "uan_masked", "esi_masked", "bank_account_masked", "ifsc_masked", "bank_name", "accommodation_type", "room_id", "room_number", "payment_mode", "salary_amount", "salary_basis", "default_shift", "remarks", "compliance_status", "status") SELECT "id", "vendor_id", "client_unit_id", "employee_code", "name", "department", "date_of_joining", NULL, "uan_masked", "esi_masked", "bank_account_masked", "ifsc_masked", "bank_name", CASE WHEN "accommodation_type" = 'Tamil Own' THEN 'Tamil' ELSE "accommodation_type" END, NULL, "room_number", "payment_mode", "salary_amount", "salary_basis", "default_shift", "remarks", "compliance_status", "status" FROM `employees`;--> statement-breakpoint
DROP TABLE `employees`;--> statement-breakpoint
ALTER TABLE `__new_employees` RENAME TO `employees`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `employees_employee_code_unique` ON `employees` (`employee_code`);--> statement-breakpoint
ALTER TABLE `accommodation_charges` ADD `room_expense_id` text REFERENCES accommodation_room_expenses(id);--> statement-breakpoint
ALTER TABLE `accommodation_charges` ADD `gas_share` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `accommodation_charges` ADD `provision_share` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `app_users` ADD `client_scope_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_users` ADD `unit_scope_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `client_units` ADD `payslip_title` text;--> statement-breakpoint
ALTER TABLE `client_units` ADD `payslip_subtitle` text;--> statement-breakpoint
ALTER TABLE `client_units` ADD `payslip_address` text;--> statement-breakpoint
ALTER TABLE `client_units` ADD `payslip_contact` text;--> statement-breakpoint
ALTER TABLE `client_units` ADD `payslip_footer` text;--> statement-breakpoint
ALTER TABLE `payroll_runs` ADD `period_start` text;--> statement-breakpoint
ALTER TABLE `payroll_runs` ADD `period_end` text;--> statement-breakpoint
ALTER TABLE `payroll_runs` ADD `working_days` integer DEFAULT 26 NOT NULL;
