import { v4 as uuidv4, v7 as uuidv7 } from "uuid";
import { type ClientId, clientIdSchema } from "@/datamodel";

export function parseClientId(value: unknown): ClientId {
  return clientIdSchema.parse(value);
}

export function createClientId(): ClientId {
  return parseClientId(uuidv4());
}

export function createPlayerEventId(): ClientId {
  return parseClientId(uuidv7());
}
