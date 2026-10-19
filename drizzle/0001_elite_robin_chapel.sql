CREATE TABLE `interviews` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`job_id` text NOT NULL,
	`label` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`time_zone` text NOT NULL,
	`format` text DEFAULT 'video' NOT NULL,
	`state` text DEFAULT 'planned' NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`reminded_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `source_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source` text NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_settings_user_source_unique` ON `source_settings` (`user_id`,`source`);--> statement-breakpoint
ALTER TABLE `jobs` ADD `application_url` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `content_coverage` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `notification_at` text;