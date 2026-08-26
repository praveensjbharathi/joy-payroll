ALTER TABLE `vendors` ADD `logo_data_url` text;
CREATE TABLE `recovery_entries` (
  `id` text PRIMARY KEY NOT NULL,
  `run_id` text NOT NULL REFERENCES `payroll_runs`(`id`),
  `employee_id` text NOT NULL REFERENCES `employees`(`id`),
  `recovery_date` text NOT NULL,
  `recovery_type` text NOT NULL,
  `amount` real DEFAULT 0 NOT NULL,
  `reference` text,
  `notes` text,
  `created_by` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX `recovery_entries_run_date_idx` ON `recovery_entries` (`run_id`,`recovery_date`);
CREATE INDEX `recovery_entries_employee_idx` ON `recovery_entries` (`employee_id`);
