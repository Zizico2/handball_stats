PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_player_events` (
	`id` integer PRIMARY KEY,
	`user_id` text NOT NULL,
	`local_id` integer NOT NULL,
	`player` integer NOT NULL,
	`game_local_id` integer NOT NULL,
	`ellapsed_seconds` integer NOT NULL,
	`event_type` text NOT NULL,
	`event_group` text NOT NULL,
	`shot_goal` integer,
	`shot_direction` text,
	`shot_aim` text,
	CONSTRAINT `shot_direction_required_for_shot` CHECK(event_type != 'shot' OR shot_direction IS NOT NULL),
	CONSTRAINT `fk_player_events_user_id_game_local_id_games_user_id_local_id_fk` FOREIGN KEY (`user_id`,`game_local_id`) REFERENCES `games`(`user_id`,`local_id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
--> statement-breakpoint
INSERT INTO `__new_player_events` SELECT * FROM `player_events`;
--> statement-breakpoint
DROP TABLE `player_events`;
--> statement-breakpoint
ALTER TABLE `__new_player_events` RENAME TO `player_events`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
CREATE UNIQUE INDEX `player_events_user_id_local_id_uq` ON `player_events` (`user_id`,`local_id`);
