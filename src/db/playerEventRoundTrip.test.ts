import { describe, expect, test } from "bun:test";
import type { PlayerEvent } from "@/datamodel";
import { shotPosition } from "@/datamodel";
import { PLAYER_EVENTS_CSV_COLUMN_KEYS } from "@/db/playerEventCsv";
import type { DbPlayerEvent } from "./index";
import { dbRowToPlayerEvent, playerEventToDbRow } from "./index";

const USER_ID = "test-user";

function shotEvent(
  position: (typeof shotPosition.options)[number],
): PlayerEvent {
  return {
    id: 1,
    player: 7,
    game_id: 10,
    ellapsed_seconds: 120,
    half: "firstHalf",
    eventType: "shot",
    eventGroup: "attack",
    event: {
      goal: true,
      direction: "OnTarget",
      aim: "TopLeft",
      position,
    },
  };
}

function dbShotRow(overrides: Partial<DbPlayerEvent> = {}): DbPlayerEvent {
  return {
    id: 1,
    userId: USER_ID,
    localId: 1,
    player: 7,
    gameLocalId: 10,
    ellapsedSeconds: 120,
    eventType: "shot",
    eventGroup: "attack",
    half: "firstHalf",
    shotGoal: true,
    shotDirection: "OnTarget",
    shotAim: "TopLeft",
    shotPosition: "9m+",
    substitutionPlayerIn: null,
    eventSequence: null,
    ...overrides,
  };
}

describe("playerEvent shot position round trip", () => {
  test.each(
    shotPosition.options,
  )("preserves position %s through toDbRow and fromDbRow", (position) => {
    const event = shotEvent(position);
    const row = playerEventToDbRow(event, USER_ID);
    expect(row.shotPosition).toBe(position);

    const parsed = dbRowToPlayerEvent({
      ...dbShotRow(),
      ...row,
      id: 1,
    } as DbPlayerEvent);

    expect(parsed.eventType).toBe("shot");
    if (parsed.eventType === "shot") {
      expect(parsed.event.position).toBe(position);
    }
  });

  test("shot rows without shotPosition fail to parse", () => {
    expect(() =>
      dbRowToPlayerEvent(dbShotRow({ shotPosition: null })),
    ).toThrow();
  });

  test("PLAYER_EVENTS_CSV_COLUMN_KEYS includes shotPosition", () => {
    expect(PLAYER_EVENTS_CSV_COLUMN_KEYS).toContain("shotPosition");
  });
});
