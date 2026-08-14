PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_player_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`player` integer,
	`game_id` integer NOT NULL,
	`ellapsed_seconds` integer NOT NULL,
	`event_type` text NOT NULL,
	`event_group` text NOT NULL,
	`half` text NOT NULL,
	`shot_goal` integer,
	`shot_direction` text,
	`shot_aim` text,
	`shot_position` text,
	`substitution_player_in` integer,
	`suspension_served_by` integer,
	`suspension_ended_suspension_id` text,
	CONSTRAINT `fk_player_events_user_id_game_id_games_user_id_id_fk` FOREIGN KEY (`user_id`,`game_id`) REFERENCES `games`(`user_id`,`id`),
	CONSTRAINT "player_events_half_check" CHECK(`half` IN ('firstHalf', 'secondHalf')),
	CONSTRAINT "player_required_unless_defense_attempt" CHECK((`event_type` IN ('shot', 'sevenMeterTaken') AND `event_group` = 'defense') OR `player` IS NOT NULL),
	CONSTRAINT "shot_direction_required_for_attempt" CHECK(`event_type` NOT IN ('shot', 'sevenMeterTaken') OR `shot_direction` IS NOT NULL),
	CONSTRAINT "shot_position_required_for_shot" CHECK(`event_type` != 'shot' OR `shot_position` IS NOT NULL),
	CONSTRAINT "suspension_served_by_required" CHECK(`event_type` != 'twoMinuteSuspension' OR `suspension_served_by` IS NOT NULL),
	CONSTRAINT "suspension_end_reference_required" CHECK(`event_type` != 'twoMinuteSuspensionEnded' OR `suspension_ended_suspension_id` IS NOT NULL)
);
--> statement-breakpoint
INSERT INTO `__new_player_events`(`id`, `user_id`, `client_id`, `player`, `game_id`, `ellapsed_seconds`, `event_type`, `event_group`, `half`, `shot_goal`, `shot_direction`, `shot_aim`, `shot_position`, `substitution_player_in`, `suspension_served_by`, `suspension_ended_suspension_id`) SELECT `id`, `user_id`, `client_id`, `player`, `game_id`, `ellapsed_seconds`, `event_type`, `event_group`, `half`, `shot_goal`, `shot_direction`, `shot_aim`, `shot_position`, `substitution_player_in`, `suspension_served_by`, `suspension_ended_suspension_id` FROM `player_events`;--> statement-breakpoint
DROP TABLE `player_events`;--> statement-breakpoint
ALTER TABLE `__new_player_events` RENAME TO `player_events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `player_events_user_id_client_id_uq` ON `player_events` (`user_id`,`client_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_events_user_id_ended_suspension_uq` ON `player_events` (`user_id`,`suspension_ended_suspension_id`);