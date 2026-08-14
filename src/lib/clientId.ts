import { v4 as uuidv4, v7 as uuidv7 } from "uuid";
import {
  type ClientId,
  clientIdSchema,
  type PlayerEventId,
  playerEventIdSchema,
} from "@/datamodel";

export function parseClientId(value: unknown): ClientId {
  return clientIdSchema.parse(value);
}

export function createClientId(): ClientId {
  return parseClientId(uuidv4());
}

export function parsePlayerEventId(value: unknown): PlayerEventId {
  return playerEventIdSchema.parse(value);
}

export function createPlayerEventId(): PlayerEventId {
  return parsePlayerEventId(uuidv7());
}
