import { describe, expect, test } from "bun:test";
import { getActivePlayers } from "@/components/active-game/utils/activePlayers";
import {
  formatUndoEventLabel,
  getLastUndoableEvent,
} from "@/components/active-game/utils/lastUndoableEvent";
import type { PlayerEvent } from "@/datamodel";
import { countGoals } from "@/lib/display/countGoals";

const getPlayerLabel = (number: number) => `#${number}`;

function startingPlayer(
  id: number,
  player: number,
  half: "firstHalf" | "secondHalf" = "firstHalf",
): PlayerEvent {
  return {
    id,
    player,
    game_id: 1,
    ellapsed_seconds: 0,
    half,
    eventType: "startingPlayer",
    eventGroup: "substitution",
  };
}

function shot(
  id: number,
  player: number,
  goal: boolean,
  ellapsed_seconds = 60,
): PlayerEvent {
  return {
    id,
    player,
    game_id: 1,
    ellapsed_seconds,
    half: "firstHalf",
    eventType: "shot",
    eventGroup: "attack",
    event: {
      goal,
      position: "9m+",
      direction: "OnTarget",
      aim: "TopLeft",
    },
  };
}

function substitution(
  id: number,
  playerOut: number,
  playerIn: number,
  ellapsed_seconds = 90,
): PlayerEvent {
  return {
    id,
    player: playerOut,
    game_id: 1,
    ellapsed_seconds,
    half: "firstHalf",
    eventType: "substitution",
    eventGroup: "substitution",
    event: { playerIn },
  };
}

function yellowCard(id: number, player: number): PlayerEvent {
  return {
    id,
    player,
    game_id: 1,
    ellapsed_seconds: 120,
    half: "firstHalf",
    eventType: "yellowCard",
    eventGroup: "sanction",
  };
}

describe("getLastUndoableEvent", () => {
  test("returns null when only starting lineup exists", () => {
    expect(
      getLastUndoableEvent([startingPlayer(1, 7), startingPlayer(2, 12)]),
    ).toBeNull();
  });

  test("skips startingPlayer and returns highest id gameplay event", () => {
    const events: PlayerEvent[] = [
      startingPlayer(1, 7),
      startingPlayer(2, 12),
      shot(3, 7, true),
      substitution(5, 7, 9),
      yellowCard(4, 12),
    ];

    const last = getLastUndoableEvent(events);
    expect(last?.id).toBe(5);
    expect(last?.eventType).toBe("substitution");
  });
});

describe("formatUndoEventLabel", () => {
  test("formats shots, substitutions, and sanctions", () => {
    expect(formatUndoEventLabel(shot(1, 7, true), getPlayerLabel)).toBe(
      "#7 — Shot (Goal)",
    );
    expect(formatUndoEventLabel(shot(2, 7, false), getPlayerLabel)).toBe(
      "#7 — Shot (Miss)",
    );
    expect(formatUndoEventLabel(substitution(3, 7, 9), getPlayerLabel)).toBe(
      "#7 → #9",
    );
    expect(formatUndoEventLabel(yellowCard(4, 12), getPlayerLabel)).toBe(
      "#12 — Yellow Card",
    );
  });
});

describe("undo derived state", () => {
  test("removing a goal shot updates countGoals", () => {
    const events: PlayerEvent[] = [
      startingPlayer(1, 7),
      shot(2, 7, true),
      shot(3, 12, false),
    ];
    expect(countGoals(events)).toBe(1);

    const last = getLastUndoableEvent(events);
    expect(last?.id).toBe(3);
    const afterUndo = events.filter((event) => event.id !== last?.id);
    // Miss was last; goals unchanged until the goal is undone
    expect(countGoals(afterUndo)).toBe(1);

    const afterGoalUndo = afterUndo.filter((event) => event.id !== 2);
    expect(countGoals(afterGoalUndo)).toBe(0);
  });

  test("removing a substitution restores on-court players", () => {
    const events: PlayerEvent[] = [
      startingPlayer(1, 7),
      startingPlayer(2, 12),
      substitution(3, 7, 9),
    ];
    expect([...getActivePlayers(events)].sort((a, b) => a - b)).toEqual([
      9, 12,
    ]);

    const last = getLastUndoableEvent(events);
    const afterUndo = events.filter((event) => event.id !== last?.id);
    expect([...getActivePlayers(afterUndo)].sort((a, b) => a - b)).toEqual([
      7, 12,
    ]);
  });
});
