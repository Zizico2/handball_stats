import type { ClientId, PlayerEvent } from "@/datamodel";

export function isUuidV7(id: ClientId): boolean {
  return id[14] === "7";
}

/**
 * Ascending user-action order. New events use their durable UUIDv7 creation
 * order regardless of persistence state. Legacy UUIDv4 events precede UUIDv7
 * events and retain their server-sequence/optimistic ordering behavior.
 */
export function comparePlayerEventOrder(
  left: PlayerEvent,
  right: PlayerEvent,
): number {
  const leftIsV7 = isUuidV7(left.id);
  const rightIsV7 = isUuidV7(right.id);

  if (leftIsV7 && rightIsV7) {
    if (left.id < right.id) return -1;
    if (left.id > right.id) return 1;
    return 0;
  }

  if (leftIsV7 !== rightIsV7) {
    return leftIsV7 ? 1 : -1;
  }

  if (left.sequence === null && right.sequence === null) {
    return 0;
  }
  if (left.sequence === null) return 1;
  if (right.sequence === null) return -1;
  return left.sequence - right.sequence;
}
