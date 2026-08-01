import { describe, expect, test } from "bun:test";
import { clientIdSchema } from "@/datamodel";
import { createClientId } from "@/lib/clientId";

describe("createClientId", () => {
  test("generates valid UUIDv4 values", () => {
    for (let index = 0; index < 100; index += 1) {
      expect(clientIdSchema.safeParse(createClientId()).success).toBe(true);
    }
  });

  test("generates unique values", () => {
    const ids = Array.from({ length: 1_000 }, createClientId);

    expect(new Set(ids).size).toBe(ids.length);
  });

  test("rejects non-v4 UUIDs", () => {
    expect(
      clientIdSchema.safeParse("018f2c42-7c43-7a40-9f62-7d824f7a3dc8").success,
    ).toBe(false);
  });
});
