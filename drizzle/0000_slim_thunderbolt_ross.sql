CREATE TABLE `active_game` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`local_id` integer NOT NULL,
	`game_local_id` integer NOT NULL,
	`home_team_local_id` integer NOT NULL,
	FOREIGN KEY (`user_id`,`game_local_id`) REFERENCES `games`(`user_id`,`local_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`home_team_local_id`) REFERENCES `teams`(`user_id`,`local_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `active_game_user_id_local_id_uq` ON `active_game` (`user_id`,`local_id`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`local_id` integer NOT NULL,
	`home_team_local_id` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`,`home_team_local_id`) REFERENCES `teams`(`user_id`,`local_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `games_user_id_local_id_uq` ON `games` (`user_id`,`local_id`);--> statement-breakpoint
CREATE TABLE `player_events` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`local_id` integer NOT NULL,
	`player` integer NOT NULL,
	`game_local_id` integer NOT NULL,
	`ellapsed_seconds` integer NOT NULL,
	`event_type` text NOT NULL,
	`event_group` text NOT NULL,
	`shot_goal` integer,
	`shot_direction` text,
	FOREIGN KEY (`user_id`,`game_local_id`) REFERENCES `games`(`user_id`,`local_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_events_user_id_local_id_uq` ON `player_events` (`user_id`,`local_id`);--> statement-breakpoint
CREATE TABLE `team_players` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`local_id` integer NOT NULL,
	`team_local_id` integer NOT NULL,
	`name` text NOT NULL,
	`number` integer NOT NULL,
	FOREIGN KEY (`user_id`,`team_local_id`) REFERENCES `teams`(`user_id`,`local_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_players_user_id_local_id_uq` ON `team_players` (`user_id`,`local_id`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`local_id` integer NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_user_id_local_id_uq` ON `teams` (`user_id`,`local_id`);