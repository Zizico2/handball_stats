import type { PlayerEvent } from "@/datamodel";

/**
 * Ascending user-action order. UUIDv7 IDs carry durable client creation order,
 * so persistence state and server sequence do not change the ordering.
 */
export function comparePlayerEventOrder(
  left: PlayerEvent,
  right: PlayerEvent,
): number {
  if (left.id < right.id) return -1;
  if (left.id > right.id) return 1;
  return 0;
}
