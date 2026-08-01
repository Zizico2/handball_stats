import { drizzle } from "drizzle-orm/d1";
import { createSelectSchema } from "drizzle-orm/zod";
import type {
  ActiveGame,
  Game,
  MatchHalf,
  PauseToggle,
  PlayerEvent,
  QuickSubPair,
  Team,
  TeamPlayer,
} from "@/datamodel";
import { clientIdSchema, playerEventSchema } from "@/datamodel";
import * as schema from "./schema";

export type DbPlayerEvent = typeof schema.playerEvents.$inferSelect;
export type DbPlayerEventInsert = typeof schema.playerEvents.$inferInsert;
export type DbTeam = typeof schema.teams.$inferSelect;
export type DbTeamInsert = typeof schema.teams.$inferInsert;
export type DbTeamPlayer = typeof schema.teamPlayers.$inferSelect;
export type DbTeamPlayerInsert = typeof schema.teamPlayers.$inferInsert;
export type DbQuickSubPair = typeof schema.quickSubPairs.$inferSelect;
export type DbQuickSubPairInsert = typeof schema.quickSubPairs.$inferInsert;
export type DbGame = typeof schema.games.$inferSelect;
export type DbGameInsert = typeof schema.games.$inferInsert;
export type DbActiveGame = typeof schema.activeGame.$inferSelect;
export type DbActiveGameInsert = typeof schema.activeGame.$inferInsert;
export type DbPauseToggle = typeof schema.pauseToggles.$inferSelect;
export type DbPauseToggleInsert = typeof schema.pauseToggles.$inferInsert;

export const dbPlayerEventSchema = createSelectSchema(schema.playerEvents);

// TODO: handle the possibility of the DB having corrupted/outdated data that doesn't parse correctly.
// TODO: This is fine for now since, in alpha, I'm wiping the DB on every change
const dbPlayerEventToDomainSchema = dbPlayerEventSchema
  .extend({ gameClientId: clientIdSchema })
  .transform((row): unknown => {
    const base = {
      id: row.clientId,
      sequence: row.id,
      player: row.player,
      game_id: row.gameClientId,
      ellapsed_seconds: row.ellapsedSeconds,
      half: row.half,
    };

    if (row.eventType === "shot") {
      return {
        ...base,
        eventType: row.eventType,
        eventGroup: row.eventGroup,
        event: {
          goal: row.shotGoal ?? false,
          direction: row.shotDirection,
          position: row.shotPosition,
          ...(row.shotAim !== null ? { aim: row.shotAim } : {}),
        },
      };
    }

    if (row.eventType === "substitution") {
      if (row.substitutionPlayerIn === null) {
        throw new Error("Missing substitutionPlayerIn in DB row");
      }
      return {
        ...base,
        eventType: row.eventType,
        eventGroup: row.eventGroup,
        event: {
          playerIn: row.substitutionPlayerIn,
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

export type AppDb = ReturnType<typeof createDb>;

export function dbRowToTeam(row: DbTeam): Team {
  return {
    id: clientIdSchema.parse(row.clientId),
    name: row.name,
  };
}

export function teamToDbRow(team: Team, userId: string): DbTeamInsert {
  return {
    userId,
    clientId: team.id,
    name: team.name,
  };
}

// TODO: handle the possibility of the DB having corrupted/outdated data that doesn't parse correctly.
// TODO: This is fine for now since, in alpha, I'm wiping the DB on every change
export function dbRowToPlayerEvent(
  row: DbPlayerEvent,
  gameClientId: string,
): PlayerEvent {
  return dbPlayerEventToDomainSchema.parse({
    ...row,
    gameClientId,
  });
}

export function playerEventToDbRow(
  event: PlayerEvent,
  userId: string,
  gameId: number,
): DbPlayerEventInsert {
  const base = {
    userId,
    clientId: event.id,
    player: event.player,
    gameId,
    ellapsedSeconds: event.ellapsed_seconds,
    eventType: event.eventType,
    eventGroup: event.eventGroup,
    half: event.half,
    shotGoal: null as boolean | null,
    shotDirection: null as string | null,
    shotAim: null as string | null,
    shotPosition: null as string | null,
    substitutionPlayerIn: null as number | null,
  };

  if (event.eventType === "shot") {
    return {
      ...base,
      shotGoal: event.event.goal,
      shotDirection: event.event.direction,
      shotAim: event.event.aim ?? null,
      shotPosition: event.event.position,
    };
  }

  if (event.eventType === "substitution") {
    return {
      ...base,
      substitutionPlayerIn: event.event.playerIn,
    };
  }

  return base;
}

export function dbRowToTeamPlayer(
  row: DbTeamPlayer,
  teamClientId: string,
): TeamPlayer {
  return {
    id: clientIdSchema.parse(row.clientId),
    teamId: clientIdSchema.parse(teamClientId),
    name: row.name,
    number: row.number,
  };
}

export function teamPlayerToDbRow(
  player: TeamPlayer,
  userId: string,
  teamId: number,
): DbTeamPlayerInsert {
  return {
    userId,
    clientId: player.id,
    teamId,
    name: player.name,
    number: player.number,
  };
}

export function dbRowToQuickSubPair(
  row: DbQuickSubPair,
  teamClientId: string,
): QuickSubPair {
  return {
    id: clientIdSchema.parse(row.clientId),
    teamId: clientIdSchema.parse(teamClientId),
    playerNumberA: row.playerNumberA,
    playerNumberB: row.playerNumberB,
  };
}

export function quickSubPairToDbRow(
  pair: QuickSubPair,
  userId: string,
  teamId: number,
): DbQuickSubPairInsert {
  return {
    userId,
    clientId: pair.id,
    teamId,
    playerNumberA: pair.playerNumberA,
    playerNumberB: pair.playerNumberB,
  };
}

export function dbRowToGame(row: DbGame, homeTeamClientId: string): Game {
  return {
    id: clientIdSchema.parse(row.clientId),
    homeTeamId: clientIdSchema.parse(homeTeamClientId),
    createdAt: row.createdAt,
    firstHalfStartedAtMs: row.firstHalfStartedAtMs,
    halftimeStartedAtMs: row.halftimeStartedAtMs,
    secondHalfStartedAtMs: row.secondHalfStartedAtMs,
  };
}

export function gameToDbRow(
  game: Game,
  userId: string,
  homeTeamId: number,
): DbGameInsert {
  return {
    userId,
    clientId: game.id,
    homeTeamId,
    createdAt: game.createdAt,
    firstHalfStartedAtMs: game.firstHalfStartedAtMs ?? null,
    halftimeStartedAtMs: game.halftimeStartedAtMs ?? null,
    secondHalfStartedAtMs: game.secondHalfStartedAtMs ?? null,
  };
}

export function dbRowToPauseToggle(
  row: DbPauseToggle,
  gameClientId: string,
): PauseToggle {
  return {
    id: clientIdSchema.parse(row.clientId),
    gameId: clientIdSchema.parse(gameClientId),
    half: row.half as MatchHalf,
    toggledAtMs: row.toggledAtMs,
  };
}

export function pauseToggleToDbRow(
  pauseToggle: PauseToggle,
  userId: string,
  gameId: number,
): DbPauseToggleInsert {
  return {
    userId,
    clientId: pauseToggle.id,
    gameId,
    half: pauseToggle.half,
    toggledAtMs: pauseToggle.toggledAtMs,
  };
}

export function dbRowToActiveGame(
  _row: DbActiveGame,
  gameClientId: string,
  homeTeamClientId: string,
): ActiveGame {
  return {
    id: 1,
    gameId: clientIdSchema.parse(gameClientId),
    homeTeamId: clientIdSchema.parse(homeTeamClientId),
  };
}

export function activeGameToDbRow(
  _activeGame: ActiveGame,
  userId: string,
  gameId: number,
  homeTeamId: number,
): DbActiveGameInsert {
  return {
    userId,
    gameId,
    homeTeamId,
  };
}
