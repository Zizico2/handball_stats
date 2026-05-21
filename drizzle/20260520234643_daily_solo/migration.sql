CREATE TABLE `quick_sub_pairs` (
	`id` integer PRIMARY KEY,
	`user_id` text NOT NULL,
	`local_id` integer NOT NULL,
	`team_local_id` integer NOT NULL,
	`player_number_a` integer NOT NULL,
	`player_number_b` integer NOT NULL,
	CONSTRAINT `fk_quick_sub_pairs_user_id_team_local_id_teams_user_id_local_id_fk` FOREIGN KEY (`user_id`,`team_local_id`) REFERENCES `teams`(`user_id`,`local_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quick_sub_pairs_user_id_local_id_uq` ON `quick_sub_pairs` (`user_id`,`local_id`);