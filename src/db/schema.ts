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
    id: integer().primaryKey(),
    userId: text("user_id").notNull(),
    localId: integer("local_id").notNull(),
    name: text().notNull(),
  },
  (table) => [
    uniqueIndex("teams_user_id_local_id_uq").on(table.userId, table.localId),
  ],
);

export const teamPlayers = sqliteTable(
  "team_players",
  {
    id: integer().primaryKey(),
    userId: text("user_id").notNull(),
    localId: integer("local_id").notNull(),
    teamLocalId: integer("team_local_id").notNull(),
    name: text().notNull(),
    number: integer().notNull(),
  },
  (table) => [
    uniqueIndex("team_players_user_id_local_id_uq").on(
      table.userId,
      table.localId,
    ),
    foreignKey({
      columns: [table.userId, table.teamLocalId],
      foreignColumns: [teams.userId, teams.localId],
    }),
  ],
);

export const quickSubPairs = sqliteTable(
  "quick_sub_pairs",
  {
    id: integer().primaryKey(),
    userId: text("user_id").notNull(),
    localId: integer("local_id").notNull(),
    teamLocalId: integer("team_local_id").notNull(),
    playerNumberA: integer("player_number_a").notNull(),
    playerNumberB: integer("player_number_b").notNull(),
  },
  (table) => [
    uniqueIndex("quick_sub_pairs_user_id_local_id_uq").on(
      table.userId,
      table.localId,
    ),
    foreignKey({
      columns: [table.userId, table.teamLocalId],
      foreignColumns: [teams.userId, teams.localId],
    }),
  ],
);

export const games = sqliteTable(
  "games",
  {
    id: integer().primaryKey(),
    userId: text("user_id").notNull(),
    localId: integer("local_id").notNull(),
    homeTeamLocalId: integer("home_team_local_id").notNull(),
    createdAt: text("created_at").notNull(),
    firstHalfStartedAtMs: integer("first_half_started_at_ms"),
    halftimeStartedAtMs: integer("halftime_started_at_ms"),
    secondHalfStartedAtMs: integer("second_half_started_at_ms"),
    source: text("source").notNull().default("recorded"),
    opponentName: text("opponent_name"),
    trackedTeamName: text("tracked_team_name"),
  },
  (table) => [
    uniqueIndex("games_user_id_local_id_uq").on(table.userId, table.localId),
    foreignKey({
      columns: [table.userId, table.homeTeamLocalId],
      foreignColumns: [teams.userId, teams.localId],
    }),
    check(
      "games_source_check",
      sql.raw(`\`${table.source.name}\` IN ('recorded', 'imported')`),
    ),
  ],
);

export const gameRosterSnapshots = sqliteTable(
  "game_roster_snapshots",
  {
    id: integer().primaryKey(),
    userId: text("user_id").notNull(),
    localId: integer("local_id").notNull(),
    gameLocalId: integer("game_local_id").notNull(),
    playerNumber: integer("player_number").notNull(),
    playerName: text("player_name").notNull(),
  },
  (table) => [
    uniqueIndex("game_roster_snapshots_user_id_local_id_uq").on(
      table.userId,
      table.localId,
    ),
    uniqueIndex("game_roster_snapshots_game_player_number_uq").on(
      table.userId,
      table.gameLocalId,
      table.playerNumber,
    ),
    foreignKey({
      columns: [table.userId, table.gameLocalId],
      foreignColumns: [games.userId, games.localId],
    }),
  ],
);

export const gameImports = sqliteTable(
  "game_imports",
  {
    id: integer().primaryKey(),
    userId: text("user_id").notNull(),
    localId: integer("local_id").notNull(),
    gameLocalId: integer("game_local_id").notNull(),
    formatVersion: text("format_version").notNull(),
    fingerprint: text("fingerprint").notNull(),
    originalFilename: text("original_filename").notNull(),
    importedAt: text("imported_at").notNull(),
  },
  (table) => [
    uniqueIndex("game_imports_user_id_local_id_uq").on(
      table.userId,
      table.localId,
    ),
    uniqueIndex("game_imports_user_id_fingerprint_uq").on(
      table.userId,
      table.fingerprint,
    ),
    uniqueIndex("game_imports_user_id_game_local_id_uq").on(
      table.userId,
      table.gameLocalId,
    ),
    foreignKey({
      columns: [table.userId, table.gameLocalId],
      foreignColumns: [games.userId, games.localId],
    }),
    check(
      "game_imports_fingerprint_check",
      sql.raw(`length(\`${table.fingerprint.name}\`) = 64`),
    ),
  ],
);

export const pauseToggles = sqliteTable(
  "pause_toggles",
  {
    id: integer().primaryKey(),
    userId: text("user_id").notNull(),
    clientId: text("client_id").notNull(),
    gameLocalId: integer("game_local_id").notNull(),
    half: text("half").notNull(),
    toggledAtMs: integer("toggled_at_ms").notNull(),
  },
  (table) => [
    uniqueIndex("pause_toggles_client_id_uq").on(table.userId, table.clientId),
    foreignKey({
      columns: [table.userId, table.gameLocalId],
      foreignColumns: [games.userId, games.localId],
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
    id: integer().primaryKey(),
    userId: text("user_id").notNull(),
    localId: integer("local_id").notNull(),
    gameLocalId: integer("game_local_id").notNull(),
    homeTeamLocalId: integer("home_team_local_id").notNull(),
  },
  (table) => [
    uniqueIndex("active_game_user_id_local_id_uq").on(
      table.userId,
      table.localId,
    ),
    foreignKey({
      columns: [table.userId, table.gameLocalId],
      foreignColumns: [games.userId, games.localId],
    }),
    foreignKey({
      columns: [table.userId, table.homeTeamLocalId],
      foreignColumns: [teams.userId, teams.localId],
    }),
  ],
);

export const playerEvents = sqliteTable(
  "player_events",
  {
    id: integer().primaryKey(),
    userId: text("user_id").notNull(),
    localId: integer("local_id").notNull(),
    player: integer().notNull(),
    gameLocalId: integer("game_local_id").notNull(),
    ellapsedSeconds: integer("ellapsed_seconds").notNull(),
    eventType: text("event_type").notNull(),
    eventGroup: text("event_group").notNull(),
    half: text("half").notNull(),
    shotGoal: integer("shot_goal", { mode: "boolean" }),
    shotDirection: text("shot_direction"),
    shotAim: text("shot_aim"),
    shotPosition: text("shot_position"),
    substitutionPlayerIn: integer("substitution_player_in"),
  },
  (table) => [
    uniqueIndex("player_events_user_id_local_id_uq").on(
      table.userId,
      table.localId,
    ),
    foreignKey({
      columns: [table.userId, table.gameLocalId],
      foreignColumns: [games.userId, games.localId],
    }),
    check(
      "player_events_half_check",
      sql.raw(`\`${table.half.name}\` IN ('firstHalf', 'secondHalf')`),
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
  ],
);
