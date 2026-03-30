import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const teams = sqliteTable("teams", {
  id: integer().primaryKey(),
  name: text().notNull(),
});

export const teamPlayers = sqliteTable("team_players", {
  id: integer().primaryKey(),
  teamId: integer("team_id")
    .notNull()
    .references(() => teams.id),
  name: text().notNull(),
  number: integer().notNull(),
});

export const games = sqliteTable("games", {
  id: integer().primaryKey(),
  homeTeamId: integer("home_team_id")
    .notNull()
    .references(() => teams.id),
  createdAt: text("created_at").notNull(),
});

export const activeGame = sqliteTable("active_game", {
  id: integer().primaryKey(),
  gameId: integer("game_id")
    .notNull()
    .references(() => games.id),
  homeTeamId: integer("home_team_id")
    .notNull()
    .references(() => teams.id),
});

export const playerEvents = sqliteTable("player_events", {
  id: integer().primaryKey(),
  player: integer().notNull(),
  gameId: integer("game_id")
    .notNull()
    .references(() => games.id),
  ellapsedSeconds: integer("ellapsed_seconds").notNull(),
  eventType: text("event_type").notNull(),
  eventGroup: text("event_group").notNull(),
  shotGoal: integer("shot_goal", { mode: "boolean" }),
  shotDirection: text("shot_direction"),
});
