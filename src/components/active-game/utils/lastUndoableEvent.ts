import type { PlayerEvent } from "@/datamodel";

export function getLastUndoableEvent(
  events: PlayerEvent[],
): PlayerEvent | null {
  let last: PlayerEvent | null = null;

  for (const event of events) {
    if (event.eventType === "startingPlayer") {
      continue;
    }
    if (last === null || event.id > last.id) {
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

  if (event.eventType === "shot") {
    const result = event.event.goal ? "Goal" : "Miss";
    return `${getPlayerLabel(event.player)} — Shot (${result})`;
  }

  return `${getPlayerLabel(event.player)} — ${formatEventTypeLabel(event.eventType)}`;
}
