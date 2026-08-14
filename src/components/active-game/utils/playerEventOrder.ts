import type { ClientId, PlayerEvent } from "@/datamodel";

let nextLocalEventOrder = 0;
const localEventOrder = new Map<ClientId, number>();

/**
 * Remember the order in which this client created an event. The server
 * sequence is not available while an insert is optimistic, and a refetch can
 * temporarily mix persisted rows with optimistic rows. Keeping this small
 * client-only ordering hint lets active-game undo follow the user's actions
 * during that transition.
 */
export function rememberPlayerEventOrder(id: ClientId): void {
  if (!localEventOrder.has(id)) {
    localEventOrder.set(id, nextLocalEventOrder++);
  }
}

export function getRememberedPlayerEventOrder(
  id: ClientId,
): number | undefined {
  return localEventOrder.get(id);
}

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
