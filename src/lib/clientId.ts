import { v4 as uuidv4 } from "uuid";
import { type ClientId, clientIdSchema } from "@/datamodel";

export function createClientId(): ClientId {
  return clientIdSchema.parse(uuidv4());
}
