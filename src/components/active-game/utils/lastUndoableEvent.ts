import type { PlayerEvent } from "@/datamodel";
import {
  comparePlayerEventOrder,
  getRememberedPlayerEventOrder,
} from "./playerEventOrder";

export function getLastUndoableEvent(
  events: PlayerEvent[],
): PlayerEvent | null {
  let last: PlayerEvent | null = null;

  let lastIndex = -1;

  for (const [index, event] of events.entries()) {
    if (event.eventType === "startingPlayer") {
      continue;
    }
    if (last === null || isLaterEvent(event, last, index, lastIndex)) {
      last = event;
      lastIndex = index;
    }
  }

  return last;
}

/**
 * Collection inserts are rendered optimistically before the server response
 * supplies their database sequence. When either event is still optimistic,
 * collection order is the only available indication of user action order.
 */
function isLaterEvent(
  event: PlayerEvent,
  last: PlayerEvent,
  eventIndex: number,
  lastIndex: number,
): boolean {
  const eventLocalOrder = getRememberedPlayerEventOrder(event.id);
  const lastLocalOrder = getRememberedPlayerEventOrder(last.id);

  if (eventLocalOrder !== undefined || lastLocalOrder !== undefined) {
    if (eventLocalOrder === undefined) return false;
    if (lastLocalOrder === undefined) return true;
    return eventLocalOrder > lastLocalOrder;
  }

  if (event.sequence === null || last.sequence === null) {
    if (event.sequence === null && last.sequence === null) {
      return eventIndex > lastIndex;
    }
    return event.sequence === null;
  }
  return comparePlayerEventOrder(event, last) > 0;
}

function formatEventTypeLabel(eventType: string): string {
  return eventType
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase());
}

export function formatUndoEventLabel(
  event: PlayerEvent,
  getPlayerLabel: (number: number) => string,
): string {
  if (event.eventType === "substitution") {
    return `${getPlayerLabel(event.player)} → ${getPlayerLabel(event.event.playerIn)}`;
  }

  if (event.eventType === "shot" || event.eventType === "sevenMeterTaken") {
    const result = event.event.goal ? "Goal" : "Miss";
    const eventLabel =
      event.eventType === "sevenMeterTaken" ? "7 Meter Taken" : "Shot";
    if (event.eventGroup === "defense") {
      return `Defense — ${eventLabel} (${result})`;
    }
    return `${getPlayerLabel(event.player)} — ${eventLabel} (${result})`;
  }

  const eventTypeLabel =
    event.eventType === "offensiveFoul" && event.eventGroup === "defense"
      ? "Offensive Foul Provoked"
      : formatEventTypeLabel(event.eventType);
  return `${getPlayerLabel(event.player)} — ${eventTypeLabel}`;
}
