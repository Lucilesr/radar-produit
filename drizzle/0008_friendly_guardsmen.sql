CREATE TABLE `application_answer_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`job_id` text NOT NULL,
	`question_id` text NOT NULL,
	`question_text` text NOT NULL,
	`character_limit` integer,
	`answer` text NOT NULL,
	`language` text NOT NULL,
	`context_digest` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `application_proposals_user_question_idx` ON `application_answer_proposals` (`user_id`,`question_id`,`created_at`);