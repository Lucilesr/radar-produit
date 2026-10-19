CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`original_name` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`title` text NOT NULL,
	`company` text DEFAULT 'Entreprise non précisée' NOT NULL,
	`contract_type` text DEFAULT 'other' NOT NULL,
	`annual_salary` integer,
	`daily_rate` integer,
	`remote_mode` text DEFAULT 'unknown' NOT NULL,
	`onsite_cadence` text,
	`language` text DEFAULT 'unknown' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_url` text,
	`contact` text,
	`description` text DEFAULT '' NOT NULL,
	`published_at` text,
	`status` text DEFAULT 'new' NOT NULL,
	`match_score` integer DEFAULT 0 NOT NULL,
	`match_tier` text DEFAULT 'exception' NOT NULL,
	`reasons` text DEFAULT '[]' NOT NULL,
	`flags` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_user_fingerprint_unique` ON `jobs` (`user_id`,`fingerprint`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
