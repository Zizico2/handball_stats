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
  halftimeStartedAtMs: number | null;
  secondHalfStartedAtMs: number | null;
  pauseToggles: MatchClockPauseToggle[];
}

export function calculateElapsedMs(
  startAtMs: number | null,
  toggleTimes: number[],
  nowMs: number,
): number {
  if (startAtMs === null) {
    return 0;
  }

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
  return Math.floor(calculateElapsedMs(startAtMs, toggleTimes, nowMs) / 1000);
}

function assertValidPhaseTimestamps(
  firstHalfStartedAtMs: number | null,
  halftimeStartedAtMs: number | null,
  secondHalfStartedAtMs: number | null,
): void {
  if (
    firstHalfStartedAtMs === null &&
    (halftimeStartedAtMs !== null || secondHalfStartedAtMs !== null)
  ) {
    throw new Error(
      "Invalid match clock timestamps: later phase set without first half start",
    );
  }
}

function deriveActiveHalf(
  firstHalfStartedAtMs: number | null,
  halftimeStartedAtMs: number | null,
  secondHalfStartedAtMs: number | null,
): MatchHalf | null {
  if (firstHalfStartedAtMs === null) {
    return null;
  }

  if (secondHalfStartedAtMs !== null) {
    return "secondHalf";
  }

  if (halftimeStartedAtMs !== null) {
    return null;
  }

  return "firstHalf";
}

export function buildMatchClockSnapshot(
  input: BuildMatchClockSnapshotInput,
): MatchClockSnapshot {
  const {
    gameId,
    nowMs,
    firstHalfStartedAtMs,
    halftimeStartedAtMs,
    secondHalfStartedAtMs,
    pauseToggles,
  } = input;

  assertValidPhaseTimestamps(
    firstHalfStartedAtMs,
    halftimeStartedAtMs,
    secondHalfStartedAtMs,
  );

  const firstHalfToggleTimes = pauseToggles
    .filter((toggle) => toggle.half === "firstHalf")
    .map((toggle) => toggle.toggledAtMs)
    .sort((left, right) => left - right);

  const secondHalfToggleTimes = pauseToggles
    .filter((toggle) => toggle.half === "secondHalf")
    .map((toggle) => toggle.toggledAtMs)
    .sort((left, right) => left - right);

  // Freeze first half at HT when present; if HT was skipped, freeze at second-half start.
  const firstHalfEndMs = halftimeStartedAtMs ?? secondHalfStartedAtMs ?? nowMs;

  const firstHalfElapsedSeconds = calculateHalfElapsedSeconds(
    firstHalfStartedAtMs,
    firstHalfToggleTimes,
    firstHalfEndMs,
  );

  const secondHalfElapsedSeconds = calculateHalfElapsedSeconds(
    secondHalfStartedAtMs,
    secondHalfToggleTimes,
    nowMs,
  );

  const firstHalfPaused = firstHalfToggleTimes.length % 2 === 1;
  const secondHalfPaused = secondHalfToggleTimes.length % 2 === 1;

  const activeHalf = deriveActiveHalf(
    firstHalfStartedAtMs,
    halftimeStartedAtMs,
    secondHalfStartedAtMs,
  );

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
