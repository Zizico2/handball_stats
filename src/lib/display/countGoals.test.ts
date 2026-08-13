import { describe, expect, test } from "bun:test";
import type { PlayerEvent } from "@/datamodel";
import { countGoals, countScores } from "./countGoals";

const base = {
  id: "00000000-0000-4000-8000-000000000001" as PlayerEvent["id"],
  sequence: 1,
  game_id: "00000000-0000-4000-8000-000000000002" as PlayerEvent["game_id"],
  ellapsed_seconds: 30,
  half: "firstHalf" as const,
};

const attackGoal: PlayerEvent = {
  ...base,
  player: 7,
  eventType: "shot",
  eventGroup: "attack",
  event: {
    goal: true,
    position: "9m+",
    direction: "OnTarget",
    aim: "TopLeft",
  },
};

const defenseGoal: PlayerEvent = {
  ...base,
  id: "00000000-0000-4000-8000-000000000003" as PlayerEvent["id"],
  eventType: "shot",
  eventGroup: "defense",
  event: {
    goal: true,
    position: "6m+",
    direction: "OnTarget",
    aim: "TopRight",
  },
};

describe("countScores", () => {
  test("separates attack and defense shot goals", () => {
    expect(countScores([attackGoal, defenseGoal])).toEqual({
      teamScore: 1,
      opponentScore: 1,
    });
    expect(countGoals([attackGoal, defenseGoal])).toBe(1);
  });

  test("ignores misses and non-shot events", () => {
    const miss: PlayerEvent = {
      ...attackGoal,
      id: "00000000-0000-4000-8000-000000000004" as PlayerEvent["id"],
      event: { ...attackGoal.event, goal: false },
    };
    const foul: PlayerEvent = {
      ...base,
      id: "00000000-0000-4000-8000-000000000005" as PlayerEvent["id"],
      player: 12,
      eventType: "offensiveFoul",
      eventGroup: "attack",
    };
    expect(countScores([miss, foul])).toEqual({
      teamScore: 0,
      opponentScore: 0,
    });
  });
});
