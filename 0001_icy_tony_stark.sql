CREATE TABLE `payroll_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor_id` text NOT NULL,
	`standard_working_days` integer DEFAULT 26 NOT NULL,
	`pf_rate` real DEFAULT 0 NOT NULL,
	`esi_rate` real DEFAULT 0 NOT NULL,
	`professional_tax` real DEFAULT 0 NOT NULL,
	`lwf` real DEFAULT 0 NOT NULL,
	`overtime_hourly_rate` real DEFAULT 0 NOT NULL,
	`paid_leave` integer DEFAULT 0 NOT NULL,
	`paid_week_off` integer DEFAULT 0 NOT NULL,
	`effective_from` text DEFAULT '2026-01-01' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_rules_vendor_id_unique` ON `payroll_rules` (`vendor_id`);--> statement-breakpoint
ALTER TABLE `employees` ADD `salary_amount` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `employees` ADD `salary_basis` text DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE `employees` ADD `default_shift` text DEFAULT 'General' NOT NULL;