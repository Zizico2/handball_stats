import { describe, expect, test } from "bun:test";
import { version } from "uuid";
import { clientIdSchema, playerEventIdSchema } from "@/datamodel";
import {
  createClientId,
  createPlayerEventId,
  parsePlayerEventId,
} from "@/lib/clientId";

describe("client and player-event identifiers", () => {
  test("generates valid UUIDv4 values", () => {
    for (let index = 0; index < 100; index += 1) {
      const id = createClientId();
      expect(clientIdSchema.safeParse(id).success).toBe(true);
      expect(version(id)).toBe(4);
    }
  });

  test("generates unique values", () => {
    const ids = Array.from({ length: 1_000 }, createClientId);

    expect(new Set(ids).size).toBe(ids.length);
  });

  test("generates monotonically ordered UUIDv7 player event IDs", () => {
    const originalDateNow = Date.now;
    Date.now = () => 1_786_708_800_000;

    let ids: ReturnType<typeof createPlayerEventId>[];
    try {
      ids = Array.from({ length: 1_000 }, createPlayerEventId);
    } finally {
      Date.now = originalDateNow;
    }

    expect(ids.every((id) => version(id) === 7)).toBe(true);
    expect(ids).toEqual(ids.toSorted());
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("keeps client and player-event identifier schemas distinct", () => {
    const uuidV4 = "00000000-0000-4000-8000-000000000000";
    const uuidV7 = "018f2c42-7c43-7a40-9f62-7d824f7a3dc8";

    expect(clientIdSchema.safeParse(uuidV4).success).toBe(true);
    expect(clientIdSchema.safeParse(uuidV7).success).toBe(false);
    expect(playerEventIdSchema.safeParse(uuidV4).success).toBe(false);
    expect(playerEventIdSchema.safeParse(uuidV7).success).toBe(true);
    expect(version(parsePlayerEventId(uuidV7))).toBe(7);
  });
});
