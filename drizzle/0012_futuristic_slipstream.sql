CREATE TABLE `workspace_writes` (
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`version` integer NOT NULL,
	`value` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `key`, `version`)
);
