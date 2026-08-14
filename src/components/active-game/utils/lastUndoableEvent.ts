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
    if (last === null || comparePlayerEventOrder(event, last) > 0) {
      last = event;
    }
  }

  return last;
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
