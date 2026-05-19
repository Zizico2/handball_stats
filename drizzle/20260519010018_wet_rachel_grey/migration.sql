CREATE TABLE `active_game` (
	`id` integer PRIMARY KEY,
	`user_id` text NOT NULL,
	`local_id` integer NOT NULL,
	`game_local_id` integer NOT NULL,
	`home_team_local_id` integer NOT NULL,
	CONSTRAINT `fk_active_game_user_id_game_local_id_games_user_id_local_id_fk` FOREIGN KEY (`user_id`,`game_local_id`) REFERENCES `games`(`user_id`,`local_id`),
	CONSTRAINT `fk_active_game_user_id_home_team_local_id_teams_user_id_local_id_fk` FOREIGN KEY (`user_id`,`home_team_local_id`) REFERENCES `teams`(`user_id`,`local_id`)
);
--> statement-breakpoint
CREATE TABLE `games` (
	`id` integer PRIMARY KEY,
	`user_id` text NOT NULL,
	`local_id` integer NOT NULL,
	`home_team_local_id` integer NOT NULL,
	`created_at` text NOT NULL,
	`first_half_started_at_ms` integer,
	`second_half_started_at_ms` integer,
	CONSTRAINT `fk_games_user_id_home_team_local_id_teams_user_id_local_id_fk` FOREIGN KEY (`user_id`,`home_team_local_id`) REFERENCES `teams`(`user_id`,`local_id`)
);
--> statement-breakpoint
CREATE TABLE `pause_toggles` (
	`id` integer PRIMARY KEY,
	`user_id` text NOT NULL,
	`game_local_id` integer NOT NULL,
	`half` text NOT NULL,
	`toggled_at_ms` integer NOT NULL,
	CONSTRAINT `fk_pause_toggles_user_id_game_local_id_games_user_id_local_id_fk` FOREIGN KEY (`user_id`,`game_local_id`) REFERENCES `games`(`user_id`,`local_id`),
	CONSTRAINT "pause_toggles_half_check" CHECK(`half` IN ('firstHalf', 'secondHalf'))
);
--> statement-breakpoint
CREATE TABLE `player_events` (
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
	CONSTRAINT `fk_player_events_user_id_game_local_id_games_user_id_local_id_fk` FOREIGN KEY (`user_id`,`game_local_id`) REFERENCES `games`(`user_id`,`local_id`),
	CONSTRAINT "shot_direction_required_for_shot" CHECK(`event_type` != 'shot' OR `shot_direction` IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE `team_players` (
	`id` integer PRIMARY KEY,
	`user_id` text NOT NULL,
	`local_id` integer NOT NULL,
	`team_local_id` integer NOT NULL,
	`name` text NOT NULL,
	`number` integer NOT NULL,
	CONSTRAINT `fk_team_players_user_id_team_local_id_teams_user_id_local_id_fk` FOREIGN KEY (`user_id`,`team_local_id`) REFERENCES `teams`(`user_id`,`local_id`)
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY,
	`user_id` text NOT NULL,
	`local_id` integer NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `active_game_user_id_local_id_uq` ON `active_game` (`user_id`,`local_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `games_user_id_local_id_uq` ON `games` (`user_id`,`local_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `pause_toggles_user_id_toggled_at_ms_uq` ON `pause_toggles` (`user_id`,`toggled_at_ms`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_events_user_id_local_id_uq` ON `player_events` (`user_id`,`local_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `team_players_user_id_local_id_uq` ON `team_players` (`user_id`,`local_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `teams_user_id_local_id_uq` ON `teams` (`user_id`,`local_id`);