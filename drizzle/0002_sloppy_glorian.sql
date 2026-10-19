CREATE TABLE `document_extractions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`document_id` text NOT NULL,
	`digest` text NOT NULL,
	`status` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_extraction_unique` ON `document_extractions` (`user_id`,`document_id`,`digest`);--> statement-breakpoint
CREATE TABLE `experience_conflicts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`left_id` text NOT NULL,
	`right_id` text NOT NULL,
	`reason` text NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`resolution` text,
	`created_at` text NOT NULL,
	`resolved_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `experience_conflict_pair_unique` ON `experience_conflicts` (`user_id`,`left_id`,`right_id`);--> statement-breakpoint
CREATE TABLE `experience_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`parent_id` text,
	`data` text NOT NULL,
	`validation` text DEFAULT 'proposed' NOT NULL,
	`application_allowed` integer DEFAULT false NOT NULL,
	`public_profile_allowed` integer DEFAULT false NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`import_key` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `experience_import_unique` ON `experience_items` (`user_id`,`import_key`);--> statement-breakpoint
CREATE TABLE `experience_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`item_id` text NOT NULL,
	`version` integer NOT NULL,
	`snapshot` text NOT NULL,
	`action` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `experience_revision_unique` ON `experience_revisions` (`user_id`,`item_id`,`version`);