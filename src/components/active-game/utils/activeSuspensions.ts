import type { ClientId, MatchHalf, PlayerEvent } from "@/datamodel";
import { comparePlayerEventOrder } from "./playerEventOrder";

export interface ActiveSuspension {
  id: ClientId;
  offender: number;
  servedBy: number;
  half: MatchHalf;
  ellapsedSeconds: number;
}

function isSuspensionStart(
  event: PlayerEvent,
): event is Extract<PlayerEvent, { eventType: "twoMinuteSuspension" }> {
  return event.eventType === "twoMinuteSuspension";
}

function isSuspensionEnd(
  event: PlayerEvent,
): event is Extract<PlayerEvent, { eventType: "twoMinuteSuspensionEnded" }> {
  return event.eventType === "twoMinuteSuspensionEnded";
}

export function getActiveSuspensions(
  events: PlayerEvent[],
): ActiveSuspension[] {
  const endedSuspensionIds = new Set(
    events.filter(isSuspensionEnd).map((event) => event.event.suspensionId),
  );

  return events
    .filter(
      (
        event,
      ): event is Extract<PlayerEvent, { eventType: "twoMinuteSuspension" }> =>
        isSuspensionStart(event) && !endedSuspensionIds.has(event.id),
    )
    .sort(comparePlayerEventOrder)
    .map((event) => ({
      id: event.id,
      offender: event.player,
      servedBy: event.event.servedBy,
      half: event.half,
      ellapsedSeconds: event.ellapsed_seconds,
    }));
}

export function getActiveSuspensionsForPlayer(
  events: PlayerEvent[],
  player: number,
): ActiveSuspension[] {
  return getActiveSuspensions(events).filter(
    (suspension) =>
      suspension.offender === player || suspension.servedBy === player,
  );
}

export function getActiveSuspensionPlayerNumbers(
  events: PlayerEvent[],
): Set<number> {
  const playerNumbers = new Set<number>();
  for (const suspension of getActiveSuspensions(events)) {
    playerNumbers.add(suspension.offender);
    playerNumbers.add(suspension.servedBy);
  }
  return playerNumbers;
}
