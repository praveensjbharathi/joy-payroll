ALTER TABLE `hostels` ADD `accommodation_type_id` text REFERENCES `accommodation_types`(`id`);
CREATE INDEX `hostels_accommodation_type_idx` ON `hostels` (`accommodation_type_id`);
