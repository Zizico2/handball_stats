import type { MatchHalf, PlayerEvent } from "@/datamodel";

export interface TimelineItem {
  type: "event" | "startingLineup";
  id: string | number;
  half: MatchHalf;
  ellapsed_seconds: number;
  event?: PlayerEvent;
  startingPlayers?: PlayerEvent[];
}

export function buildEventTimeline(events: PlayerEvent[]): TimelineItem[] {
  const firstHalfStarting = events.filter(
    (event) =>
      event.eventType === "startingPlayer" && event.half === "firstHalf",
  );
  const secondHalfStarting = events.filter(
    (event) =>
      event.eventType === "startingPlayer" && event.half === "secondHalf",
  );
  const gameplayEvents = events.filter(
    (event) => event.eventType !== "startingPlayer",
  );

  const items: TimelineItem[] = [];

  for (const event of gameplayEvents) {
    items.push({
      type: "event",
      id: `event-${event.id}`,
      half: event.half,
      ellapsed_seconds: event.ellapsed_seconds,
      event,
    });
  }

  if (firstHalfStarting.length > 0) {
    items.push({
      type: "startingLineup",
      id: "starting-firstHalf",
      half: "firstHalf",
      ellapsed_seconds: 0,
      startingPlayers: firstHalfStarting,
    });
  }

  if (secondHalfStarting.length > 0) {
    items.push({
      type: "startingLineup",
      id: "starting-secondHalf",
      half: "secondHalf",
      ellapsed_seconds: 0,
      startingPlayers: secondHalfStarting,
    });
  }

  return [...items].sort((a, b) => {
    if (a.half === "secondHalf" && b.half === "firstHalf") return -1;
    if (a.half === "firstHalf" && b.half === "secondHalf") return 1;

    if (b.ellapsed_seconds !== a.ellapsed_seconds) {
      return b.ellapsed_seconds - a.ellapsed_seconds;
    }

    if (a.type === "startingLineup" && b.type !== "startingLineup") return 1;
    if (a.type !== "startingLineup" && b.type === "startingLineup") return -1;

    const aId = a.event ? a.event.id : 0;
    const bId = b.event ? b.event.id : 0;
    return bId - aId;
  });
}
