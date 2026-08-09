import { and, count, eq, sql } from "drizzle-orm";
import type { ClientId, MatchHalf, PauseToggle } from "@/datamodel";
import { type DbPauseToggle, dbRowToPauseToggle } from "@/db";
import * as schema from "@/db/schema";
import { getDb } from "@/server/db";
import {
  expectedParityForPauseInsert,
  pausedFromToggleCount,
} from "@/server/pauseStateTransitions";

export type SetGamePauseStateResult = {
  applied: boolean;
  paused: boolean;
  toggleCount: number;
  pauseToggle: PauseToggle | null;
};

export class GameNotFoundError extends Error {
  constructor(gameId: ClientId) {
    super(`Game ${gameId} not found`);
    this.name = "GameNotFoundError";
  }
}

export class PauseStateConflictError extends Error {
  constructor(gameId: ClientId, half: MatchHalf, desiredPaused: boolean) {
    super(
      `Game ${gameId} ${half} cannot be set to ${desiredPaused ? "paused" : "running"} in its current phase`,
    );
    this.name = "PauseStateConflictError";
  }
}

async function countHalfToggles(
  userId: string,
  gameId: number,
  half: MatchHalf,
): Promise<number> {
  const db = await getDb();
  const row = await db
    .select({ value: count() })
    .from(schema.pauseToggles)
    .where(
      and(
        eq(schema.pauseToggles.userId, userId),
        eq(schema.pauseToggles.gameId, gameId),
        eq(schema.pauseToggles.half, half),
      ),
    )
    .get();

  return row?.value ?? 0;
}

async function loadGame(userId: string, gameClientId: ClientId) {
  const db = await getDb();
  const row = await db
    .select({ id: schema.games.id })
    .from(schema.games)
    .where(
      and(
        eq(schema.games.userId, userId),
        eq(schema.games.clientId, gameClientId),
      ),
    )
    .get();
  return row;
}

function asDbPauseToggle(row: Record<string, unknown>): DbPauseToggle {
  return {
    id: Number(row.id),
    userId: String(row.userId ?? row.user_id),
    clientId: String(row.clientId ?? row.client_id),
    gameId: Number(row.gameId ?? row.game_id),
    half: String(row.half),
    toggledAtMs: Number(row.toggledAtMs ?? row.toggled_at_ms),
  };
}

/**
 * Conditionally inserts a pause toggle so the half ends in `desiredPaused`.
 * Uses INSERT…SELECT with a parity guard so concurrent identical requests
 * cannot both insert (mirrors atomic phase UPDATEs).
 */
export async function setGamePauseState(
  userId: string,
  gameClientId: ClientId,
  half: MatchHalf,
  desiredPaused: boolean,
  clientId: ClientId,
  nowMs: number,
): Promise<SetGamePauseStateResult> {
  const game = await loadGame(userId, gameClientId);
  if (!game) throw new GameNotFoundError(gameClientId);
  const gameId = game.id;

  const db = await getDb();
  const expectedParity = expectedParityForPauseInsert(desiredPaused);
  const phaseGuard =
    half === "firstHalf"
      ? desiredPaused
        ? sql`EXISTS (
            SELECT 1 FROM games
            WHERE user_id = ${userId}
              AND id = ${gameId}
              AND first_half_started_at_ms IS NOT NULL
              AND second_half_started_at_ms IS NULL
          )`
        : sql`EXISTS (
            SELECT 1 FROM games
            WHERE user_id = ${userId}
              AND id = ${gameId}
              AND first_half_started_at_ms IS NOT NULL
              AND halftime_started_at_ms IS NULL
              AND second_half_started_at_ms IS NULL
          )`
      : sql`EXISTS (
          SELECT 1 FROM games
          WHERE user_id = ${userId}
            AND id = ${gameId}
            AND second_half_started_at_ms IS NOT NULL
        )`;

  // Attempt the conditional write first (same pattern as phase transitions).
  const insertedRow = await db.get<Record<string, unknown>>(sql`
    INSERT INTO pause_toggles (user_id, client_id, game_id, half, toggled_at_ms)
    SELECT ${userId}, ${clientId}, ${gameId}, ${half}, ${nowMs}
    WHERE (
      SELECT COUNT(*) FROM pause_toggles
      WHERE user_id = ${userId}
        AND game_id = ${gameId}
        AND half = ${half}
    ) % 2 = ${expectedParity}
      AND ${phaseGuard}
    RETURNING id, user_id, client_id, game_id, half, toggled_at_ms
  `);

  if (insertedRow) {
    const pauseToggle = dbRowToPauseToggle(
      asDbPauseToggle(insertedRow),
      gameClientId,
    );
    const toggleCount = await countHalfToggles(userId, gameId, half);
    return {
      applied: true,
      paused: pausedFromToggleCount(toggleCount),
      toggleCount,
      pauseToggle,
    };
  }

  const toggleCount = await countHalfToggles(userId, gameId, half);
  const paused = pausedFromToggleCount(toggleCount);

  if (paused !== desiredPaused) {
    throw new PauseStateConflictError(gameClientId, half, desiredPaused);
  }

  return {
    applied: false,
    paused,
    toggleCount,
    pauseToggle: null,
  };
}
