PRAGMA foreign_keys=OFF;--> statement-breakpoint
ALTER TABLE `active_game` RENAME TO `legacy_active_game`;--> statement-breakpoint
ALTER TABLE `pause_toggles` RENAME TO `legacy_pause_toggles`;--> statement-breakpoint
ALTER TABLE `player_events` RENAME TO `legacy_player_events`;--> statement-breakpoint
ALTER TABLE `games` RENAME TO `legacy_games`;--> statement-breakpoint
ALTER TABLE `quick_sub_pairs` RENAME TO `legacy_quick_sub_pairs`;--> statement-breakpoint
ALTER TABLE `team_players` RENAME TO `legacy_team_players`;--> statement-breakpoint
ALTER TABLE `teams` RENAME TO `legacy_teams`;--> statement-breakpoint
DROP INDEX `active_game_user_id_local_id_uq`;--> statement-breakpoint
DROP INDEX `pause_toggles_client_id_uq`;--> statement-breakpoint
DROP INDEX `player_events_user_id_local_id_uq`;--> statement-breakpoint
DROP INDEX `games_user_id_local_id_uq`;--> statement-breakpoint
DROP INDEX `quick_sub_pairs_user_id_local_id_uq`;--> statement-breakpoint
DROP INDEX `team_players_user_id_local_id_uq`;--> statement-breakpoint
DROP INDEX `teams_user_id_local_id_uq`;--> statement-breakpoint
-- Preserve old server row IDs so event ordering and foreign-key relationships remain stable.
-- Replace legacy client/local IDs with fresh UUIDv4 values entirely inside the migration.
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
-- Generate one UUID per legacy row so every rebuilt table uses the same migration path.
CREATE TABLE `_migration_client_ids` (
	`source_table` text NOT NULL,
	`user_id` text NOT NULL,
	`source_id` integer NOT NULL,
	`client_id` text
);--> statement-breakpoint
INSERT INTO `_migration_client_ids` (`source_table`, `user_id`, `source_id`)
SELECT 'teams', `user_id`, `id` FROM `legacy_teams`;--> statement-breakpoint
INSERT INTO `_migration_client_ids` (`source_table`, `user_id`, `source_id`)
SELECT 'team_players', `user_id`, `id` FROM `legacy_team_players`;--> statement-breakpoint
INSERT INTO `_migration_client_ids` (`source_table`, `user_id`, `source_id`)
SELECT 'quick_sub_pairs', `user_id`, `id` FROM `legacy_quick_sub_pairs`;--> statement-breakpoint
INSERT INTO `_migration_client_ids` (`source_table`, `user_id`, `source_id`)
SELECT 'games', `user_id`, `id` FROM `legacy_games`;--> statement-breakpoint
INSERT INTO `_migration_client_ids` (`source_table`, `user_id`, `source_id`)
SELECT 'player_events', `user_id`, `id` FROM `legacy_player_events`;--> statement-breakpoint
INSERT INTO `_migration_client_ids` (`source_table`, `user_id`, `source_id`)
SELECT 'pause_toggles', `user_id`, `id` FROM `legacy_pause_toggles`;--> statement-breakpoint
UPDATE `_migration_client_ids`
SET `client_id` = lower(
	substr(hex(randomblob(16)), 1, 8) || '-' ||
	substr(hex(randomblob(2)), 1, 4) || '-' ||
	'4' || substr(hex(randomblob(2)), 2, 3) || '-' ||
	substr('89ab', (random() & 3) + 1, 1) ||
	substr(hex(randomblob(2)), 2, 3) || '-' ||
	substr(hex(randomblob(16)), 1, 12)
	);--> statement-breakpoint
INSERT INTO `teams` (`id`, `user_id`, `client_id`, `name`)
SELECT
	`legacy_teams`.`id`,
	`legacy_teams`.`user_id`,
	`migration_client`.`client_id`,
	`legacy_teams`.`name`
FROM `legacy_teams`
INNER JOIN `_migration_client_ids` AS `migration_client`
	ON `migration_client`.`source_table` = 'teams'
	AND `migration_client`.`user_id` = `legacy_teams`.`user_id`
	AND `migration_client`.`source_id` = `legacy_teams`.`id`;--> statement-breakpoint
INSERT INTO `team_players` (`id`, `user_id`, `client_id`, `team_id`, `name`, `number`)
SELECT
	`player`.`id`,
	`player`.`user_id`,
	`migration_client`.`client_id`,
	`team`.`id`,
	`player`.`name`,
	`player`.`number`
FROM `legacy_team_players` AS `player`
INNER JOIN `_migration_client_ids` AS `migration_client`
	ON `migration_client`.`source_table` = 'team_players'
	AND `migration_client`.`user_id` = `player`.`user_id`
	AND `migration_client`.`source_id` = `player`.`id`
INNER JOIN `legacy_teams` AS `legacy_team`
	ON `legacy_team`.`user_id` = `player`.`user_id`
	AND `legacy_team`.`local_id` = `player`.`team_local_id`
INNER JOIN `teams` AS `team`
	ON `team`.`user_id` = `legacy_team`.`user_id`
	AND `team`.`id` = `legacy_team`.`id`;--> statement-breakpoint
INSERT INTO `quick_sub_pairs` (`id`, `user_id`, `client_id`, `team_id`, `player_number_a`, `player_number_b`)
SELECT
	`pair`.`id`,
	`pair`.`user_id`,
	`migration_client`.`client_id`,
	`team`.`id`,
	`pair`.`player_number_a`,
	`pair`.`player_number_b`
FROM `legacy_quick_sub_pairs` AS `pair`
INNER JOIN `_migration_client_ids` AS `migration_client`
	ON `migration_client`.`source_table` = 'quick_sub_pairs'
	AND `migration_client`.`user_id` = `pair`.`user_id`
	AND `migration_client`.`source_id` = `pair`.`id`
INNER JOIN `legacy_teams` AS `legacy_team`
	ON `legacy_team`.`user_id` = `pair`.`user_id`
	AND `legacy_team`.`local_id` = `pair`.`team_local_id`
INNER JOIN `teams` AS `team`
	ON `team`.`user_id` = `legacy_team`.`user_id`
	AND `team`.`id` = `legacy_team`.`id`;--> statement-breakpoint
INSERT INTO `games` (`id`, `user_id`, `client_id`, `home_team_id`, `created_at`, `first_half_started_at_ms`, `halftime_started_at_ms`, `second_half_started_at_ms`)
SELECT
	`game`.`id`,
	`game`.`user_id`,
	`migration_client`.`client_id`,
	`team`.`id`,
	`game`.`created_at`,
	`game`.`first_half_started_at_ms`,
	`game`.`halftime_started_at_ms`,
	`game`.`second_half_started_at_ms`
FROM `legacy_games` AS `game`
INNER JOIN `_migration_client_ids` AS `migration_client`
	ON `migration_client`.`source_table` = 'games'
	AND `migration_client`.`user_id` = `game`.`user_id`
	AND `migration_client`.`source_id` = `game`.`id`
INNER JOIN `legacy_teams` AS `legacy_team`
	ON `legacy_team`.`user_id` = `game`.`user_id`
	AND `legacy_team`.`local_id` = `game`.`home_team_local_id`
INNER JOIN `teams` AS `team`
	ON `team`.`user_id` = `legacy_team`.`user_id`
	AND `team`.`id` = `legacy_team`.`id`;--> statement-breakpoint
INSERT INTO `player_events` (`id`, `user_id`, `client_id`, `player`, `game_id`, `ellapsed_seconds`, `event_type`, `event_group`, `half`, `shot_goal`, `shot_direction`, `shot_aim`, `shot_position`, `substitution_player_in`)
SELECT
	`event`.`id`,
	`event`.`user_id`,
	`migration_client`.`client_id`,
	`event`.`player`,
	`game`.`id`,
	`event`.`ellapsed_seconds`,
	`event`.`event_type`,
	`event`.`event_group`,
	`event`.`half`,
	`event`.`shot_goal`,
	`event`.`shot_direction`,
	`event`.`shot_aim`,
	`event`.`shot_position`,
	`event`.`substitution_player_in`
FROM `legacy_player_events` AS `event`
INNER JOIN `_migration_client_ids` AS `migration_client`
	ON `migration_client`.`source_table` = 'player_events'
	AND `migration_client`.`user_id` = `event`.`user_id`
	AND `migration_client`.`source_id` = `event`.`id`
INNER JOIN `legacy_games` AS `legacy_game`
	ON `legacy_game`.`user_id` = `event`.`user_id`
	AND `legacy_game`.`local_id` = `event`.`game_local_id`
INNER JOIN `games` AS `game`
	ON `game`.`user_id` = `legacy_game`.`user_id`
	AND `game`.`id` = `legacy_game`.`id`;--> statement-breakpoint
INSERT INTO `pause_toggles` (`id`, `user_id`, `client_id`, `game_id`, `half`, `toggled_at_ms`)
SELECT
	`toggle`.`id`,
	`toggle`.`user_id`,
	`migration_client`.`client_id`,
	`game`.`id`,
	`toggle`.`half`,
	`toggle`.`toggled_at_ms`
FROM `legacy_pause_toggles` AS `toggle`
INNER JOIN `_migration_client_ids` AS `migration_client`
	ON `migration_client`.`source_table` = 'pause_toggles'
	AND `migration_client`.`user_id` = `toggle`.`user_id`
	AND `migration_client`.`source_id` = `toggle`.`id`
INNER JOIN `legacy_games` AS `legacy_game`
	ON `legacy_game`.`user_id` = `toggle`.`user_id`
	AND `legacy_game`.`local_id` = `toggle`.`game_local_id`
INNER JOIN `games` AS `game`
	ON `game`.`user_id` = `legacy_game`.`user_id`
	AND `game`.`id` = `legacy_game`.`id`;--> statement-breakpoint
INSERT INTO `active_game` (`id`, `user_id`, `game_id`, `home_team_id`)
SELECT
	`active`.`id`,
	`active`.`user_id`,
	`game`.`id`,
	`team`.`id`
FROM `legacy_active_game` AS `active`
INNER JOIN `legacy_games` AS `legacy_game`
	ON `legacy_game`.`user_id` = `active`.`user_id`
	AND `legacy_game`.`local_id` = `active`.`game_local_id`
INNER JOIN `games` AS `game`
	ON `game`.`user_id` = `legacy_game`.`user_id`
	AND `game`.`id` = `legacy_game`.`id`
INNER JOIN `legacy_teams` AS `legacy_team`
	ON `legacy_team`.`user_id` = `active`.`user_id`
	AND `legacy_team`.`local_id` = `active`.`home_team_local_id`
INNER JOIN `teams` AS `team`
	ON `team`.`user_id` = `legacy_team`.`user_id`
	AND `team`.`id` = `legacy_team`.`id`
WHERE NOT EXISTS (
	SELECT 1
	FROM `legacy_active_game` AS `newer`
	WHERE `newer`.`user_id` = `active`.`user_id`
	AND `newer`.`id` > `active`.`id`
);--> statement-breakpoint
DROP TABLE `_migration_client_ids`;--> statement-breakpoint
DROP TABLE `legacy_active_game`;--> statement-breakpoint
DROP TABLE `legacy_pause_toggles`;--> statement-breakpoint
DROP TABLE `legacy_player_events`;--> statement-breakpoint
DROP TABLE `legacy_games`;--> statement-breakpoint
DROP TABLE `legacy_quick_sub_pairs`;--> statement-breakpoint
DROP TABLE `legacy_team_players`;--> statement-breakpoint
DROP TABLE `legacy_teams`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
