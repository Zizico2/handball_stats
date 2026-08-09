import type { ClientId } from "@/datamodel";
import { parseClientId } from "@/lib/clientId";

export function testClientId(value: number): ClientId {
  return parseClientId(
    `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`,
  );
}
