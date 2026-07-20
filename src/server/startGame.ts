import { and, eq, sql } from "drizzle-orm";
import type { ActiveGame, Game } from "@/datamodel";
import {
  type AppDb,
  type DbActiveGame,
  type DbActiveGameInsert,
  type DbGame,
  type DbGameInsert,
  dbRowToActiveGame,
  dbRowToGame,
} from "@/db";
import * as schema from "@/db/schema";
import { MIN_ROSTER_SIZE } from "@/lib/roster/minRosterSize";

export class StartGameConflictError extends Error {
  constructor(message = "An active game already exists") {
    super(message);
    this.name = "StartGameConflictError";
  }
}

export class StartGameTeamNotFoundError extends Error {
  constructor(teamId: number) {
    super(`Team ${teamId} not found`);
    this.name = "StartGameTeamNotFoundError";
  }
}

export class StartGameRosterTooSmallError extends Error {
  readonly playerCount: number;

  constructor(playerCount: number) {
    super(
      `Team needs at least ${MIN_ROSTER_SIZE} player${MIN_ROSTER_SIZE === 1 ? "" : "s"} to start a game (found ${playerCount})`,
    );
    this.name = "StartGameRosterTooSmallError";
    this.playerCount = playerCount;
  }
}

export type StartGameInput = {
  id: number;
  homeTeamId: number;
  createdAt: string;
};

function gameInsertRow(input: StartGameInput, userId: string): DbGameInsert {
  return {
    userId,
    localId: input.id,
    homeTeamLocalId: input.homeTeamId,
    createdAt: input.createdAt,
    firstHalfStartedAtMs: null,
    halftimeStartedAtMs: null,
    secondHalfStartedAtMs: null,
  };
}

function activeGameInsertRow(
  input: StartGameInput,
  userId: string,
): DbActiveGameInsert {
  return {
    userId,
    localId: 1,
    gameLocalId: input.id,
    homeTeamLocalId: input.homeTeamId,
  };
}

/**
 * Inserts the game row and active-game marker atomically via D1 `batch`
 * (all-or-nothing).
 */
export async function insertGameAndActiveMarkerAtomic(
  db: AppDb,
  gameRow: DbGameInsert,
  activeRow: DbActiveGameInsert,
): Promise<{ game: DbGame; activeGame: DbActiveGame }> {
  const [gamesRows, activeRows] = await db.batch([
    db.insert(schema.games).values(gameRow).returning(),
    db.insert(schema.activeGame).values(activeRow).returning(),
  ]);

  return {
    game: gamesRows[0],
    activeGame: activeRows[0],
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code =
    "code" in error && typeof error.code === "string" ? error.code : "";
  if (
    code === "SQLITE_CONSTRAINT_UNIQUE" ||
    code === "SQLITE_CONSTRAINT" ||
    code.includes("CONSTRAINT_UNIQUE")
  ) {
    return true;
  }

  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : String(error);
  return /unique constraint failed|UNIQUE constraint failed/i.test(message);
}

async function loadActiveGame(db: AppDb, userId: string) {
  return db
    .select()
    .from(schema.activeGame)
    .where(eq(schema.activeGame.userId, userId))
    .get();
}

export async function startGame(
  db: AppDb,
  userId: string,
  input: StartGameInput,
): Promise<{ game: Game; activeGame: ActiveGame }> {
  const existingActive = await loadActiveGame(db, userId);

  if (existingActive) {
    throw new StartGameConflictError();
  }

  const team = await db
    .select()
    .from(schema.teams)
    .where(
      and(
        eq(schema.teams.userId, userId),
        eq(schema.teams.localId, input.homeTeamId),
      ),
    )
    .get();

  if (!team) {
    throw new StartGameTeamNotFoundError(input.homeTeamId);
  }

  const rosterCountRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.teamPlayers)
    .where(
      and(
        eq(schema.teamPlayers.userId, userId),
        eq(schema.teamPlayers.teamLocalId, input.homeTeamId),
      ),
    )
    .get();

  const playerCount = Number(rosterCountRow?.count ?? 0);
  if (playerCount < MIN_ROSTER_SIZE) {
    throw new StartGameRosterTooSmallError(playerCount);
  }

  try {
    const { game, activeGame } = await insertGameAndActiveMarkerAtomic(
      db,
      gameInsertRow(input, userId),
      activeGameInsertRow(input, userId),
    );

    return {
      game: dbRowToGame(game),
      activeGame: dbRowToActiveGame(activeGame),
    };
  } catch (error) {
    // Concurrent starts can both pass the pre-check; the losing insert hits
    // the active_game unique index. Map that to 409 instead of a raw 500.
    if (isUniqueConstraintError(error) && (await loadActiveGame(db, userId))) {
      throw new StartGameConflictError();
    }
    throw error;
  }
}
