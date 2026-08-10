PRAGMA foreign_keys=OFF;--> statement-breakpoint
ALTER TABLE `player_events` RENAME TO `legacy_player_events`;--> statement-breakpoint
CREATE TABLE `player_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`player` integer NOT NULL,
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
	-- Unsupported in D1; enforced in code.
	-- CONSTRAINT `fk_player_events_user_id_suspension_ended_suspension_id_player_events_user_id_client_id_fk` FOREIGN KEY (`user_id`,`suspension_ended_suspension_id`) REFERENCES `player_events`(`user_id`,`client_id`),
	CONSTRAINT `player_events_half_check` CHECK(`half` IN ('firstHalf', 'secondHalf')),
	CONSTRAINT `shot_direction_required_for_shot` CHECK(`event_type` != 'shot' OR `shot_direction` IS NOT NULL),
	CONSTRAINT `shot_position_required_for_shot` CHECK(`event_type` != 'shot' OR `shot_position` IS NOT NULL),
	CONSTRAINT `suspension_served_by_required` CHECK(`event_type` != 'twoMinuteSuspension' OR `suspension_served_by` IS NOT NULL),
	CONSTRAINT `suspension_end_reference_required` CHECK(`event_type` != 'twoMinuteSuspensionEnded' OR `suspension_ended_suspension_id` IS NOT NULL)
);--> statement-breakpoint
INSERT INTO `player_events` (
	`id`, `user_id`, `client_id`, `player`, `game_id`, `ellapsed_seconds`,
	`event_type`, `event_group`, `half`, `shot_goal`, `shot_direction`,
	`shot_aim`, `shot_position`, `substitution_player_in`,
	`suspension_served_by`, `suspension_ended_suspension_id`
)
SELECT
	`id`, `user_id`, `client_id`, `player`, `game_id`, `ellapsed_seconds`,
	`event_type`, `event_group`, `half`, `shot_goal`, `shot_direction`,
	`shot_aim`, `shot_position`, `substitution_player_in`,
	CASE WHEN `event_type` = 'twoMinuteSuspension' THEN `player` ELSE NULL END,
	NULL
FROM `legacy_player_events`;--> statement-breakpoint
DROP TABLE `legacy_player_events`;--> statement-breakpoint
CREATE UNIQUE INDEX `player_events_user_id_client_id_uq` ON `player_events` (`user_id`,`client_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_events_user_id_ended_suspension_uq` ON `player_events` (`user_id`,`suspension_ended_suspension_id`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
