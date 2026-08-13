// TODO: this should have more CHECK constraints, insuring invariants that the zod datamodel models.
// TODO: or split playerEvents into multiple tables for different event types, so that shot-specific fields are only present for shot events and the DB schema itself enforces this invariant, instead of relying on the application code to do so.

import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const teams = sqliteTable(
  "teams",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    clientId: text("client_id").notNull(),
    name: text().notNull(),
  },
  (table) => [
    uniqueIndex("teams_user_id_client_id_uq").on(table.userId, table.clientId),
    uniqueIndex("teams_user_id_id_uq").on(table.userId, table.id),
  ],
);

export const teamPlayers = sqliteTable(
  "team_players",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    clientId: text("client_id").notNull(),
    teamId: integer("team_id").notNull(),
    name: text().notNull(),
    number: integer().notNull(),
  },
  (table) => [
    uniqueIndex("team_players_user_id_client_id_uq").on(
      table.userId,
      table.clientId,
    ),
    foreignKey({
      columns: [table.userId, table.teamId],
      foreignColumns: [teams.userId, teams.id],
    }),
  ],
);

export const quickSubPairs = sqliteTable(
  "quick_sub_pairs",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    clientId: text("client_id").notNull(),
    teamId: integer("team_id").notNull(),
    playerNumberA: integer("player_number_a").notNull(),
    playerNumberB: integer("player_number_b").notNull(),
  },
  (table) => [
    uniqueIndex("quick_sub_pairs_user_id_client_id_uq").on(
      table.userId,
      table.clientId,
    ),
    foreignKey({
      columns: [table.userId, table.teamId],
      foreignColumns: [teams.userId, teams.id],
    }),
  ],
);

export const games = sqliteTable(
  "games",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    clientId: text("client_id").notNull(),
    homeTeamId: integer("home_team_id").notNull(),
    createdAt: text("created_at").notNull(),
    firstHalfStartedAtMs: integer("first_half_started_at_ms"),
    halftimeStartedAtMs: integer("halftime_started_at_ms"),
    secondHalfStartedAtMs: integer("second_half_started_at_ms"),
  },
  (table) => [
    uniqueIndex("games_user_id_client_id_uq").on(table.userId, table.clientId),
    uniqueIndex("games_user_id_id_uq").on(table.userId, table.id),
    foreignKey({
      columns: [table.userId, table.homeTeamId],
      foreignColumns: [teams.userId, teams.id],
    }),
  ],
);

export const pauseToggles = sqliteTable(
  "pause_toggles",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    clientId: text("client_id").notNull(),
    gameId: integer("game_id").notNull(),
    half: text("half").notNull(),
    toggledAtMs: integer("toggled_at_ms").notNull(),
  },
  (table) => [
    uniqueIndex("pause_toggles_client_id_uq").on(table.userId, table.clientId),
    foreignKey({
      columns: [table.userId, table.gameId],
      foreignColumns: [games.userId, games.id],
    }),
    check(
      "pause_toggles_half_check",
      sql.raw(`\`${table.half.name}\` IN ('firstHalf', 'secondHalf')`),
    ),
  ],
);

export const activeGame = sqliteTable(
  "active_game",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    gameId: integer("game_id").notNull(),
    homeTeamId: integer("home_team_id").notNull(),
  },
  (table) => [
    uniqueIndex("active_game_user_id_uq").on(table.userId),
    foreignKey({
      columns: [table.userId, table.gameId],
      foreignColumns: [games.userId, games.id],
    }),
    foreignKey({
      columns: [table.userId, table.homeTeamId],
      foreignColumns: [teams.userId, teams.id],
    }),
  ],
);

export const playerEvents = sqliteTable(
  "player_events",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    clientId: text("client_id").notNull(),
    player: integer(),
    gameId: integer("game_id").notNull(),
    ellapsedSeconds: integer("ellapsed_seconds").notNull(),
    eventType: text("event_type").notNull(),
    eventGroup: text("event_group").notNull(),
    half: text("half").notNull(),
    shotGoal: integer("shot_goal", { mode: "boolean" }),
    shotDirection: text("shot_direction"),
    shotAim: text("shot_aim"),
    shotPosition: text("shot_position"),
    substitutionPlayerIn: integer("substitution_player_in"),
    suspensionServedBy: integer("suspension_served_by"),
    suspensionEndedSuspensionId: text("suspension_ended_suspension_id"),
  },
  (table) => [
    uniqueIndex("player_events_user_id_client_id_uq").on(
      table.userId,
      table.clientId,
    ),
    uniqueIndex("player_events_user_id_ended_suspension_uq").on(
      table.userId,
      table.suspensionEndedSuspensionId,
    ),
    foreignKey({
      columns: [table.userId, table.gameId],
      foreignColumns: [games.userId, games.id],
    }),
    check(
      "player_events_half_check",
      sql.raw(`\`${table.half.name}\` IN ('firstHalf', 'secondHalf')`),
    ),
    check(
      "player_required_unless_defense_shot",
      sql.raw(
        `(\`${table.eventType.name}\` = 'shot' AND \`${table.eventGroup.name}\` = 'defense') OR \`${table.player.name}\` IS NOT NULL`,
      ),
    ),
    check(
      "shot_direction_required_for_shot",
      sql.raw(
        `\`${table.eventType.name}\` != 'shot' OR \`${table.shotDirection.name}\` IS NOT NULL`,
      ),
    ),
    check(
      "shot_position_required_for_shot",
      sql.raw(
        `\`${table.eventType.name}\` != 'shot' OR \`${table.shotPosition.name}\` IS NOT NULL`,
      ),
    ),
    check(
      "suspension_served_by_required",
      sql.raw(
        `\`${table.eventType.name}\` != 'twoMinuteSuspension' OR \`${table.suspensionServedBy.name}\` IS NOT NULL`,
      ),
    ),
    check(
      "suspension_end_reference_required",
      sql.raw(
        `\`${table.eventType.name}\` != 'twoMinuteSuspensionEnded' OR \`${table.suspensionEndedSuspensionId.name}\` IS NOT NULL`,
      ),
    ),
  ],
);
