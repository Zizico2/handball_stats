import { describe, expect, test } from "bun:test";
import type { PlayerEvent } from "@/datamodel";
import { testClientId } from "@/testing/clientId";
import { comparePlayerEventOrder } from "./playerEventOrder";

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

  test("uses client UUIDs only to make optimistic ties deterministic", () => {
    const events = [event(3, null), event(1, null), event(2, null)];

    expect(
      events.toSorted(comparePlayerEventOrder).map((item) => item.id),
    ).toEqual([testClientId(1), testClientId(2), testClientId(3)]);
  });
});
