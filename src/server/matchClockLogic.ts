import type { MatchHalf } from "@/datamodel";

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

export interface MatchClockPauseToggle {
  half: MatchHalf;
  toggledAtMs: number;
}

export interface BuildMatchClockSnapshotInput {
  gameId: number;
  nowMs: number;
  firstHalfStartedAtMs: number | null;
  secondHalfStartedAtMs: number | null;
  pauseToggles: MatchClockPauseToggle[];
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

export function buildMatchClockSnapshot(
  input: BuildMatchClockSnapshotInput,
): MatchClockSnapshot {
  const {
    gameId,
    nowMs,
    firstHalfStartedAtMs,
    secondHalfStartedAtMs,
    pauseToggles,
  } = input;

  const firstHalfToggleTimes = pauseToggles
    .filter((toggle) => toggle.half === "firstHalf")
    .map((toggle) => toggle.toggledAtMs);

  const secondHalfToggleTimes = pauseToggles
    .filter((toggle) => toggle.half === "secondHalf")
    .map((toggle) => toggle.toggledAtMs);

  const firstHalfElapsedSeconds = calculateHalfElapsedSeconds(
    firstHalfStartedAtMs,
    firstHalfToggleTimes,
    nowMs,
  );

  const secondHalfElapsedSeconds = calculateHalfElapsedSeconds(
    secondHalfStartedAtMs,
    secondHalfToggleTimes,
    nowMs,
  );

  const firstHalfPaused = firstHalfToggleTimes.length % 2 === 1;
  const secondHalfPaused = secondHalfToggleTimes.length % 2 === 1;

  const activeHalf: MatchHalf | null =
    firstHalfStartedAtMs === null
      ? null
      : secondHalfStartedAtMs !== null
        ? "secondHalf"
        : "firstHalf";

  const activeElapsedSeconds =
    activeHalf === "secondHalf"
      ? secondHalfElapsedSeconds
      : activeHalf === "firstHalf"
        ? firstHalfElapsedSeconds
        : 0;

  return {
    gameId,
    serverNowMs: nowMs,
    activeHalf,
    activeElapsedSeconds,
    firstHalfElapsedSeconds,
    secondHalfElapsedSeconds,
    firstHalfPaused,
    secondHalfPaused,
  };
}
