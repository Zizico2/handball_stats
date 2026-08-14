import type { PlayerEvent } from "@/datamodel";
import { comparePlayerEventOrder } from "./playerEventOrder";

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
 * UUIDv7 events carry their client creation order across optimistic and
 * persisted states. Equal IDs fall back to stable collection order defensively.
 */
function isLaterEvent(
  event: PlayerEvent,
  last: PlayerEvent,
  eventIndex: number,
  lastIndex: number,
): boolean {
  const order = comparePlayerEventOrder(event, last);
  return order === 0 ? eventIndex > lastIndex : order > 0;
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
