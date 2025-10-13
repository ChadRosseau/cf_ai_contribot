DROP TABLE `ai_summary_queue`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_repos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`github_url` text NOT NULL,
	`languages_ordered` text,
	`languages_raw` text,
	`good_first_issue_tag` text NOT NULL,
	`data_source_id` text NOT NULL,
	`metadata_hash` text NOT NULL,
	`processing_status` text DEFAULT 'pending' NOT NULL,
	`processed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_repos`("id", "owner", "name", "github_url", "languages_ordered", "languages_raw", "good_first_issue_tag", "data_source_id", "metadata_hash", "processing_status", "processed_at", "created_at", "updated_at") SELECT "id", "owner", "name", "github_url", "languages_ordered", "languages_raw", "good_first_issue_tag", "data_source_id", "metadata_hash", "processing_status", "processed_at", "created_at", "updated_at" FROM `repos`;--> statement-breakpoint
DROP TABLE `repos`;--> statement-breakpoint
ALTER TABLE `__new_repos` RENAME TO `repos`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `repos_metadata_hash_unique` ON `repos` (`metadata_hash`);--> statement-breakpoint
CREATE INDEX `repos_metadata_hash_idx` ON `repos` (`metadata_hash`);--> statement-breakpoint
CREATE INDEX `repos_processing_status_idx` ON `repos` (`processing_status`);--> statement-breakpoint
CREATE INDEX `repos_updated_at_idx` ON `repos` (`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `repos_owner_name_unique` ON `repos` (`owner`,`name`);--> statement-breakpoint
ALTER TABLE `issues` ADD `processing_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `issues` ADD `processed_at` integer;--> statement-breakpoint
CREATE INDEX `issues_processing_status_idx` ON `issues` (`processing_status`);--> statement-breakpoint
CREATE INDEX `issues_updated_at_idx` ON `issues` (`updated_at`);