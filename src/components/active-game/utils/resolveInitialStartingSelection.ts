export interface InitialStartingSelection {
  selected: number[];
  droppedCount: number;
}

/**
 * Resolve the initial lineup picker selection.
 * Prefer an already-saved lineup for the current half; otherwise fall back to
 * the current on-court players (end-of-half state after substitutions).
 * Numbers no longer on the roster are dropped and counted for UI messaging.
 */
export function resolveInitialStartingSelection(
  savedStartingNumbers: number[],
  activePlayerNumbers: ReadonlySet<number>,
  rosterNumbers: ReadonlySet<number>,
): InitialStartingSelection {
  const preferred =
    savedStartingNumbers.length > 0
      ? savedStartingNumbers
      : Array.from(activePlayerNumbers);

  const selected = preferred.filter((number) => rosterNumbers.has(number));
  return {
    selected,
    droppedCount: preferred.length - selected.length,
  };
}
