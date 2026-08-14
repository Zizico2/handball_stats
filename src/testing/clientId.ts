import type { ClientId, PlayerEventId } from "@/datamodel";
import { parseClientId, parsePlayerEventId } from "@/lib/clientId";

export function testClientId(value: number): ClientId {
  return parseClientId(
    `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`,
  );
}

export function testPlayerEventId(value: number): PlayerEventId {
  return parsePlayerEventId(
    `00000000-0000-7000-8000-${value.toString().padStart(12, "0")}`,
  );
}
