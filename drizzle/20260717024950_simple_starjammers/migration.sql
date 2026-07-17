CREATE TABLE `game_imports` (
	`id` integer PRIMARY KEY,
	`user_id` text NOT NULL,
	`local_id` integer NOT NULL,
	`game_local_id` integer NOT NULL,
	`format_version` text NOT NULL,
	`fingerprint` text NOT NULL,
	`original_filename` text NOT NULL,
	`imported_at` text NOT NULL,
	CONSTRAINT `fk_game_imports_user_id_game_local_id_games_user_id_local_id_fk` FOREIGN KEY (`user_id`,`game_local_id`) REFERENCES `games`(`user_id`,`local_id`),
	CONSTRAINT "game_imports_fingerprint_check" CHECK(length(`fingerprint`) = 64)
);
--> statement-breakpoint
CREATE TABLE `game_roster_snapshots` (
	`id` integer PRIMARY KEY,
	`user_id` text NOT NULL,
	`local_id` integer NOT NULL,
	`game_local_id` integer NOT NULL,
	`player_number` integer NOT NULL,
	`player_name` text NOT NULL,
	CONSTRAINT `fk_game_roster_snapshots_user_id_game_local_id_games_user_id_local_id_fk` FOREIGN KEY (`user_id`,`game_local_id`) REFERENCES `games`(`user_id`,`local_id`)
);
--> statement-breakpoint
ALTER TABLE `games` ADD `source` text DEFAULT 'recorded' NOT NULL;--> statement-breakpoint
ALTER TABLE `games` ADD `opponent_name` text;--> statement-breakpoint
ALTER TABLE `games` ADD `tracked_team_name` text;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_games` (
	`id` integer PRIMARY KEY,
	`user_id` text NOT NULL,
	`local_id` integer NOT NULL,
	`home_team_local_id` integer NOT NULL,
	`created_at` text NOT NULL,
	`first_half_started_at_ms` integer,
	`halftime_started_at_ms` integer,
	`second_half_started_at_ms` integer,
	`source` text DEFAULT 'recorded' NOT NULL,
	`opponent_name` text,
	`tracked_team_name` text,
	CONSTRAINT `fk_games_user_id_home_team_local_id_teams_user_id_local_id_fk` FOREIGN KEY (`user_id`,`home_team_local_id`) REFERENCES `teams`(`user_id`,`local_id`),
	CONSTRAINT "games_source_check" CHECK(`source` IN ('recorded', 'imported'))
);
--> statement-breakpoint
INSERT INTO `__new_games`(`id`, `user_id`, `local_id`, `home_team_local_id`, `created_at`, `first_half_started_at_ms`, `halftime_started_at_ms`, `second_half_started_at_ms`) SELECT `id`, `user_id`, `local_id`, `home_team_local_id`, `created_at`, `first_half_started_at_ms`, `halftime_started_at_ms`, `second_half_started_at_ms` FROM `games`;--> statement-breakpoint
DROP TABLE `games`;--> statement-breakpoint
ALTER TABLE `__new_games` RENAME TO `games`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `games_user_id_local_id_uq` ON `games` (`user_id`,`local_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `game_imports_user_id_local_id_uq` ON `game_imports` (`user_id`,`local_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `game_imports_user_id_fingerprint_uq` ON `game_imports` (`user_id`,`fingerprint`);--> statement-breakpoint
CREATE UNIQUE INDEX `game_imports_user_id_game_local_id_uq` ON `game_imports` (`user_id`,`game_local_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `game_roster_snapshots_user_id_local_id_uq` ON `game_roster_snapshots` (`user_id`,`local_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `game_roster_snapshots_game_player_number_uq` ON `game_roster_snapshots` (`user_id`,`game_local_id`,`player_number`);