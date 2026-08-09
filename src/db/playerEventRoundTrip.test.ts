import { describe, expect, test } from "bun:test";
import type { PlayerEvent } from "@/datamodel";
import { shotPosition } from "@/datamodel";
import { PLAYER_EVENTS_CSV_COLUMN_KEYS } from "@/db/playerEventCsv";
import { testClientId } from "@/testing/clientId";
import type { DbPlayerEvent } from "./index";
import { dbRowToPlayerEvent, playerEventToDbRow } from "./index";

const USER_ID = "test-user";

function shotEvent(
  position: (typeof shotPosition.options)[number],
): PlayerEvent {
  return {
    id: testClientId(1),
    sequence: null,
    player: 7,
    game_id: testClientId(10),
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
    clientId: testClientId(1),
    player: 7,
    gameId: 10,
    ellapsedSeconds: 120,
    eventType: "shot",
    eventGroup: "attack",
    half: "firstHalf",
    shotGoal: true,
    shotDirection: "OnTarget",
    shotAim: "TopLeft",
    shotPosition: "9m+",
    substitutionPlayerIn: null,
    suspensionServedBy: null,
    suspensionEndedSuspensionId: null,
    ...overrides,
  };
}

function suspensionEvent(): PlayerEvent {
  return {
    id: testClientId(2),
    sequence: null,
    player: 7,
    game_id: testClientId(10),
    ellapsed_seconds: 300,
    half: "firstHalf",
    eventType: "twoMinuteSuspension",
    eventGroup: "sanction",
    event: { servedBy: 12 },
  };
}

describe("playerEvent shot position round trip", () => {
  test.each(
    shotPosition.options,
  )("preserves position %s through toDbRow and fromDbRow", (position) => {
    const event = shotEvent(position);
    const row = playerEventToDbRow(event, USER_ID, 10);
    expect(row.shotPosition).toBe(position);

    const parsed = dbRowToPlayerEvent(
      { ...dbShotRow(), ...row, id: 1 } as DbPlayerEvent,
      testClientId(10),
    );

    expect(parsed.eventType).toBe("shot");
    if (parsed.eventType === "shot") {
      expect(parsed.event.position).toBe(position);
    }
  });

  test("shot rows without shotPosition fail to parse", () => {
    expect(() =>
      dbRowToPlayerEvent(dbShotRow({ shotPosition: null }), testClientId(10)),
    ).toThrow();
  });

  test("PLAYER_EVENTS_CSV_COLUMN_KEYS includes shotPosition", () => {
    expect(PLAYER_EVENTS_CSV_COLUMN_KEYS).toContain("shotPosition");
  });

  test("preserves suspension serving player through database round trip", () => {
    const event = suspensionEvent();
    const row = playerEventToDbRow(event, USER_ID, 10);
    expect(row.suspensionServedBy).toBe(12);

    const parsed = dbRowToPlayerEvent(
      {
        ...dbShotRow(),
        ...row,
        id: 1,
        eventType: "twoMinuteSuspension",
        eventGroup: "sanction",
        shotGoal: null,
        shotDirection: null,
        shotAim: null,
        shotPosition: null,
      } as DbPlayerEvent,
      testClientId(10),
    );

    expect(parsed).toMatchObject({
      eventType: "twoMinuteSuspension",
      player: 7,
      event: { servedBy: 12 },
    });
  });

  test("preserves suspension end references and exports lifecycle columns", () => {
    const event: PlayerEvent = {
      id: testClientId(3),
      sequence: null,
      player: 7,
      game_id: testClientId(10),
      ellapsed_seconds: 420,
      half: "secondHalf",
      eventType: "twoMinuteSuspensionEnded",
      eventGroup: "sanction",
      event: { suspensionId: testClientId(2) },
    };
    const row = playerEventToDbRow(event, USER_ID, 10);
    expect(row.suspensionEndedSuspensionId).toBe(testClientId(2));
    expect(PLAYER_EVENTS_CSV_COLUMN_KEYS).toContain("suspensionServedBy");
    expect(PLAYER_EVENTS_CSV_COLUMN_KEYS).toContain(
      "suspensionEndedSuspensionId",
    );

    const parsed = dbRowToPlayerEvent(
      {
        ...dbShotRow(),
        ...row,
        id: 2,
        shotGoal: null,
        shotDirection: null,
        shotAim: null,
        shotPosition: null,
      } as DbPlayerEvent,
      testClientId(10),
    );
    expect(parsed).toMatchObject({
      eventType: "twoMinuteSuspensionEnded",
      player: 7,
      event: { suspensionId: testClientId(2) },
    });
  });
});
