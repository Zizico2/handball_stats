import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { dbRowToPlayerEvent } from "@/db";
import * as schema from "@/db/schema";
import { getDb } from "@/server/db";

export interface PastGameSummary {
  id: number;
  createdAt: string;
  homeTeamName: string;
  score: number;
  eventCount: number;
}

export interface PastGameLog {
  game: {
    id: number;
    createdAt: string;
    homeTeamName: string;
  };
  players: Array<{
    name: string;
    number: number;
  }>;
  events: ReturnType<typeof dbRowToPlayerEvent>[];
}

export async function listPastGames(): Promise<PastGameSummary[]> {
  const { userId } = await auth();

  if (!userId) {
    return [];
  }

  const db = await getDb();
  const [games, activeGameRows, teams, playerEventRows] = await Promise.all([
    db
      .select()
      .from(schema.games)
      .where(eq(schema.games.userId, userId))
      .orderBy(desc(schema.games.createdAt)),
    db
      .select({ gameLocalId: schema.activeGame.gameLocalId })
      .from(schema.activeGame)
      .where(eq(schema.activeGame.userId, userId)),
    db
      .select({
        localId: schema.teams.localId,
        name: schema.teams.name,
      })
      .from(schema.teams)
      .where(eq(schema.teams.userId, userId)),
    db
      .select({
        gameLocalId: schema.playerEvents.gameLocalId,
        eventType: schema.playerEvents.eventType,
        shotGoal: schema.playerEvents.shotGoal,
      })
      .from(schema.playerEvents)
      .where(eq(schema.playerEvents.userId, userId)),
  ]);

  const activeGameIds = new Set(activeGameRows.map((row) => row.gameLocalId));
  const teamNamesById = new Map(teams.map((team) => [team.localId, team.name]));
  const statsByGameId = new Map<
    number,
    { score: number; eventCount: number }
  >();

  for (const row of playerEventRows) {
    const current = statsByGameId.get(row.gameLocalId) ?? {
      score: 0,
      eventCount: 0,
    };

    current.eventCount += 1;

    if (row.eventType === "shot" && row.shotGoal) {
      current.score += 1;
    }

    statsByGameId.set(row.gameLocalId, current);
  }

  return games
    .filter((game) => !activeGameIds.has(game.localId))
    .map((game) => {
      const stats = statsByGameId.get(game.localId) ?? {
        score: 0,
        eventCount: 0,
      };

      return {
        id: game.localId,
        createdAt: game.createdAt,
        homeTeamName:
          teamNamesById.get(game.homeTeamLocalId) ??
          `Team #${game.homeTeamLocalId}`,
        score: stats.score,
        eventCount: stats.eventCount,
      };
    });
}

export async function getPastGameLog(
  gameId: number,
): Promise<PastGameLog | null> {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const db = await getDb();
  const gameRows = await db
    .select()
    .from(schema.games)
    .where(
      and(eq(schema.games.userId, userId), eq(schema.games.localId, gameId)),
    )
    .limit(1);

  const game = gameRows[0];

  if (!game) {
    return null;
  }

  const [teamRows, playerRows, eventRows] = await Promise.all([
    db
      .select({
        localId: schema.teams.localId,
        name: schema.teams.name,
      })
      .from(schema.teams)
      .where(
        and(
          eq(schema.teams.userId, userId),
          eq(schema.teams.localId, game.homeTeamLocalId),
        ),
      )
      .limit(1),
    db
      .select({
        name: schema.teamPlayers.name,
        number: schema.teamPlayers.number,
      })
      .from(schema.teamPlayers)
      .where(
        and(
          eq(schema.teamPlayers.userId, userId),
          eq(schema.teamPlayers.teamLocalId, game.homeTeamLocalId),
        ),
      ),
    db
      .select()
      .from(schema.playerEvents)
      .where(
        and(
          eq(schema.playerEvents.userId, userId),
          eq(schema.playerEvents.gameLocalId, gameId),
        ),
      ),
  ]);

  return {
    game: {
      id: game.localId,
      createdAt: game.createdAt,
      homeTeamName: teamRows[0]?.name ?? `Team #${game.homeTeamLocalId}`,
    },
    players: playerRows,
    events: eventRows.map(dbRowToPlayerEvent),
  };
}
