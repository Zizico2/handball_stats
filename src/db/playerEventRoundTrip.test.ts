import { describe, expect, test } from "bun:test";
import type { PlayerEvent } from "@/datamodel";
import { playerEventSchema, shotPosition } from "@/datamodel";
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

function defenseShotEvent(): PlayerEvent {
  return {
    id: testClientId(4),
    sequence: null,
    game_id: testClientId(10),
    ellapsed_seconds: 120,
    half: "firstHalf",
    eventType: "shot",
    eventGroup: "defense",
    event: {
      goal: true,
      direction: "OnTarget",
      aim: "BottomRight",
      position: "rightWing",
    },
  };
}

function attackSevenMeterTakenEvent(): Extract<
  PlayerEvent,
  { eventType: "sevenMeterTaken"; eventGroup: "attack" }
> {
  return {
    id: testClientId(7),
    sequence: null,
    player: 7,
    game_id: testClientId(10),
    ellapsed_seconds: 130,
    half: "firstHalf",
    eventType: "sevenMeterTaken",
    eventGroup: "attack",
    event: {
      goal: true,
      direction: "OnTarget",
      aim: "TopCenter",
    },
  };
}

function defenseSevenMeterTakenEvent(): Extract<
  PlayerEvent,
  { eventType: "sevenMeterTaken"; eventGroup: "defense" }
> {
  return {
    id: testClientId(8),
    sequence: null,
    game_id: testClientId(10),
    ellapsed_seconds: 140,
    half: "firstHalf",
    eventType: "sevenMeterTaken",
    eventGroup: "defense",
    event: {
      goal: false,
      direction: "Post",
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

  test("round trips a playerless defense shot", () => {
    const event = defenseShotEvent();
    const row = playerEventToDbRow(event, USER_ID, 10);
    expect(row.player).toBeNull();
    expect(row.eventGroup).toBe("defense");
    expect(PLAYER_EVENTS_CSV_COLUMN_KEYS).toContain("player");

    const parsed = dbRowToPlayerEvent(
      {
        ...dbShotRow(),
        ...row,
        id: 4,
      } as DbPlayerEvent,
      testClientId(10),
    );

    expect(parsed).toMatchObject({ ...event, sequence: 4 });
  });

  test("round trips seven-meter attempts without a position", () => {
    const events = [
      attackSevenMeterTakenEvent(),
      defenseSevenMeterTakenEvent(),
    ];

    for (const [index, event] of events.entries()) {
      const row = playerEventToDbRow(event, USER_ID, 10);
      expect(row.player).toBe(event.eventGroup === "attack" ? 7 : null);
      expect(row.shotPosition).toBeNull();
      expect(row.shotDirection).toBe(event.event.direction);

      const parsed = dbRowToPlayerEvent(
        {
          ...dbShotRow(),
          ...row,
          id: 7 + index,
        } as DbPlayerEvent,
        testClientId(10),
      );

      expect(parsed).toEqual({ ...event, sequence: 7 + index });
      expect(parsed.eventType).toBe("sevenMeterTaken");
      if (parsed.eventType === "sevenMeterTaken") {
        expect(parsed.event).not.toHaveProperty("position");
      }
    }
  });

  test("validates seven-meter player and shot-result requirements", () => {
    expect(
      playerEventSchema.parse(defenseSevenMeterTakenEvent()),
    ).not.toHaveProperty("player");
    expect(() =>
      playerEventSchema.parse({
        ...defenseSevenMeterTakenEvent(),
        eventGroup: "attack",
      }),
    ).toThrow();
    expect(() =>
      playerEventSchema.parse({
        ...attackSevenMeterTakenEvent(),
        event: { goal: true, direction: "Post" },
      }),
    ).toThrow();
  });

  test("keeps offensive fouls distinct by event group", () => {
    const events: PlayerEvent[] = [
      {
        id: testClientId(5),
        sequence: null,
        player: 7,
        game_id: testClientId(10),
        ellapsed_seconds: 120,
        half: "firstHalf",
        eventType: "offensiveFoul",
        eventGroup: "attack",
      },
      {
        id: testClientId(6),
        sequence: null,
        player: 12,
        game_id: testClientId(10),
        ellapsed_seconds: 121,
        half: "firstHalf",
        eventType: "offensiveFoul",
        eventGroup: "defense",
      },
    ];

    for (const event of events) {
      const row = playerEventToDbRow(event, USER_ID, 10);
      const parsed = dbRowToPlayerEvent(
        { ...dbShotRow(), ...row, id: event.sequence ?? 5 } as DbPlayerEvent,
        testClientId(10),
      );
      expect(parsed).toMatchObject({
        eventType: "offensiveFoul",
        eventGroup: event.eventGroup,
        player: "player" in event ? event.player : null,
      });
    }
  });

  test("validates player requirements by event group", () => {
    expect(playerEventSchema.parse(defenseShotEvent())).not.toHaveProperty(
      "player",
    );
    expect(() =>
      playerEventSchema.parse({
        ...defenseShotEvent(),
        eventGroup: "attack",
      }),
    ).toThrow();
    expect(
      playerEventSchema.parse({
        ...defenseShotEvent(),
        eventGroup: "attack",
        player: 7,
      }),
    ).toMatchObject({ eventGroup: "attack", player: 7 });
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
