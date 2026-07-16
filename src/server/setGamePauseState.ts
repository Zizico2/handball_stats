import { and, count, eq, sql } from "drizzle-orm";
import type { MatchHalf, PauseToggle } from "@/datamodel";
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
  constructor(gameId: number) {
    super(`Game ${gameId} not found`);
    this.name = "GameNotFoundError";
  }
}

async function countHalfToggles(
  userId: string,
  gameLocalId: number,
  half: MatchHalf,
): Promise<number> {
  const db = await getDb();
  const row = await db
    .select({ value: count() })
    .from(schema.pauseToggles)
    .where(
      and(
        eq(schema.pauseToggles.userId, userId),
        eq(schema.pauseToggles.gameLocalId, gameLocalId),
        eq(schema.pauseToggles.half, half),
      ),
    )
    .get();

  return row?.value ?? 0;
}

async function gameExists(
  userId: string,
  gameLocalId: number,
): Promise<boolean> {
  const db = await getDb();
  const row = await db
    .select({ localId: schema.games.localId })
    .from(schema.games)
    .where(
      and(
        eq(schema.games.userId, userId),
        eq(schema.games.localId, gameLocalId),
      ),
    )
    .get();
  return row != null;
}

function asDbPauseToggle(row: Record<string, unknown>): DbPauseToggle {
  return {
    id: Number(row.id),
    userId: String(row.userId ?? row.user_id),
    clientId: String(row.clientId ?? row.client_id),
    gameLocalId: Number(row.gameLocalId ?? row.game_local_id),
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
  gameLocalId: number,
  half: MatchHalf,
  desiredPaused: boolean,
  clientId: string,
  nowMs: number,
): Promise<SetGamePauseStateResult> {
  if (!(await gameExists(userId, gameLocalId))) {
    throw new GameNotFoundError(gameLocalId);
  }

  const db = await getDb();
  const expectedParity = expectedParityForPauseInsert(desiredPaused);

  // Attempt the conditional write first (same pattern as phase transitions).
  const insertedRow = await db.get<Record<string, unknown>>(sql`
    INSERT INTO pause_toggles (user_id, client_id, game_local_id, half, toggled_at_ms)
    SELECT ${userId}, ${clientId}, ${gameLocalId}, ${half}, ${nowMs}
    WHERE (
      SELECT COUNT(*) FROM pause_toggles
      WHERE user_id = ${userId}
        AND game_local_id = ${gameLocalId}
        AND half = ${half}
    ) % 2 = ${expectedParity}
    RETURNING id, user_id, client_id, game_local_id, half, toggled_at_ms
  `);

  if (insertedRow) {
    const pauseToggle = dbRowToPauseToggle(asDbPauseToggle(insertedRow));
    const toggleCount = await countHalfToggles(userId, gameLocalId, half);
    return {
      applied: true,
      paused: pausedFromToggleCount(toggleCount),
      toggleCount,
      pauseToggle,
    };
  }

  const toggleCount = await countHalfToggles(userId, gameLocalId, half);
  const paused = pausedFromToggleCount(toggleCount);

  return {
    applied: false,
    paused,
    toggleCount,
    pauseToggle: null,
  };
}
