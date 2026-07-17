import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { dbRowToPlayerEvent } from "@/db";
import { PLAYER_EVENTS_CSV_COLUMN_KEYS } from "@/db/playerEventCsv";
import * as schema from "@/db/schema";
import { serializeArcazziGameV1 } from "@/gameImport/serializeGameCsv";
import { getDb } from "@/server/db";

export { PLAYER_EVENTS_CSV_COLUMN_KEYS };

export type GameSource = "recorded" | "imported";

export interface PastGameSummary {
  id: number;
  createdAt: string;
  homeTeamName: string;
  opponentName: string | null;
  source: GameSource;
  score: number;
  eventCount: number;
}

export interface PastGameLog {
  game: {
    id: number;
    createdAt: string;
    homeTeamName: string;
    opponentName: string | null;
    source: GameSource;
  };
  players: Array<{
    name: string;
    number: number;
  }>;
  events: ReturnType<typeof dbRowToPlayerEvent>[];
}

function gameSource(raw: string): GameSource {
  return raw === "imported" ? "imported" : "recorded";
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
        // Prefer the immutable snapshot label; fall back to the live team
        // for games recorded before snapshots existed.
        homeTeamName:
          game.trackedTeamName ??
          teamNamesById.get(game.homeTeamLocalId) ??
          `Team #${game.homeTeamLocalId}`,
        opponentName: game.opponentName,
        source: gameSource(game.source),
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

  const [teamRows, snapshotRows, livePlayerRows, eventRows] = await Promise.all(
    [
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
          name: schema.gameRosterSnapshots.playerName,
          number: schema.gameRosterSnapshots.playerNumber,
        })
        .from(schema.gameRosterSnapshots)
        .where(
          and(
            eq(schema.gameRosterSnapshots.userId, userId),
            eq(schema.gameRosterSnapshots.gameLocalId, gameId),
          ),
        ),
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
    ],
  );

  return {
    game: {
      id: game.localId,
      createdAt: game.createdAt,
      homeTeamName:
        game.trackedTeamName ??
        teamRows[0]?.name ??
        `Team #${game.homeTeamLocalId}`,
      opponentName: game.opponentName,
      source: gameSource(game.source),
    },
    // Prefer the immutable roster snapshot; fall back to the live roster for
    // games recorded before snapshots existed.
    players: snapshotRows.length > 0 ? snapshotRows : livePlayerRows,
    events: [...eventRows]
      .sort((a, b) => {
        if (a.half !== b.half) {
          return a.half === "firstHalf" ? -1 : 1;
        }
        if (a.ellapsedSeconds !== b.ellapsedSeconds) {
          return a.ellapsedSeconds - b.ellapsedSeconds;
        }
        const aOrder = a.eventSequence ?? a.localId;
        const bOrder = b.eventSequence ?? b.localId;
        return aOrder - bOrder;
      })
      .map(dbRowToPlayerEvent),
  };
}

export async function getPastGamePlayerEventsTableRows(
  gameId: number,
): Promise<(typeof schema.playerEvents.$inferSelect)[] | null> {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const db = await getDb();
  const gameRows = await db
    .select({ localId: schema.games.localId })
    .from(schema.games)
    .where(
      and(eq(schema.games.userId, userId), eq(schema.games.localId, gameId)),
    )
    .limit(1);

  if (!gameRows[0]) {
    return null;
  }

  return db
    .select()
    .from(schema.playerEvents)
    .where(
      and(
        eq(schema.playerEvents.userId, userId),
        eq(schema.playerEvents.gameLocalId, gameId),
      ),
    );
}

/**
 * Exports a past game as the shared `arcazzi-game-v1` contract, using the
 * same serializer module the importer validates against.
 */
export async function getPastGamePlayerEventsCsv(
  gameId: number,
): Promise<{ fileName: string; csv: string } | null> {
  const [gameLog, rows] = await Promise.all([
    getPastGameLog(gameId),
    getPastGamePlayerEventsTableRows(gameId),
  ]);

  if (gameLog === null || rows === null) {
    return null;
  }

  const orderedRows = [...rows].sort((a, b) => {
    if (a.half !== b.half) {
      return a.half === "firstHalf" ? -1 : 1;
    }
    if (a.ellapsedSeconds !== b.ellapsedSeconds) {
      return a.ellapsedSeconds - b.ellapsedSeconds;
    }
    const aOrder = a.eventSequence ?? a.localId;
    const bOrder = b.eventSequence ?? b.localId;
    return aOrder - bOrder;
  });

  const csv = serializeArcazziGameV1({
    matchExternalId: `game-${gameId}`,
    matchStartedAt: gameLog.game.createdAt,
    trackedTeamName: gameLog.game.homeTeamName,
    opponentName: gameLog.game.opponentName,
    roster: gameLog.players,
    events: orderedRows.map((row, index) => ({
      sequence: row.eventSequence ?? index,
      player: row.player,
      half: row.half,
      ellapsedSeconds: row.ellapsedSeconds,
      eventType: row.eventType,
      eventGroup: row.eventGroup,
      shotGoal: row.eventType === "shot" ? (row.shotGoal ?? false) : null,
      shotDirection: row.shotDirection,
      shotAim: row.shotAim,
      shotPosition: row.shotPosition,
      substitutionPlayerIn: row.substitutionPlayerIn,
    })),
  });

  return {
    fileName: `game-${gameId}-arcazzi-game-v1.csv`,
    csv,
  };
}
