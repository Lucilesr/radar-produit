CREATE TABLE `application_boards` (
	`user_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `jobs` ADD `board_column_id` text;