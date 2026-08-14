import { describe, expect, test } from "bun:test";
import type { PlayerEvent } from "@/datamodel";
import { testClientId, testPlayerEventId } from "@/testing/clientId";
import { getActivePlayers } from "./activePlayers";

function starter(
  id: number,
  player: number,
  half: "firstHalf" | "secondHalf" = "firstHalf",
): PlayerEvent {
  return {
    id: testPlayerEventId(id),
    sequence: id,
    player,
    game_id: testClientId(100),
    ellapsed_seconds: 0,
    half,
    eventType: "startingPlayer",
    eventGroup: "substitution",
  };
}

function substitution(
  id: number,
  player: number,
  playerIn: number,
  half: "firstHalf" | "secondHalf" = "firstHalf",
): PlayerEvent {
  return {
    id: testPlayerEventId(id),
    sequence: id,
    player,
    game_id: testClientId(100),
    ellapsed_seconds: 30,
    half,
    eventType: "substitution",
    eventGroup: "substitution",
    event: { playerIn },
  };
}

function shot(id: number, player: number): PlayerEvent {
  return {
    id: testPlayerEventId(id),
    sequence: id,
    player,
    game_id: testClientId(100),
    ellapsed_seconds: 15,
    half: "firstHalf",
    eventType: "shot",
    eventGroup: "attack",
    event: {
      goal: false,
      position: "9m+",
      direction: "OffTarget",
    },
  };
}

function sortedPlayers(events: PlayerEvent[]) {
  return [...getActivePlayers(events)].sort((a, b) => a - b);
}

describe("getActivePlayers", () => {
  test("returns empty for no events or unrelated gameplay events", () => {
    expect(sortedPlayers([])).toEqual([]);
    expect(sortedPlayers([shot(1, 7), shot(2, 12)])).toEqual([]);
  });

  test("derives first-half starters in event-id order from unordered input", () => {
    expect(
      sortedPlayers([starter(30, 12), starter(10, 7), starter(20, 9)]),
    ).toEqual([7, 9, 12]);
  });

  test("applies substitutions and player re-entry", () => {
    expect(
      sortedPlayers([
        substitution(4, 9, 7),
        starter(2, 12),
        substitution(3, 7, 9),
        starter(1, 7),
      ]),
    ).toEqual([7, 12]);
  });

  test("clears first-half players once, keeps all second-half starters, and applies later substitutions", () => {
    expect(
      sortedPlayers([
        substitution(50, 9, 7, "secondHalf"),
        starter(40, 12, "secondHalf"),
        starter(10, 7),
        starter(30, 9, "secondHalf"),
        starter(20, 12),
      ]),
    ).toEqual([7, 12]);
  });
});
