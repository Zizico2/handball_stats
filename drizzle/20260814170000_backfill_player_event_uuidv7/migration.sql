-- Backfill legacy player-event UUIDv4 values as deterministic UUIDv7 values.
-- Unix epoch zero keeps historical IDs before newly created events, while the
-- server sequence in the UUID tail preserves the existing event order.
CREATE TABLE `__player_event_id_map` (
	`user_id` text NOT NULL,
	`old_id` text NOT NULL,
	`new_id` text NOT NULL UNIQUE,
	PRIMARY KEY (`user_id`, `old_id`)
);
--> statement-breakpoint
INSERT INTO `__player_event_id_map` (`user_id`, `old_id`, `new_id`)
SELECT
	`user_id`,
	`client_id`,
	'00000000-0000-7000-8000-' || printf('%012x', `id`)
FROM `player_events`
WHERE substr(`client_id`, 15, 1) = '4';
--> statement-breakpoint
UPDATE `player_events`
SET `suspension_ended_suspension_id` = (
	SELECT `new_id`
	FROM `__player_event_id_map`
	WHERE `user_id` = `player_events`.`user_id`
	  AND `old_id` = `player_events`.`suspension_ended_suspension_id`
)
WHERE `suspension_ended_suspension_id` IN (
	SELECT `old_id`
	FROM `__player_event_id_map`
	WHERE `user_id` = `player_events`.`user_id`
);
--> statement-breakpoint
UPDATE `player_events`
SET `client_id` = (
	SELECT `new_id`
	FROM `__player_event_id_map`
	WHERE `user_id` = `player_events`.`user_id`
	  AND `old_id` = `player_events`.`client_id`
)
WHERE `client_id` IN (
	SELECT `old_id`
	FROM `__player_event_id_map`
	WHERE `user_id` = `player_events`.`user_id`
);
--> statement-breakpoint
DROP TABLE `__player_event_id_map`;
