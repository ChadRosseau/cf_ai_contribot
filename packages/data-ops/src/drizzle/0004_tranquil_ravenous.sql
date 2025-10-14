ALTER TABLE `auth_user` ADD `preferred_languages` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `auth_user` ADD `difficulty_preference` integer DEFAULT 3;--> statement-breakpoint
ALTER TABLE `auth_user` ADD `onboarding_completed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `auth_user` ADD `onboarded_at` integer;