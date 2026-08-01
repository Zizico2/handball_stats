import type { PlayerEvent } from "@/datamodel";
import { comparePlayerEventOrder } from "./playerEventOrder";

export function getActivePlayers(events: PlayerEvent[]): Set<number> {
  const active = new Set<number>();
  const sorted = [...events].sort(comparePlayerEventOrder);
  let clearedForSecondHalf = false;

  for (const event of sorted) {
    if (event.eventType === "startingPlayer") {
      if (event.half === "secondHalf" && !clearedForSecondHalf) {
        active.clear();
        clearedForSecondHalf = true;
      }
      active.add(event.player);
    } else if (event.eventType === "substitution") {
      active.delete(event.player);
      active.add(event.event.playerIn);
    }
  }

  return active;
}
