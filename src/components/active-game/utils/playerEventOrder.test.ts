import { describe, expect, test } from "bun:test";
import type { PlayerEvent } from "@/datamodel";
import { parsePlayerEventId } from "@/lib/clientId";
import { testClientId, testPlayerEventId } from "@/testing/clientId";
import { comparePlayerEventOrder } from "./playerEventOrder";

const UUID_V7_IDS = [
  "018f2c42-7c43-7a40-9f62-7d824f7a3dc8",
  "018f2c42-7c43-7a40-9f62-7d824f7a3dc9",
  "018f2c42-7c44-7a40-9f62-7d824f7a3dc8",
].map(parsePlayerEventId);

function event(id: number, sequence: number | null): PlayerEvent {
  return {
    id: testPlayerEventId(id),
    sequence,
    player: 7,
    game_id: testClientId(100),
    ellapsed_seconds: 0,
    half: "firstHalf",
    eventType: "startingPlayer",
    eventGroup: "substitution",
  };
}

function v7Event(id: number, sequence: number | null): PlayerEvent {
  return {
    ...event(id, sequence),
    id: UUID_V7_IDS[id - 1],
  };
}

describe("comparePlayerEventOrder", () => {
  test("sorts persisted events by UUIDv7 creation order", () => {
    const events = [event(30, 10), event(10, 30), event(20, 20)];

    expect(
      events.toSorted(comparePlayerEventOrder).map((item) => item.id),
    ).toEqual([
      testPlayerEventId(10),
      testPlayerEventId(20),
      testPlayerEventId(30),
    ]);
  });

  test("orders optimistic and persisted events together", () => {
    const events = [event(3, null), event(2, 20), event(1, 10)];

    expect(
      events.toSorted(comparePlayerEventOrder).map((item) => item.id),
    ).toEqual([
      testPlayerEventId(1),
      testPlayerEventId(2),
      testPlayerEventId(3),
    ]);
  });

  test("does not use collection order for optimistic events", () => {
    const events = [event(3, null), event(1, null), event(2, null)];

    expect(
      events.toSorted(comparePlayerEventOrder).map((item) => item.id),
    ).toEqual([
      testPlayerEventId(1),
      testPlayerEventId(2),
      testPlayerEventId(3),
    ]);
  });

  test("orders UUIDv7 events by client creation regardless of persistence", () => {
    const events = [v7Event(2, 10), v7Event(3, null), v7Event(1, null)];

    expect(
      events.toSorted(comparePlayerEventOrder).map((item) => item.id),
    ).toEqual(UUID_V7_IDS);
  });

  test("does not let reversed server sequences change UUIDv7 order", () => {
    const events = [v7Event(2, 1), v7Event(1, 2)];

    expect(
      events.toSorted(comparePlayerEventOrder).map((item) => item.id),
    ).toEqual(UUID_V7_IDS.slice(0, 2));
  });

  test("backfilled epoch-zero events precede newly created events", () => {
    const events = [v7Event(1, 1), event(1, 100)];

    expect(
      events.toSorted(comparePlayerEventOrder).map((item) => item.id),
    ).toEqual([event(1, 100).id, UUID_V7_IDS[0]]);
  });
});
