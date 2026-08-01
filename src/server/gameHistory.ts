import { auth } from "@clerk/nextjs/server";
import { and, asc, desc, eq } from "drizzle-orm";
import type { ClientId } from "@/datamodel";
import { dbRowToPlayerEvent } from "@/db";
import { PLAYER_EVENTS_CSV_COLUMN_KEYS } from "@/db/playerEventCsv";
import * as schema from "@/db/schema";
import { parseClientId } from "@/lib/clientId";
import { getDb } from "@/server/db";

export { PLAYER_EVENTS_CSV_COLUMN_KEYS };

function toCsvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export interface PastGameSummary {
  id: ClientId;
  createdAt: string;
  homeTeamName: string;
  score: number;
  eventCount: number;
}

export interface PastGameLog {
  game: { id: ClientId; createdAt: string; homeTeamName: string };
  players: Array<{ name: string; number: number }>;
  events: ReturnType<typeof dbRowToPlayerEvent>[];
}

export async function listPastGames(): Promise<PastGameSummary[]> {
  const { userId } = await auth();
  if (!userId) return [];

  const db = await getDb();
  const [games, activeRows, eventRows] = await Promise.all([
    db
      .select({ game: schema.games, homeTeamName: schema.teams.name })
      .from(schema.games)
      .innerJoin(
        schema.teams,
        and(
          eq(schema.teams.userId, schema.games.userId),
          eq(schema.teams.id, schema.games.homeTeamId),
        ),
      )
      .where(eq(schema.games.userId, userId))
      .orderBy(desc(schema.games.createdAt)),
    db
      .select({ gameId: schema.activeGame.gameId })
      .from(schema.activeGame)
      .where(eq(schema.activeGame.userId, userId)),
    db
      .select({
        gameId: schema.playerEvents.gameId,
        eventType: schema.playerEvents.eventType,
        shotGoal: schema.playerEvents.shotGoal,
      })
      .from(schema.playerEvents)
      .where(eq(schema.playerEvents.userId, userId)),
  ]);

  const activeGameIds = new Set(activeRows.map((row) => row.gameId));
  const statsByGameId = new Map<
    number,
    { score: number; eventCount: number }
  >();
  for (const row of eventRows) {
    const stats = statsByGameId.get(row.gameId) ?? { score: 0, eventCount: 0 };
    stats.eventCount += 1;
    if (row.eventType === "shot" && row.shotGoal) stats.score += 1;
    statsByGameId.set(row.gameId, stats);
  }

  return games
    .filter(({ game }) => !activeGameIds.has(game.id))
    .map(({ game, homeTeamName }) => {
      const stats = statsByGameId.get(game.id) ?? { score: 0, eventCount: 0 };
      return {
        id: parseClientId(game.clientId),
        createdAt: game.createdAt,
        homeTeamName,
        score: stats.score,
        eventCount: stats.eventCount,
      };
    });
}

async function loadGame(userId: string, gameId: ClientId) {
  const db = await getDb();
  return db
    .select({ game: schema.games, homeTeamName: schema.teams.name })
    .from(schema.games)
    .innerJoin(
      schema.teams,
      and(
        eq(schema.teams.userId, schema.games.userId),
        eq(schema.teams.id, schema.games.homeTeamId),
      ),
    )
    .where(
      and(eq(schema.games.userId, userId), eq(schema.games.clientId, gameId)),
    )
    .get();
}

export async function getPastGameLog(
  gameId: ClientId,
): Promise<PastGameLog | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const loaded = await loadGame(userId, gameId);
  if (!loaded) return null;
  const { game, homeTeamName } = loaded;
  const db = await getDb();
  const [players, eventRows] = await Promise.all([
    db
      .select({
        name: schema.teamPlayers.name,
        number: schema.teamPlayers.number,
      })
      .from(schema.teamPlayers)
      .where(
        and(
          eq(schema.teamPlayers.userId, userId),
          eq(schema.teamPlayers.teamId, game.homeTeamId),
        ),
      ),
    db
      .select()
      .from(schema.playerEvents)
      .where(
        and(
          eq(schema.playerEvents.userId, userId),
          eq(schema.playerEvents.gameId, game.id),
        ),
      )
      .orderBy(asc(schema.playerEvents.id)),
  ]);

  return {
    game: {
      id: parseClientId(game.clientId),
      createdAt: game.createdAt,
      homeTeamName,
    },
    players,
    events: eventRows.map((row) => dbRowToPlayerEvent(row, game.clientId)),
  };
}

export async function getPastGamePlayerEventsTableRows(
  gameId: ClientId,
): Promise<(typeof schema.playerEvents.$inferSelect)[] | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const loaded = await loadGame(userId, gameId);
  if (!loaded) return null;
  const db = await getDb();
  return db
    .select()
    .from(schema.playerEvents)
    .where(
      and(
        eq(schema.playerEvents.userId, userId),
        eq(schema.playerEvents.gameId, loaded.game.id),
      ),
    )
    .orderBy(asc(schema.playerEvents.id));
}

export async function getPastGamePlayerEventsCsv(
  gameId: ClientId,
): Promise<{ fileName: string; csv: string } | null> {
  const rows = await getPastGamePlayerEventsTableRows(gameId);
  if (rows === null) return null;
  const csvRows = [PLAYER_EVENTS_CSV_COLUMN_KEYS.join(",")];
  for (const row of rows) {
    csvRows.push(
      PLAYER_EVENTS_CSV_COLUMN_KEYS.map((key) => toCsvCell(row[key])).join(","),
    );
  }
  return {
    fileName: `game-${gameId}-player-events.csv`,
    csv: `${csvRows.join("\n")}\n`,
  };
}
