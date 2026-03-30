import { drizzle } from "drizzle-orm/d1";
import type { PlayerEvent } from "@/datamodel";
import * as schema from "./schema";

export type DbPlayerEvent = typeof schema.playerEvents.$inferSelect;
export type DbTeam = typeof schema.teams.$inferSelect;
export type DbTeamPlayer = typeof schema.teamPlayers.$inferSelect;
export type DbGame = typeof schema.games.$inferSelect;
export type DbActiveGame = typeof schema.activeGame.$inferSelect;

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export function dbRowToPlayerEvent(row: DbPlayerEvent): PlayerEvent {
  const base = {
    id: row.id,
    player: row.player,
    game_id: row.gameId,
    ellapsed_seconds: row.ellapsedSeconds,
  };

  if (row.eventType === "shot") {
    return {
      ...base,
      eventType: "shot" as const,
      eventGroup: "attack" as const,
      event: {
        goal: row.shotGoal ?? false,
        direction: row.shotDirection as PlayerEvent extends {
          eventType: "shot";
        }
          ? PlayerEvent["event"]["direction"]
          : never,
      },
    };
  }

  return {
    ...base,
    eventType: row.eventType,
    eventGroup: row.eventGroup,
  } as PlayerEvent;
}

export function playerEventToDbRow(event: PlayerEvent) {
  const base = {
    id: event.id,
    player: event.player,
    gameId: event.game_id,
    ellapsedSeconds: event.ellapsed_seconds,
    eventType: event.eventType,
    eventGroup: event.eventGroup,
    shotGoal: null as boolean | null,
    shotDirection: null as string | null,
  };

  if (event.eventType === "shot") {
    return {
      ...base,
      shotGoal: event.event.goal,
      shotDirection: event.event.direction,
    };
  }

  return base;
}

export function dbRowToTeamPlayer(row: DbTeamPlayer) {
  return {
    id: row.id,
    teamId: row.teamId,
    name: row.name,
    number: row.number,
  };
}

export function teamPlayerToDbRow(player: {
  id: number;
  teamId: number;
  name: string;
  number: number;
}) {
  return {
    id: player.id,
    teamId: player.teamId,
    name: player.name,
    number: player.number,
  };
}

export function dbRowToGame(row: DbGame) {
  return {
    id: row.id,
    homeTeamId: row.homeTeamId,
    createdAt: row.createdAt,
  };
}

export function gameToDbRow(game: {
  id: number;
  homeTeamId: number;
  createdAt: string;
}) {
  return {
    id: game.id,
    homeTeamId: game.homeTeamId,
    createdAt: game.createdAt,
  };
}

export function dbRowToActiveGame(row: DbActiveGame) {
  return {
    id: row.id as 1,
    gameId: row.gameId,
    homeTeamId: row.homeTeamId,
  };
}

export function activeGameToDbRow(activeGame: {
  id: 1;
  gameId: number;
  homeTeamId: number;
}) {
  return {
    id: activeGame.id,
    gameId: activeGame.gameId,
    homeTeamId: activeGame.homeTeamId,
  };
}
