import { v4 as uuidv4 } from "uuid";
import { type ClientId, clientIdSchema } from "@/datamodel";

export function parseClientId(value: unknown): ClientId {
  return clientIdSchema.parse(value);
}

export function createClientId(): ClientId {
  return parseClientId(uuidv4());
}
