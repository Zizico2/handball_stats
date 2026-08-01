import { v4 as uuidv4 } from "uuid";
import type { ClientId } from "@/datamodel";

export function createClientId(): ClientId {
  return uuidv4();
}
