import type { PlayerEvent } from "@/datamodel";

/** Ascending persisted order; optimistic events sort after persisted events. */
export function comparePlayerEventOrder(
  left: PlayerEvent,
  right: PlayerEvent,
): number {
  if (left.sequence === null && right.sequence === null) {
    return left.id.localeCompare(right.id);
  }
  if (left.sequence === null) return 1;
  if (right.sequence === null) return -1;
  return left.sequence - right.sequence;
}
