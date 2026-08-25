CREATE TABLE `payroll_remarks` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor_id` text NOT NULL,
	`title` text NOT NULL,
	`category` text DEFAULT 'general' NOT NULL,
	`notes` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shift_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor_id` text NOT NULL,
	`name` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`remarks` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shift_client_name_unique` ON `shift_definitions` (`vendor_id`,`name`);--> statement-breakpoint
ALTER TABLE `attendance_entries` ADD `remarks` text;--> statement-breakpoint
ALTER TABLE `client_units` ADD `remarks` text;--> statement-breakpoint
ALTER TABLE `employees` ADD `remarks` text;--> statement-breakpoint
ALTER TABLE `vendors` ADD `remarks` text;--> statement-breakpoint
INSERT INTO `shift_definitions` (`id`, `vendor_id`, `name`, `start_time`, `end_time`, `status`)
SELECT 'SHIFT-' || `vendors`.`id` || '-' || `defaults`.`suffix`, `vendors`.`id`, `defaults`.`name`, `defaults`.`start_time`, `defaults`.`end_time`, 'active'
FROM `vendors`
CROSS JOIN (
  SELECT 'general' AS `suffix`, 'General' AS `name`, '09:00' AS `start_time`, '18:00' AS `end_time`
  UNION ALL SELECT 'first', '1st Shift', '06:00', '14:00'
  UNION ALL SELECT 'second', '2nd Shift', '14:00', '22:00'
  UNION ALL SELECT 'third', '3rd Shift', '22:00', '06:00'
) AS `defaults`;
