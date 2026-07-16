export type PauseStateDecision = { kind: "apply" } | { kind: "idempotent" };

/**
 * Desired pause/resume: flip only when current parity differs from desired.
 * Odd toggle count ⇒ paused; even ⇒ running.
 */
export function decidePauseStateTransition(
  currentPaused: boolean,
  desiredPaused: boolean,
): PauseStateDecision {
  if (currentPaused === desiredPaused) {
    return { kind: "idempotent" };
  }

  return { kind: "apply" };
}

/** Parity that must hold before inserting a toggle to reach `desiredPaused`. */
export function expectedParityForPauseInsert(desiredPaused: boolean): 0 | 1 {
  // paused ⇔ count % 2 === 1, so insert when current parity is the opposite.
  return desiredPaused ? 0 : 1;
}

export function pausedFromToggleCount(toggleCount: number): boolean {
  return toggleCount % 2 === 1;
}
