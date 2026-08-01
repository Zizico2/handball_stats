PRAGMA foreign_keys=OFF;--> statement-breakpoint
DROP TABLE IF EXISTS `active_game`;--> statement-breakpoint
DROP TABLE IF EXISTS `pause_toggles`;--> statement-breakpoint
DROP TABLE IF EXISTS `player_events`;--> statement-breakpoint
DROP TABLE IF EXISTS `games`;--> statement-breakpoint
DROP TABLE IF EXISTS `quick_sub_pairs`;--> statement-breakpoint
DROP TABLE IF EXISTS `team_players`;--> statement-breakpoint
DROP TABLE IF EXISTS `teams`;--> statement-breakpoint
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`name` text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `teams_user_id_client_id_uq` ON `teams` (`user_id`,`client_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `teams_user_id_id_uq` ON `teams` (`user_id`,`id`);--> statement-breakpoint
CREATE TABLE `team_players` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`team_id` integer NOT NULL,
	`name` text NOT NULL,
	`number` integer NOT NULL,
	CONSTRAINT `fk_team_players_user_id_team_id_teams_user_id_id_fk` FOREIGN KEY (`user_id`,`team_id`) REFERENCES `teams`(`user_id`,`id`)
);--> statement-breakpoint
CREATE UNIQUE INDEX `team_players_user_id_client_id_uq` ON `team_players` (`user_id`,`client_id`);--> statement-breakpoint
CREATE TABLE `quick_sub_pairs` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`team_id` integer NOT NULL,
	`player_number_a` integer NOT NULL,
	`player_number_b` integer NOT NULL,
	CONSTRAINT `fk_quick_sub_pairs_user_id_team_id_teams_user_id_id_fk` FOREIGN KEY (`user_id`,`team_id`) REFERENCES `teams`(`user_id`,`id`)
);--> statement-breakpoint
CREATE UNIQUE INDEX `quick_sub_pairs_user_id_client_id_uq` ON `quick_sub_pairs` (`user_id`,`client_id`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`home_team_id` integer NOT NULL,
	`created_at` text NOT NULL,
	`first_half_started_at_ms` integer,
	`halftime_started_at_ms` integer,
	`second_half_started_at_ms` integer,
	CONSTRAINT `fk_games_user_id_home_team_id_teams_user_id_id_fk` FOREIGN KEY (`user_id`,`home_team_id`) REFERENCES `teams`(`user_id`,`id`)
);--> statement-breakpoint
CREATE UNIQUE INDEX `games_user_id_client_id_uq` ON `games` (`user_id`,`client_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `games_user_id_id_uq` ON `games` (`user_id`,`id`);--> statement-breakpoint
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
	CONSTRAINT `fk_player_events_user_id_game_id_games_user_id_id_fk` FOREIGN KEY (`user_id`,`game_id`) REFERENCES `games`(`user_id`,`id`),
	CONSTRAINT `player_events_half_check` CHECK(`half` IN ('firstHalf', 'secondHalf')),
	CONSTRAINT `shot_direction_required_for_shot` CHECK(`event_type` != 'shot' OR `shot_direction` IS NOT NULL),
	CONSTRAINT `shot_position_required_for_shot` CHECK(`event_type` != 'shot' OR `shot_position` IS NOT NULL)
);--> statement-breakpoint
CREATE UNIQUE INDEX `player_events_user_id_client_id_uq` ON `player_events` (`user_id`,`client_id`);--> statement-breakpoint
CREATE TABLE `pause_toggles` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`game_id` integer NOT NULL,
	`half` text NOT NULL,
	`toggled_at_ms` integer NOT NULL,
	CONSTRAINT `fk_pause_toggles_user_id_game_id_games_user_id_id_fk` FOREIGN KEY (`user_id`,`game_id`) REFERENCES `games`(`user_id`,`id`),
	CONSTRAINT `pause_toggles_half_check` CHECK(`half` IN ('firstHalf', 'secondHalf'))
);--> statement-breakpoint
CREATE UNIQUE INDEX `pause_toggles_client_id_uq` ON `pause_toggles` (`user_id`,`client_id`);--> statement-breakpoint
CREATE TABLE `active_game` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` text NOT NULL,
	`game_id` integer NOT NULL,
	`home_team_id` integer NOT NULL,
	CONSTRAINT `fk_active_game_user_id_game_id_games_user_id_id_fk` FOREIGN KEY (`user_id`,`game_id`) REFERENCES `games`(`user_id`,`id`),
	CONSTRAINT `fk_active_game_user_id_home_team_id_teams_user_id_id_fk` FOREIGN KEY (`user_id`,`home_team_id`) REFERENCES `teams`(`user_id`,`id`)
);--> statement-breakpoint
CREATE UNIQUE INDEX `active_game_user_id_uq` ON `active_game` (`user_id`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
