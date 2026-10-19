CREATE TABLE `application_answer_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`question_id` text NOT NULL,
	`version` integer NOT NULL,
	`question` text NOT NULL,
	`character_limit` integer,
	`answer` text NOT NULL,
	`origin` text DEFAULT 'manual' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `application_answer_revision_unique` ON `application_answer_revisions` (`user_id`,`question_id`,`version`);--> statement-breakpoint
CREATE TABLE `application_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`job_id` text NOT NULL,
	`question` text NOT NULL,
	`character_limit` integer,
	`answer` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
