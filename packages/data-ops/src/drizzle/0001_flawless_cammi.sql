CREATE TABLE `ai_summaries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer NOT NULL,
	`repo_summary` text,
	`issue_intro` text,
	`difficulty_score` integer,
	`first_steps` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_summaries_difficulty_score_idx` ON `ai_summaries` (`difficulty_score`);--> statement-breakpoint
CREATE UNIQUE INDEX `ai_summaries_entity_type_entity_id_unique` ON `ai_summaries` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `ai_summary_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`error_message` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`processed_at` integer
);
--> statement-breakpoint
CREATE INDEX `ai_queue_status_priority_idx` ON `ai_summary_queue` (`status`,`priority`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_queue_entity_type_id_idx` ON `ai_summary_queue` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `issues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`repo_id` integer NOT NULL,
	`github_issue_number` integer NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`state` text NOT NULL,
	`comment_count` integer NOT NULL,
	`assignee_status` text,
	`github_url` text NOT NULL,
	`metadata_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`scraped_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`repo_id`) REFERENCES `repos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `issues_metadata_hash_idx` ON `issues` (`metadata_hash`);--> statement-breakpoint
CREATE INDEX `issues_state_idx` ON `issues` (`state`);--> statement-breakpoint
CREATE INDEX `issues_repo_id_idx` ON `issues` (`repo_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `issues_repo_id_github_issue_number_unique` ON `issues` (`repo_id`,`github_issue_number`);--> statement-breakpoint
CREATE TABLE `repos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`github_url` text NOT NULL,
	`languages_ordered` text NOT NULL,
	`languages_raw` text NOT NULL,
	`good_first_issue_tag` text NOT NULL,
	`data_source_id` text NOT NULL,
	`metadata_hash` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repos_metadata_hash_unique` ON `repos` (`metadata_hash`);--> statement-breakpoint
CREATE INDEX `repos_metadata_hash_idx` ON `repos` (`metadata_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `repos_owner_name_unique` ON `repos` (`owner`,`name`);