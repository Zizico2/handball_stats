import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import type { PlayerEvent } from "@/datamodel";
import { dbRowToPlayerEvent, playerEventToDbRow } from "@/db";
import * as schema from "@/db/schema";
import { testClientId } from "@/testing/clientId";
import { getTestDb, resetAppTables } from "./db";

const USER_ID = "user-seven-meter-taken";
const TEAM_ID = testClientId(70);
const GAME_ID = testClientId(71);

async function seedGame() {
  const db = getTestDb();
  const [team] = await db
    .insert(schema.teams)
    .values({ userId: USER_ID, clientId: TEAM_ID, name: "Home" })
    .returning();
  const [game] = await db
    .insert(schema.games)
    .values({
      userId: USER_ID,
      clientId: GAME_ID,
      homeTeamId: team.id,
      createdAt: "2026-08-14T00:00:00.000Z",
    })
    .returning();
  return game;
}

function sevenMeterEvents(): PlayerEvent[] {
  return [
    {
      id: testClientId(72),
      sequence: null,
      player: 7,
      game_id: GAME_ID,
      ellapsed_seconds: 60,
      half: "firstHalf",
      eventType: "sevenMeterTaken",
      eventGroup: "attack",
      event: {
        goal: true,
        direction: "OnTarget",
        aim: "TopLeft",
      },
    },
    {
      id: testClientId(73),
      sequence: null,
      game_id: GAME_ID,
      ellapsed_seconds: 75,
      half: "firstHalf",
      eventType: "sevenMeterTaken",
      eventGroup: "defense",
      event: {
        goal: false,
        direction: "Post",
      },
    },
  ];
}

describe("seven-meter taken persistence (D1)", () => {
  beforeEach(async () => {
    await resetAppTables();
  });

  test("round trips attack and playerless defense attempts with blank positions", async () => {
    const db = getTestDb();
    const game = await seedGame();
    const events = sevenMeterEvents();

    await db
      .insert(schema.playerEvents)
      .values(
        events.map((event) => playerEventToDbRow(event, USER_ID, game.id)),
      );

    const rows = await db
      .select()
      .from(schema.playerEvents)
      .where(eq(schema.playerEvents.userId, USER_ID))
      .orderBy(asc(schema.playerEvents.id));

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      eventType: "sevenMeterTaken",
      eventGroup: "attack",
      player: 7,
      shotPosition: null,
    });
    expect(rows[1]).toMatchObject({
      eventType: "sevenMeterTaken",
      eventGroup: "defense",
      player: null,
      shotPosition: null,
    });
    expect(rows.map((row) => dbRowToPlayerEvent(row, GAME_ID))).toEqual(
      events.map((event, index) => ({ ...event, sequence: rows[index].id })),
    );
  });

  test("rejects a playerless attack attempt and a missing direction", async () => {
    const db = getTestDb();
    const game = await seedGame();

    await expect(
      db.insert(schema.playerEvents).values({
        userId: USER_ID,
        clientId: testClientId(74),
        player: null,
        gameId: game.id,
        ellapsedSeconds: 90,
        eventType: "sevenMeterTaken",
        eventGroup: "attack",
        half: "firstHalf",
        shotGoal: true,
        shotDirection: "OnTarget",
      }),
    ).rejects.toThrow();

    await expect(
      db.insert(schema.playerEvents).values({
        userId: USER_ID,
        clientId: testClientId(75),
        player: null,
        gameId: game.id,
        ellapsedSeconds: 91,
        eventType: "sevenMeterTaken",
        eventGroup: "defense",
        half: "firstHalf",
        shotGoal: false,
        shotDirection: null,
      }),
    ).rejects.toThrow();
  });
});
