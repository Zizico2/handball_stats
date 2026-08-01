import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createDb } from "@/db";
import * as schema from "@/db/schema";
import { testClientId } from "@/testing/clientId";
import { getTestDb, resetAppTables } from "./db";

vi.mock("server-only", () => ({}));

vi.mock("@/server/db", () => ({
  getDb: async () => createDb(env.DB),
}));

const { quickSubPairsRoutes } = await import(
  "@/server/api/routes/collections/quickSubPairs"
);
const { teamPlayersRoutes } = await import(
  "@/server/api/routes/collections/teamPlayers"
);

const USER_ID = "quick-sub-user";
const OTHER_USER_ID = "other-quick-sub-user";
const teamInternalIds = new Map<string, number>();

const teamKey = (userId: string, teamId: number) => `${userId}:${teamId}`;

async function seedTeam(userId: string, teamId: number, name: string) {
  const [team] = await getTestDb()
    .insert(schema.teams)
    .values({ userId, clientId: testClientId(teamId), name })
    .returning();
  teamInternalIds.set(teamKey(userId, teamId), team.id);
}

async function seedPlayer({
  userId = USER_ID,
  id,
  teamId,
  number,
}: {
  userId?: string;
  id: number;
  teamId: number;
  number: number;
}) {
  const internalTeamId = teamInternalIds.get(teamKey(userId, teamId));
  if (internalTeamId === undefined)
    throw new Error("Team must be seeded first");
  await getTestDb()
    .insert(schema.teamPlayers)
    .values({
      userId,
      clientId: testClientId(id),
      teamId: internalTeamId,
      name: `Player ${number}`,
      number,
    });
}

async function seedPair({
  userId = USER_ID,
  id,
  teamId,
  numberA,
  numberB,
}: {
  userId?: string;
  id: number;
  teamId: number;
  numberA: number;
  numberB: number;
}) {
  const internalTeamId = teamInternalIds.get(teamKey(userId, teamId));
  if (internalTeamId === undefined)
    throw new Error("Team must be seeded first");
  await getTestDb()
    .insert(schema.quickSubPairs)
    .values({
      userId,
      clientId: testClientId(id),
      teamId: internalTeamId,
      playerNumberA: numberA,
      playerNumberB: numberB,
    });
}

function createPairsRequest(
  items: Array<{
    id: number;
    teamId: number;
    playerNumberA: number;
    playerNumberB: number;
  }>,
) {
  return quickSubPairsRoutes.request(
    "/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        items.map((item) => ({
          ...item,
          id: testClientId(item.id),
          teamId: testClientId(item.teamId),
        })),
      ),
    },
    { userId: USER_ID },
  );
}

function deletePlayersRequest(ids: number[]) {
  return teamPlayersRoutes.request(
    "/",
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids.map(testClientId)),
    },
    { userId: USER_ID },
  );
}

async function pairsForUser(userId: string) {
  return getTestDb()
    .select()
    .from(schema.quickSubPairs)
    .where(eq(schema.quickSubPairs.userId, userId));
}

describe("quick-sub pair integrity API (D1)", () => {
  beforeEach(async () => {
    await resetAppTables();
    teamInternalIds.clear();
    await seedTeam(USER_ID, 10, "Home");
    await seedTeam(USER_ID, 20, "Reserves");
    await seedTeam(OTHER_USER_ID, 10, "Other home");

    await seedPlayer({ id: 1, teamId: 10, number: 7 });
    await seedPlayer({ id: 2, teamId: 10, number: 9 });
    await seedPlayer({ id: 3, teamId: 20, number: 11 });
    await seedPlayer({ id: 4, teamId: 20, number: 7 });
    await seedPlayer({
      userId: OTHER_USER_ID,
      id: 1,
      teamId: 10,
      number: 12,
    });
  });

  test("POST accepts a pair whose players are rostered on its team", async () => {
    const response = await createPairsRequest([
      { id: 1, teamId: 10, playerNumberA: 7, playerNumberB: 9 },
    ]);

    expect(response.status).toBe(200);
    expect(await pairsForUser(USER_ID)).toHaveLength(1);
  });

  test.each([
    ["missing player", 7, 99],
    ["player on another team", 7, 11],
    ["another user's player", 7, 12],
  ])("POST rejects a pair with a %s", async (_case, numberA, numberB) => {
    const response = await createPairsRequest([
      { id: 1, teamId: 10, playerNumberA: numberA, playerNumberB: numberB },
    ]);

    expect(response.status).toBe(400);
    expect(await pairsForUser(USER_ID)).toHaveLength(0);
  });

  test("POST rejects a mixed batch without inserting the valid pair", async () => {
    const response = await createPairsRequest([
      { id: 1, teamId: 10, playerNumberA: 7, playerNumberB: 9 },
      { id: 2, teamId: 10, playerNumberA: 7, playerNumberB: 99 },
    ]);

    expect(response.status).toBe(400);
    expect(await pairsForUser(USER_ID)).toHaveLength(0);
  });

  test("DELETE player removes referenced pairs and preserves other scopes", async () => {
    await seedPair({ id: 1, teamId: 10, numberA: 9, numberB: 7 });
    await seedPair({ id: 2, teamId: 10, numberA: 9, numberB: 15 });
    await seedPair({ id: 3, teamId: 20, numberA: 7, numberB: 11 });
    await seedPair({ id: 4, teamId: 10, numberA: 7, numberB: 15 });
    await seedPair({
      userId: OTHER_USER_ID,
      id: 1,
      teamId: 10,
      numberA: 12,
      numberB: 7,
    });

    const response = await deletePlayersRequest([1]);

    expect(response.status).toBe(204);
    expect(
      await getTestDb()
        .select()
        .from(schema.teamPlayers)
        .where(
          and(
            eq(schema.teamPlayers.userId, USER_ID),
            eq(schema.teamPlayers.clientId, testClientId(1)),
          ),
        ),
    ).toHaveLength(0);
    expect(
      (await pairsForUser(USER_ID)).map((pair) => pair.clientId).sort(),
    ).toEqual([testClientId(2), testClientId(3)]);
    expect(await pairsForUser(OTHER_USER_ID)).toHaveLength(1);
    expect(
      await getTestDb()
        .select()
        .from(schema.teamPlayers)
        .where(
          and(
            eq(schema.teamPlayers.userId, OTHER_USER_ID),
            eq(schema.teamPlayers.clientId, testClientId(1)),
          ),
        ),
    ).toHaveLength(1);
  });
});
