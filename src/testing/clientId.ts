import type { ClientId } from "@/datamodel";

export function testClientId(value: number): ClientId {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`;
}
