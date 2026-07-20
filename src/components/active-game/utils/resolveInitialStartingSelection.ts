/**
 * Prefer an already-saved lineup for the current half; otherwise use the
 * current on-court players (end-of-half state after substitutions).
 * Only rostered jersey numbers are kept.
 */
export function resolveInitialStartingSelection(
  savedStartingNumbers: number[],
  activePlayerNumbers: ReadonlySet<number>,
  rosterNumbers: ReadonlySet<number>,
): number[] {
  const preferred =
    savedStartingNumbers.length > 0
      ? savedStartingNumbers
      : Array.from(activePlayerNumbers);

  return preferred.filter((number) => rosterNumbers.has(number));
}
