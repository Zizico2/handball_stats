export type GamePhase = "notStarted" | "firstHalf" | "halftime" | "secondHalf";

export type GamePhaseTransition = "firstHalf" | "halftime" | "secondHalf";

export interface GamePhaseTimestamps {
  firstHalfStartedAtMs: number | null;
  halftimeStartedAtMs: number | null;
  secondHalfStartedAtMs: number | null;
}

export type PhaseTransitionDecision =
  | { kind: "apply"; column: keyof GamePhaseTimestamps }
  | { kind: "idempotent" }
  | { kind: "conflict"; reason: string };

export function deriveGamePhase(timestamps: GamePhaseTimestamps): GamePhase {
  const { firstHalfStartedAtMs, halftimeStartedAtMs, secondHalfStartedAtMs } =
    timestamps;

  if (secondHalfStartedAtMs !== null) {
    return "secondHalf";
  }

  if (halftimeStartedAtMs !== null) {
    return "halftime";
  }

  if (firstHalfStartedAtMs !== null) {
    return "firstHalf";
  }

  return "notStarted";
}

export function decidePhaseTransition(
  timestamps: GamePhaseTimestamps,
  to: GamePhaseTransition,
): PhaseTransitionDecision {
  const { firstHalfStartedAtMs, halftimeStartedAtMs, secondHalfStartedAtMs } =
    timestamps;
  const current = deriveGamePhase(timestamps);

  if (to === "firstHalf") {
    if (current === "firstHalf") {
      return { kind: "idempotent" };
    }

    if (
      firstHalfStartedAtMs === null &&
      halftimeStartedAtMs === null &&
      secondHalfStartedAtMs === null
    ) {
      return { kind: "apply", column: "firstHalfStartedAtMs" };
    }

    return {
      kind: "conflict",
      reason: `Cannot start first half from phase "${current}"`,
    };
  }

  if (to === "halftime") {
    if (current === "halftime") {
      return { kind: "idempotent" };
    }

    if (
      firstHalfStartedAtMs !== null &&
      halftimeStartedAtMs === null &&
      secondHalfStartedAtMs === null
    ) {
      return { kind: "apply", column: "halftimeStartedAtMs" };
    }

    return {
      kind: "conflict",
      reason: `Cannot start halftime from phase "${current}"`,
    };
  }

  // to === "secondHalf"
  if (current === "secondHalf") {
    return { kind: "idempotent" };
  }

  if (firstHalfStartedAtMs !== null && secondHalfStartedAtMs === null) {
    return { kind: "apply", column: "secondHalfStartedAtMs" };
  }

  return {
    kind: "conflict",
    reason: `Cannot start second half from phase "${current}"`,
  };
}

/**
 * Simulates an atomic conditional UPDATE for tests: apply only when
 * the target column is still null and preconditions hold.
 */
export function applyPhaseTransitionAtomically(
  timestamps: GamePhaseTimestamps,
  to: GamePhaseTransition,
  nowMs: number,
):
  | { ok: true; timestamps: GamePhaseTimestamps; idempotent: boolean }
  | { ok: false; reason: string } {
  const decision = decidePhaseTransition(timestamps, to);

  if (decision.kind === "idempotent") {
    return { ok: true, timestamps, idempotent: true };
  }

  if (decision.kind === "conflict") {
    return { ok: false, reason: decision.reason };
  }

  // Re-check target column is null (atomic guard).
  if (timestamps[decision.column] !== null) {
    const refreshed = decidePhaseTransition(timestamps, to);
    if (refreshed.kind === "idempotent") {
      return { ok: true, timestamps, idempotent: true };
    }
    return {
      ok: false,
      reason: refreshed.kind === "conflict" ? refreshed.reason : "Conflict",
    };
  }

  return {
    ok: true,
    idempotent: false,
    timestamps: {
      ...timestamps,
      [decision.column]: nowMs,
    },
  };
}
