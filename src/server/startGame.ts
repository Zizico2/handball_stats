import { and, eq } from "drizzle-orm";
import type { ActiveGame, Game } from "@/datamodel";
import {
  type DbActiveGame,
  type DbActiveGameInsert,
  type DbGame,
  type DbGameInsert,
  dbRowToActiveGame,
  dbRowToGame,
} from "@/db";
import * as schema from "@/db/schema";

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

export type StartGameInput = {
  id: number;
  homeTeamId: number;
  createdAt: string;
};

/**
 * Minimal DB surface shared by D1 (async + batch) and bun:sqlite tests
 * (sync transaction). Avoids coupling the helper to one driver.
 */
export type StartGameDb = {
  select: () => {
    from: (table: unknown) => {
      where: (condition: unknown) => {
        get: () => Promise<unknown> | unknown;
      };
    };
  };
  insert: (table: unknown) => {
    values: (row: unknown) => {
      returning: () => {
        all: () => unknown[];
      } & PromiseLike<unknown[]>;
    };
  };
  batch?: (
    queries: readonly [PromiseLike<unknown[]>, PromiseLike<unknown[]>],
  ) => Promise<[unknown[], unknown[]]>;
  transaction: <T>(fn: (tx: StartGameDb) => T) => T;
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
 * Inserts the game row and active-game marker atomically.
 * Prefers D1 `batch` (all-or-nothing); falls back to `transaction` for
 * bun:sqlite unit tests.
 */
export async function insertGameAndActiveMarkerAtomic(
  db: StartGameDb,
  gameRow: DbGameInsert,
  activeRow: DbActiveGameInsert,
): Promise<{ game: DbGame; activeGame: DbActiveGame }> {
  if (typeof db.batch === "function") {
    const [gamesRows, activeRows] = await db.batch([
      db.insert(schema.games).values(gameRow).returning(),
      db.insert(schema.activeGame).values(activeRow).returning(),
    ]);
    return {
      game: gamesRows[0] as DbGame,
      activeGame: activeRows[0] as DbActiveGame,
    };
  }

  return db.transaction((tx) => {
    const games = tx
      .insert(schema.games)
      .values(gameRow)
      .returning()
      .all() as DbGame[];
    const actives = tx
      .insert(schema.activeGame)
      .values(activeRow)
      .returning()
      .all() as DbActiveGame[];
    return { game: games[0], activeGame: actives[0] };
  });
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

async function loadActiveGame(
  db: StartGameDb,
  userId: string,
): Promise<unknown> {
  return db
    .select()
    .from(schema.activeGame)
    .where(eq(schema.activeGame.userId, userId))
    .get();
}

export async function startGame(
  db: StartGameDb,
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
