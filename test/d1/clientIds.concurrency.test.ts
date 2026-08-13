import { env } from "cloudflare:workers";
import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { type ClientId, playerEventSchema } from "@/datamodel";
import { createDb } from "@/db";
import * as schema from "@/db/schema";
import { testClientId } from "@/testing/clientId";
import { getTestDb, resetAppTables } from "./db";

vi.mock("server-only", () => ({}));

vi.mock("@/server/db", () => ({
  getDb: async () => createDb(env.DB),
}));

const { teamsRoutes } = await import("@/server/api/routes/collections/teams");
const { teamPlayersRoutes } = await import(
  "@/server/api/routes/collections/teamPlayers"
);
const { quickSubPairsRoutes } = await import(
  "@/server/api/routes/collections/quickSubPairs"
);
const { playerEventsRoutes } = await import(
  "@/server/api/routes/collections/playerEvents"
);

const USER_ID = "concurrent-client";

function post(routes: { request: typeof teamsRoutes.request }, body: unknown) {
  return routes.request(
    "/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    { userId: USER_ID },
  );
}

function remove(
  routes: { request: typeof teamsRoutes.request },
  body: unknown,
) {
  return routes.request(
    "/",
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    { userId: USER_ID },
  );
}

describe("client UUID concurrency (D1)", () => {
  beforeEach(resetAppTables);

  test("concurrent roster writes keep unique UUIDs and resolve internal team keys", async () => {
    const teamIds = [testClientId(1), testClientId(2)];
    const teamResponses = await Promise.all([
      post(teamsRoutes, [{ id: teamIds[0], name: "Home" }]),
      post(teamsRoutes, [{ id: teamIds[1], name: "Reserves" }]),
    ]);

    expect(teamResponses.map((response) => response.status)).toEqual([
      200, 200,
    ]);
    const teamRows = await getTestDb()
      .select()
      .from(schema.teams)
      .orderBy(asc(schema.teams.id));
    expect(new Set(teamRows.map((row) => row.clientId))).toEqual(
      new Set(teamIds),
    );
    expect(new Set(teamRows.map((row) => row.id)).size).toBe(2);

    const playerIds = [1, 2, 3, 4].map((id) => testClientId(100 + id));
    const playerResponses = await Promise.all(
      playerIds.map((id, index) =>
        post(teamPlayersRoutes, [
          {
            id,
            teamId: teamIds[0],
            name: `Player ${index + 1}`,
            number: index + 1,
          },
        ]),
      ),
    );
    expect(playerResponses.every((response) => response.status === 200)).toBe(
      true,
    );

    const pairIds = [testClientId(201), testClientId(202)];
    const pairResponses = await Promise.all([
      post(quickSubPairsRoutes, [
        {
          id: pairIds[0],
          teamId: teamIds[0],
          playerNumberA: 1,
          playerNumberB: 2,
        },
      ]),
      post(quickSubPairsRoutes, [
        {
          id: pairIds[1],
          teamId: teamIds[0],
          playerNumberA: 3,
          playerNumberB: 4,
        },
      ]),
    ]);
    expect(pairResponses.every((response) => response.status === 200)).toBe(
      true,
    );

    const homeTeam = teamRows.find((row) => row.clientId === teamIds[0]);
    if (!homeTeam) throw new Error("Home team was not inserted");
    const players = await getTestDb()
      .select()
      .from(schema.teamPlayers)
      .where(eq(schema.teamPlayers.userId, USER_ID));
    const pairs = await getTestDb()
      .select()
      .from(schema.quickSubPairs)
      .where(eq(schema.quickSubPairs.userId, USER_ID));
    expect(players).toHaveLength(4);
    expect(pairs).toHaveLength(2);
    expect(players.every((row) => row.teamId === homeTeam.id)).toBe(true);
    expect(pairs.every((row) => row.teamId === homeTeam.id)).toBe(true);
    expect(new Set(players.map((row) => row.clientId))).toEqual(
      new Set(playerIds),
    );
    expect(new Set(pairs.map((row) => row.clientId))).toEqual(new Set(pairIds));
  });

  test("two-tab events get distinct UUIDs and monotonic server sequences", async () => {
    const db = getTestDb();
    const teamClientId = testClientId(300);
    const gameClientId = testClientId(301);
    const [team] = await db
      .insert(schema.teams)
      .values({ userId: USER_ID, clientId: teamClientId, name: "Home" })
      .returning();
    const [game] = await db
      .insert(schema.games)
      .values({
        userId: USER_ID,
        clientId: gameClientId,
        homeTeamId: team.id,
        createdAt: "2026-08-01T00:00:00.000Z",
      })
      .returning();

    const eventBody = (id: ClientId, player: number) => [
      {
        id,
        sequence: null,
        player,
        game_id: gameClientId,
        ellapsed_seconds: 0,
        half: "firstHalf",
        eventType: "startingPlayer",
        eventGroup: "substitution",
      },
    ];
    const firstIds = [testClientId(401), testClientId(402)];
    const responses = await Promise.all([
      post(playerEventsRoutes, eventBody(firstIds[0], 7)),
      post(playerEventsRoutes, eventBody(firstIds[1], 9)),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const responseEvents = await Promise.all(
      responses.map(async (response) =>
        playerEventSchema
          .array()
          .parse(await response.json())
          .at(0),
      ),
    );
    expect(responseEvents.every((event) => event !== undefined)).toBe(true);
    const parsedResponseEvents = responseEvents.filter(
      (event) => event !== undefined,
    );
    expect(new Set(parsedResponseEvents.map((event) => event.id))).toEqual(
      new Set(firstIds),
    );
    const sequences = parsedResponseEvents.map((event) => event.sequence);
    expect(sequences.every((sequence) => sequence !== null)).toBe(true);
    expect(sequences.toSorted((a, b) => (a ?? 0) - (b ?? 0))).toEqual([1, 2]);

    await db
      .delete(schema.playerEvents)
      .where(eq(schema.playerEvents.clientId, firstIds[1]));
    const thirdId = testClientId(403);
    const thirdResponse = await post(
      playerEventsRoutes,
      eventBody(thirdId, 12),
    );
    expect(thirdResponse.status).toBe(200);
    expect(await thirdResponse.json()).toEqual([
      expect.objectContaining({ id: thirdId, sequence: 3 }),
    ]);

    const rows = await db
      .select()
      .from(schema.playerEvents)
      .where(eq(schema.playerEvents.gameId, game.id))
      .orderBy(asc(schema.playerEvents.id));
    expect(rows.map((row) => row.id)).toEqual([1, 3]);
  });

  test("suspension end events reference one suspension and preserve both players", async () => {
    const db = getTestDb();
    const teamClientId = testClientId(500);
    const gameClientId = testClientId(501);
    const suspensionId = testClientId(502);
    const endId = testClientId(503);
    const [team] = await db
      .insert(schema.teams)
      .values({ userId: USER_ID, clientId: teamClientId, name: "Home" })
      .returning();
    await db.insert(schema.games).values({
      userId: USER_ID,
      clientId: gameClientId,
      homeTeamId: team.id,
      createdAt: "2026-08-01T00:00:00.000Z",
      firstHalfStartedAtMs: Date.now() - 1_000,
    });

    const suspensionResponse = await post(playerEventsRoutes, [
      {
        id: suspensionId,
        sequence: null,
        player: 7,
        game_id: gameClientId,
        ellapsed_seconds: 0,
        half: "firstHalf",
        eventType: "twoMinuteSuspension",
        eventGroup: "sanction",
        event: { servedBy: 12 },
      },
    ]);
    expect(suspensionResponse.status).toBe(200);
    const suspension = (await suspensionResponse.json())[0];
    expect(suspension).toMatchObject({
      id: suspensionId,
      player: 7,
      eventType: "twoMinuteSuspension",
      event: { servedBy: 12 },
    });

    const endResponse = await post(playerEventsRoutes, [
      {
        id: endId,
        sequence: null,
        player: 7,
        game_id: gameClientId,
        ellapsed_seconds: 0,
        half: "firstHalf",
        eventType: "twoMinuteSuspensionEnded",
        eventGroup: "sanction",
        event: { suspensionId },
      },
    ]);
    expect(endResponse.status).toBe(200);
    expect((await endResponse.json())[0]).toMatchObject({
      id: endId,
      player: 7,
      eventType: "twoMinuteSuspensionEnded",
      event: { suspensionId },
    });

    const duplicateEndResponse = await post(playerEventsRoutes, [
      {
        id: testClientId(504),
        sequence: null,
        player: 7,
        game_id: gameClientId,
        ellapsed_seconds: 0,
        half: "firstHalf",
        eventType: "twoMinuteSuspensionEnded",
        eventGroup: "sanction",
        event: { suspensionId },
      },
    ]);
    expect(duplicateEndResponse.status).toBe(409);

    const invalidEndResponse = await post(playerEventsRoutes, [
      {
        id: testClientId(505),
        sequence: null,
        player: 7,
        game_id: gameClientId,
        ellapsed_seconds: 0,
        half: "firstHalf",
        eventType: "twoMinuteSuspensionEnded",
        eventGroup: "sanction",
        event: { suspensionId: testClientId(999) },
      },
    ]);
    expect(invalidEndResponse.status).toBe(400);

    const deleteResponse = await remove(playerEventsRoutes, [suspensionId]);
    expect(deleteResponse.status).toBe(204);
    const remainingLifecycleRows = await db
      .select()
      .from(schema.playerEvents)
      .where(eq(schema.playerEvents.userId, USER_ID));
    expect(
      remainingLifecycleRows.some(
        (row) => row.clientId === suspensionId || row.clientId === endId,
      ),
    ).toBe(false);
  });

  test("accepts a suspension start and end in the same POST batch", async () => {
    const db = getTestDb();
    const teamClientId = testClientId(600);
    const gameClientId = testClientId(601);
    const suspensionId = testClientId(602);
    const endId = testClientId(603);
    const [team] = await db
      .insert(schema.teams)
      .values({ userId: USER_ID, clientId: teamClientId, name: "Home" })
      .returning();
    await db.insert(schema.games).values({
      userId: USER_ID,
      clientId: gameClientId,
      homeTeamId: team.id,
      createdAt: "2026-08-01T00:00:00.000Z",
      firstHalfStartedAtMs: Date.now() - 1_000,
    });

    const response = await post(playerEventsRoutes, [
      {
        id: suspensionId,
        sequence: null,
        player: 7,
        game_id: gameClientId,
        ellapsed_seconds: 0,
        half: "firstHalf",
        eventType: "twoMinuteSuspension",
        eventGroup: "sanction",
        event: { servedBy: 7 },
      },
      {
        id: endId,
        sequence: null,
        player: 7,
        game_id: gameClientId,
        ellapsed_seconds: 0,
        half: "firstHalf",
        eventType: "twoMinuteSuspensionEnded",
        eventGroup: "sanction",
        event: { suspensionId },
      },
    ]);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      expect.objectContaining({
        id: suspensionId,
        player: 7,
        eventType: "twoMinuteSuspension",
        event: { servedBy: 7 },
      }),
      expect.objectContaining({
        id: endId,
        player: 7,
        eventType: "twoMinuteSuspensionEnded",
        event: { suspensionId },
      }),
    ]);
  });
});
