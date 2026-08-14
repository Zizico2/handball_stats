import { describe, expect, test } from "bun:test";
import type { PlayerEvent } from "@/datamodel";
import { testClientId, testPlayerEventId } from "@/testing/clientId";
import {
  getActiveSuspensionPlayerNumbers,
  getActiveSuspensions,
  getActiveSuspensionsForPlayer,
} from "./activeSuspensions";

function suspension(
  id: number,
  offender: number,
  servedBy = offender,
): PlayerEvent {
  return {
    id: testPlayerEventId(id),
    sequence: id,
    player: offender,
    game_id: testClientId(100),
    ellapsed_seconds: id * 10,
    half: id % 2 === 0 ? "secondHalf" : "firstHalf",
    eventType: "twoMinuteSuspension",
    eventGroup: "sanction",
    event: { servedBy },
  };
}

function ended(id: number, suspensionId: number): PlayerEvent {
  return {
    id: testPlayerEventId(id),
    sequence: id,
    player: 7,
    game_id: testClientId(100),
    ellapsed_seconds: id * 10,
    half: "secondHalf",
    eventType: "twoMinuteSuspensionEnded",
    eventGroup: "sanction",
    event: { suspensionId: testPlayerEventId(suspensionId) },
  };
}

describe("active suspensions", () => {
  test("keeps a suspension active until its matching end event", () => {
    const events = [suspension(1, 7, 12), ended(2, 1)];

    expect(getActiveSuspensions(events)).toEqual([]);
    expect(getActiveSuspensionPlayerNumbers(events)).toEqual(new Set());
  });

  test("marks both offender and serving player", () => {
    const events = [suspension(1, 7, 12), suspension(2, 9)];

    expect(getActiveSuspensionPlayerNumbers(events)).toEqual(
      new Set([7, 12, 9]),
    );
    expect(getActiveSuspensionsForPlayer(events, 12)).toHaveLength(1);
    expect(getActiveSuspensionsForPlayer(events, 7)).toHaveLength(1);
  });

  test("supports repeated and unordered events", () => {
    const events = [ended(5, 1), suspension(2, 9), suspension(1, 7, 12)];

    expect(getActiveSuspensions(events).map((item) => item.id)).toEqual([
      testPlayerEventId(2),
    ]);
  });

  test("returns suspension metadata for warning details", () => {
    expect(getActiveSuspensions([suspension(3, 7, 12)])).toEqual([
      {
        id: testPlayerEventId(3),
        offender: 7,
        servedBy: 12,
        half: "firstHalf",
        ellapsedSeconds: 30,
      },
    ]);
  });

  test("does not expire during a first-half overrun or halftime", () => {
    const overrunStart = suspension(7, 7, 12);
    overrunStart.ellapsed_seconds = 1905;
    const secondHalfEnd = ended(8, 7);
    secondHalfEnd.half = "secondHalf";
    secondHalfEnd.ellapsed_seconds = 0;

    expect(getActiveSuspensions([overrunStart])).toHaveLength(1);
    expect(getActiveSuspensions([overrunStart, secondHalfEnd])).toEqual([]);
  });

  test("restores and removes warnings as matching events are undone", () => {
    const start = suspension(9, 7, 12);
    const end = ended(10, 9);

    expect(getActiveSuspensions([start, end])).toEqual([]);
    expect(getActiveSuspensions([start])).toHaveLength(1);
    expect(getActiveSuspensions([])).toEqual([]);
  });
});
