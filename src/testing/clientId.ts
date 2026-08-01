import { type ClientId, clientIdSchema } from "@/datamodel";

export function testClientId(value: number): ClientId {
  return clientIdSchema.parse(
    `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`,
  );
}
