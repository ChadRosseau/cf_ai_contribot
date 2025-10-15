CREATE TABLE `user_favourites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `user_favourites_user_id_idx` ON `user_favourites` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_favourites_entity_type_id_idx` ON `user_favourites` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_favourites_user_id_entity_type_entity_id_unique` ON `user_favourites` (`user_id`,`entity_type`,`entity_id`);