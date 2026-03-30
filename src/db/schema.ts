import {
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

export const games = sqliteTable(
  "games",
  {
    id: integer().primaryKey(),
    userId: text("user_id").notNull(),
    localId: integer("local_id").notNull(),
    homeTeamLocalId: integer("home_team_local_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("games_user_id_local_id_uq").on(table.userId, table.localId),
    foreignKey({
      columns: [table.userId, table.homeTeamLocalId],
      foreignColumns: [teams.userId, teams.localId],
    }),
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
    shotGoal: integer("shot_goal", { mode: "boolean" }),
    shotDirection: text("shot_direction"),
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
  ],
);
