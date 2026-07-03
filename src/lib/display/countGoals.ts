import type { PlayerEvent } from "@/datamodel";

export function countGoals(events: PlayerEvent[]): number {
  return events.filter(
    (event) => event.eventType === "shot" && event.event.goal,
  ).length;
}
