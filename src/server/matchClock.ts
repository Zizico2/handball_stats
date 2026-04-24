import { and, asc, eq } from "drizzle-orm";
import type { MatchHalf } from "@/datamodel";
import * as schema from "@/db/schema";
import { getDb } from "@/server/db";

export interface MatchClockSnapshot {
  gameId: number;
  serverNowMs: number;
  activeHalf: MatchHalf | null;
  activeElapsedSeconds: number;
  firstHalfElapsedSeconds: number;
  secondHalfElapsedSeconds: number;
  firstHalfPaused: boolean;
  secondHalfPaused: boolean;
}

function calculateElapsedMs(
  startAtMs: number,
  toggleTimes: number[],
  nowMs: number,
): number {
  let completedPausedMs = 0;

  for (let index = 0; index + 1 < toggleTimes.length; index += 2) {
    completedPausedMs += toggleTimes[index + 1] - toggleTimes[index];
  }

  const effectiveNowMs =
    toggleTimes.length % 2 === 1 ? toggleTimes[toggleTimes.length - 1] : nowMs;

  return Math.max(0, effectiveNowMs - startAtMs - completedPausedMs);
}

function calculateHalfElapsedSeconds(
  startAtMs: number | null,
  toggleTimes: number[],
  nowMs: number,
): number {
  if (startAtMs === null) {
    return 0;
  }

  return Math.floor(calculateElapsedMs(startAtMs, toggleTimes, nowMs) / 1000);
}

export async function getMatchClockSnapshot(
  userId: string,
  gameLocalId: number,
  nowMs: number = Date.now(),
): Promise<MatchClockSnapshot> {
  const db = await getDb();

  const gameRow = await db
    .select({
      localId: schema.games.localId,
      firstHalfStartedAtMs: schema.games.firstHalfStartedAtMs,
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
    return {
      gameId: gameLocalId,
      serverNowMs: nowMs,
      activeHalf: null,
      activeElapsedSeconds: 0,
      firstHalfElapsedSeconds: 0,
      secondHalfElapsedSeconds: 0,
      firstHalfPaused: false,
      secondHalfPaused: false,
    };
  }

  const pauseToggles = await db
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
    .orderBy(asc(schema.pauseToggles.toggledAtMs));

  const firstHalfToggleTimes = pauseToggles
    .filter((toggle) => toggle.half === "firstHalf")
    .map((toggle) => toggle.toggledAtMs);

  const secondHalfToggleTimes = pauseToggles
    .filter((toggle) => toggle.half === "secondHalf")
    .map((toggle) => toggle.toggledAtMs);

  const firstHalfElapsedSeconds = calculateHalfElapsedSeconds(
    gameRow.firstHalfStartedAtMs,
    firstHalfToggleTimes,
    nowMs,
  );

  const secondHalfElapsedSeconds = calculateHalfElapsedSeconds(
    gameRow.secondHalfStartedAtMs,
    secondHalfToggleTimes,
    nowMs,
  );

  const firstHalfPaused = firstHalfToggleTimes.length % 2 === 1;
  const secondHalfPaused = secondHalfToggleTimes.length % 2 === 1;

  const activeHalf: MatchHalf | null =
    gameRow.firstHalfStartedAtMs === null
      ? null
      : gameRow.secondHalfStartedAtMs !== null &&
          nowMs >= gameRow.secondHalfStartedAtMs
        ? "secondHalf"
        : "firstHalf";

  const activeElapsedSeconds =
    activeHalf === "secondHalf"
      ? secondHalfElapsedSeconds
      : activeHalf === "firstHalf"
        ? firstHalfElapsedSeconds
        : 0;

  return {
    gameId: gameLocalId,
    serverNowMs: nowMs,
    activeHalf,
    activeElapsedSeconds,
    firstHalfElapsedSeconds,
    secondHalfElapsedSeconds,
    firstHalfPaused,
    secondHalfPaused,
  };
}
