import { and, asc, eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getDb } from "@/server/db";
import {
  buildMatchClockSnapshot,
  type MatchClockPauseToggle,
  type MatchClockSnapshot,
} from "@/server/matchClockLogic";

export type { MatchClockSnapshot } from "@/server/matchClockLogic";
export { buildMatchClockSnapshot } from "@/server/matchClockLogic";

export async function getMatchClockSnapshot(
  userId: string,
  gameLocalId: number,
  nowMs: number,
): Promise<MatchClockSnapshot> {
  const db = await getDb();

  const gameRow = await db
    .select({
      localId: schema.games.localId,
      firstHalfStartedAtMs: schema.games.firstHalfStartedAtMs,
      halftimeStartedAtMs: schema.games.halftimeStartedAtMs,
      secondHalfStartedAtMs: schema.games.secondHalfStartedAtMs,
    })
    .from(schema.games)
    .where(
      and(
        eq(schema.games.userId, userId),
        eq(schema.games.localId, gameLocalId),
      ),
    )
    .get();

  if (!gameRow) {
    return buildMatchClockSnapshot({
      gameId: gameLocalId,
      nowMs,
      firstHalfStartedAtMs: null,
      halftimeStartedAtMs: null,
      secondHalfStartedAtMs: null,
      pauseToggles: [],
    });
  }

  const pauseToggles = (await db
    .select({
      half: schema.pauseToggles.half,
      toggledAtMs: schema.pauseToggles.toggledAtMs,
    })
    .from(schema.pauseToggles)
    .where(
      and(
        eq(schema.pauseToggles.userId, userId),
        eq(schema.pauseToggles.gameLocalId, gameLocalId),
      ),
    )
    .orderBy(asc(schema.pauseToggles.toggledAtMs))) as MatchClockPauseToggle[];

  return buildMatchClockSnapshot({
    gameId: gameLocalId,
    nowMs,
    firstHalfStartedAtMs: gameRow.firstHalfStartedAtMs,
    halftimeStartedAtMs: gameRow.halftimeStartedAtMs,
    secondHalfStartedAtMs: gameRow.secondHalfStartedAtMs,
    pauseToggles,
  });
}
