import { drizzle } from "drizzle-orm/d1";
import { createSelectSchema } from "drizzle-orm/zod";
import type {
  ActiveGame,
  Game,
  MatchHalf,
  PauseToggle,
  PlayerEvent,
  Team,
  TeamPlayer,
} from "@/datamodel";
import { playerEventSchema } from "@/datamodel";
import * as schema from "./schema";

export type DbPlayerEvent = typeof schema.playerEvents.$inferSelect;
export type DbPlayerEventInsert = typeof schema.playerEvents.$inferInsert;
export type DbTeam = typeof schema.teams.$inferSelect;
export type DbTeamInsert = typeof schema.teams.$inferInsert;
export type DbTeamPlayer = typeof schema.teamPlayers.$inferSelect;
export type DbTeamPlayerInsert = typeof schema.teamPlayers.$inferInsert;
export type DbGame = typeof schema.games.$inferSelect;
export type DbGameInsert = typeof schema.games.$inferInsert;
export type DbActiveGame = typeof schema.activeGame.$inferSelect;
export type DbActiveGameInsert = typeof schema.activeGame.$inferInsert;
export type DbPauseToggle = typeof schema.pauseToggles.$inferSelect;
export type DbPauseToggleInsert = typeof schema.pauseToggles.$inferInsert;

const dbPlayerEventSchema = createSelectSchema(schema.playerEvents);

// TODO: handle the possibility of the DB having corrupted/outdated data that doesn't parse correctly.
// TODO: This is fine for now since, in alpha, I'm wiping the DB on every change
const dbPlayerEventToDomainSchema = dbPlayerEventSchema
  .transform((row) => {
    const base = {
      id: row.localId,
      player: row.player,
      game_id: row.gameLocalId,
      ellapsed_seconds: row.ellapsedSeconds,
    };

    if (row.eventType === "shot") {
      return {
        ...base,
        eventType: row.eventType,
        eventGroup: row.eventGroup,
        event: {
          goal: row.shotGoal ?? false,
          direction: row.shotDirection,
          ...(row.shotAim !== null ? { aim: row.shotAim } : {}),
        },
      };
    }

    return {
      ...base,
      eventType: row.eventType,
      eventGroup: row.eventGroup,
    };
  })
  .pipe(playerEventSchema);

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export function dbRowToTeam(row: DbTeam): Team {
  return {
    id: row.localId,
    name: row.name,
  };
}

export function teamToDbRow(team: Team, userId: string): DbTeamInsert {
  return {
    userId,
    localId: team.id,
    name: team.name,
  };
}

// TODO: handle the possibility of the DB having corrupted/outdated data that doesn't parse correctly.
// TODO: This is fine for now since, in alpha, I'm wiping the DB on every change
export function dbRowToPlayerEvent(row: DbPlayerEvent): PlayerEvent {
  return dbPlayerEventToDomainSchema.parse(row);
}

export function playerEventToDbRow(
  event: PlayerEvent,
  userId: string,
): DbPlayerEventInsert {
  const base = {
    userId,
    localId: event.id,
    player: event.player,
    gameLocalId: event.game_id,
    ellapsedSeconds: event.ellapsed_seconds,
    eventType: event.eventType,
    eventGroup: event.eventGroup,
    shotGoal: null as boolean | null,
    shotDirection: null as string | null,
    shotAim: null as string | null,
  };

  if (event.eventType === "shot") {
    return {
      ...base,
      shotGoal: event.event.goal,
      shotDirection: event.event.direction,
      shotAim: event.event.aim ?? null,
    };
  }

  return base;
}

export function dbRowToTeamPlayer(row: DbTeamPlayer): TeamPlayer {
  return {
    id: row.localId,
    teamId: row.teamLocalId,
    name: row.name,
    number: row.number,
  };
}

export function teamPlayerToDbRow(
  player: TeamPlayer,
  userId: string,
): DbTeamPlayerInsert {
  return {
    userId,
    localId: player.id,
    teamLocalId: player.teamId,
    name: player.name,
    number: player.number,
  };
}

export function dbRowToGame(row: DbGame): Game {
  return {
    id: row.localId,
    homeTeamId: row.homeTeamLocalId,
    createdAt: row.createdAt,
    firstHalfStartedAtMs: row.firstHalfStartedAtMs,
    secondHalfStartedAtMs: row.secondHalfStartedAtMs,
  };
}

export function gameToDbRow(game: Game, userId: string): DbGameInsert {
  return {
    userId,
    localId: game.id,
    homeTeamLocalId: game.homeTeamId,
    createdAt: game.createdAt,
    firstHalfStartedAtMs: game.firstHalfStartedAtMs ?? null,
    secondHalfStartedAtMs: game.secondHalfStartedAtMs ?? null,
  };
}

export function dbRowToPauseToggle(row: DbPauseToggle): PauseToggle {
  return {
    id: row.clientId,
    gameId: row.gameLocalId,
    half: row.half as MatchHalf,
    toggledAtMs: row.toggledAtMs,
  };
}

export function pauseToggleToDbRow(
  pauseToggle: PauseToggle,
  userId: string,
): DbPauseToggleInsert {
  return {
    userId,
    clientId: pauseToggle.id,
    gameLocalId: pauseToggle.gameId,
    half: pauseToggle.half,
    toggledAtMs: pauseToggle.toggledAtMs,
  };
}

export function dbRowToActiveGame(row: DbActiveGame): ActiveGame {
  return {
    id: row.localId as 1,
    gameId: row.gameLocalId,
    homeTeamId: row.homeTeamLocalId,
  };
}

export function activeGameToDbRow(
  activeGame: ActiveGame,
  userId: string,
): DbActiveGameInsert {
  return {
    userId,
    localId: activeGame.id,
    gameLocalId: activeGame.gameId,
    homeTeamLocalId: activeGame.homeTeamId,
  };
}
