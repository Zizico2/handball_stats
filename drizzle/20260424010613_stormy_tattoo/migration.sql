CREATE TABLE `pause_toggles` (
	`id` integer PRIMARY KEY,
	`user_id` text NOT NULL,
	`local_id` integer NOT NULL,
	`game_local_id` integer NOT NULL,
	`half` text NOT NULL,
	`toggled_at_ms` integer NOT NULL,
	CONSTRAINT `fk_pause_toggles_user_id_game_local_id_games_user_id_local_id_fk` FOREIGN KEY (`user_id`,`game_local_id`) REFERENCES `games`(`user_id`,`local_id`),
	CONSTRAINT "pause_toggles_half_check" CHECK(`half` IN ('firstHalf', 'secondHalf'))
);
--> statement-breakpoint
ALTER TABLE `games` ADD `first_half_started_at_ms` integer;--> statement-breakpoint
ALTER TABLE `games` ADD `second_half_started_at_ms` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `pause_toggles_user_id_local_id_uq` ON `pause_toggles` (`user_id`,`local_id`);