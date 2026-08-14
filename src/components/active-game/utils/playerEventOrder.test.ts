import { describe, expect, test } from "bun:test";
import type { PlayerEvent } from "@/datamodel";
import { parseClientId } from "@/lib/clientId";
import { testClientId } from "@/testing/clientId";
import { comparePlayerEventOrder } from "./playerEventOrder";

const UUID_V7_IDS = [
  "018f2c42-7c43-7a40-9f62-7d824f7a3dc8",
  "018f2c42-7c43-7a40-9f62-7d824f7a3dc9",
  "018f2c42-7c44-7a40-9f62-7d824f7a3dc8",
].map(parseClientId);

function event(id: number, sequence: number | null): PlayerEvent {
  return {
    id: testClientId(id),
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
  test("sorts unordered persisted events by server sequence", () => {
    const events = [event(30, 30), event(10, 10), event(20, 20)];

    expect(
      events.toSorted(comparePlayerEventOrder).map((item) => item.sequence),
    ).toEqual([10, 20, 30]);
  });

  test("places optimistic events after all persisted events", () => {
    const events = [event(3, null), event(2, 20), event(1, 10)];

    expect(
      events.toSorted(comparePlayerEventOrder).map((item) => item.id),
    ).toEqual([testClientId(1), testClientId(2), testClientId(3)]);
  });

  test("retains collection order for optimistic legacy events", () => {
    const events = [event(3, null), event(1, null), event(2, null)];

    expect(
      events.toSorted(comparePlayerEventOrder).map((item) => item.id),
    ).toEqual([testClientId(3), testClientId(1), testClientId(2)]);
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

  test("places historical UUIDv4 events before UUIDv7 events", () => {
    const events = [v7Event(1, 1), event(1, 100)];

    expect(
      events.toSorted(comparePlayerEventOrder).map((item) => item.id),
    ).toEqual([testClientId(1), UUID_V7_IDS[0]]);
  });
});
