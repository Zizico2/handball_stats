import { and, asc, eq } from "drizzle-orm";
import type { ClientId } from "@/datamodel";
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
  gameClientId: ClientId,
  nowMs: number,
): Promise<MatchClockSnapshot> {
  const db = await getDb();

  const gameRow = await db
    .select({
      id: schema.games.id,
      firstHalfStartedAtMs: schema.games.firstHalfStartedAtMs,
      halftimeStartedAtMs: schema.games.halftimeStartedAtMs,
      secondHalfStartedAtMs: schema.games.secondHalfStartedAtMs,
    })
    .from(schema.games)
    .where(
      and(
        eq(schema.games.userId, userId),
        eq(schema.games.clientId, gameClientId),
      ),
    )
    .get();

  if (!gameRow) {
    return buildMatchClockSnapshot({
      gameId: gameClientId,
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
        eq(schema.pauseToggles.gameId, gameRow.id),
      ),
    )
    .orderBy(asc(schema.pauseToggles.toggledAtMs))) as MatchClockPauseToggle[];

  return buildMatchClockSnapshot({
    gameId: gameClientId,
    nowMs,
    firstHalfStartedAtMs: gameRow.firstHalfStartedAtMs,
    halftimeStartedAtMs: gameRow.halftimeStartedAtMs,
    secondHalfStartedAtMs: gameRow.secondHalfStartedAtMs,
    pauseToggles,
  });
}
