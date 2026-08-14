import type { PlayerEvent } from "@/datamodel";
import { comparePlayerEventOrder } from "./playerEventOrder";

export function getLastUndoableEvent(
  events: PlayerEvent[],
): PlayerEvent | null {
  let last: PlayerEvent | null = null;

  for (const event of events) {
    if (event.eventType === "startingPlayer") {
      continue;
    }
    if (last === null || isLaterEvent(event, last)) {
      last = event;
    }
  }

  return last;
}

/**
 * Collection inserts are rendered optimistically before the server response
 * supplies their database sequence. When either event is still optimistic,
 * collection order is the only available indication of user action order.
 */
function isLaterEvent(event: PlayerEvent, last: PlayerEvent): boolean {
  if (event.sequence === null || last.sequence === null) {
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
