import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createDb } from "@/db";
import * as schema from "@/db/schema";
import { getTestDb, resetAppTables } from "./db";

vi.mock("server-only", () => ({}));

vi.mock("@/server/db", () => ({
  getDb: async () => createDb(env.DB),
}));

const { teamsRoutes } = await import("@/server/api/routes/collections/teams");

const USER_ID = "user-deleting-teams";
const OTHER_USER_ID = "other-user";

async function seedTeam(userId: string, teamId: number) {
  const db = getTestDb();
  await db.insert(schema.teams).values({
    userId,
    localId: teamId,
    name: `${userId} team ${teamId}`,
  });
  await db.insert(schema.teamPlayers).values([
    {
      userId,
      localId: teamId * 10 + 1,
      teamLocalId: teamId,
      name: "Alex",
      number: 7,
    },
    {
      userId,
      localId: teamId * 10 + 2,
      teamLocalId: teamId,
      name: "Sam",
      number: 8,
    },
  ]);
  await db.insert(schema.quickSubPairs).values({
    userId,
    localId: teamId * 10 + 1,
    teamLocalId: teamId,
    playerNumberA: 7,
    playerNumberB: 8,
  });
}

async function seedGame(userId: string, teamId: number, gameId: number) {
  await getTestDb().insert(schema.games).values({
    userId,
    localId: gameId,
    homeTeamLocalId: teamId,
    createdAt: "2026-07-21T00:00:00.000Z",
  });
}

function deleteRequest(ids: number[], userId = USER_ID) {
  return teamsRoutes.request(
    "/",
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids),
    },
    { userId },
  );
}

async function appTableSnapshot() {
  const db = getTestDb();
  return Promise.all([
    db.select().from(schema.teams),
    db.select().from(schema.teamPlayers),
    db.select().from(schema.quickSubPairs),
    db.select().from(schema.games),
    db.select().from(schema.activeGame),
    db.select().from(schema.pauseToggles),
    db.select().from(schema.playerEvents),
  ]);
}

describe("teams DELETE API (D1)", () => {
  beforeEach(async () => {
    await resetAppTables();
  });

  test("atomically deletes a free team and its setup", async () => {
    await seedTeam(USER_ID, 1);

    const response = await deleteRequest([1]);

    expect(response.status).toBe(204);
    const db = getTestDb();
    expect(
      await db
        .select()
        .from(schema.teams)
        .where(eq(schema.teams.userId, USER_ID)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.teamPlayers)
        .where(eq(schema.teamPlayers.userId, USER_ID)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.quickSubPairs)
        .where(eq(schema.quickSubPairs.userId, USER_ID)),
    ).toHaveLength(0);
  });

  test("a game with zero events blocks deletion and preserves every table", async () => {
    await seedTeam(USER_ID, 1);
    await seedGame(USER_ID, 1, 10);
    const before = await appTableSnapshot();

    const response = await deleteRequest([1]);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: "TEAM_HAS_GAMES",
      teamIds: [1],
    });
    expect(await appTableSnapshot()).toEqual(before);
  });

  test("a mixed request with a historical team blocks every deletion", async () => {
    await seedTeam(USER_ID, 1);
    await seedTeam(USER_ID, 2);
    await seedTeam(USER_ID, 3);
    await seedGame(USER_ID, 1, 10);
    await seedGame(USER_ID, 3, 11);
    const before = await appTableSnapshot();

    const response = await deleteRequest([3, 2, 1, 3]);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: "TEAM_HAS_GAMES",
      teamIds: [1, 3],
    });
    expect(await appTableSnapshot()).toEqual(before);
  });

  test("another tenant's game does not block deletion", async () => {
    await seedTeam(USER_ID, 1);
    await seedTeam(OTHER_USER_ID, 1);
    await seedGame(OTHER_USER_ID, 1, 10);

    const response = await deleteRequest([1]);

    expect(response.status).toBe(204);
    const db = getTestDb();
    expect(
      await db
        .select()
        .from(schema.teams)
        .where(eq(schema.teams.userId, USER_ID)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.teams)
        .where(eq(schema.teams.userId, OTHER_USER_ID)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(schema.games)
        .where(eq(schema.games.userId, OTHER_USER_ID)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(schema.teamPlayers)
        .where(eq(schema.teamPlayers.userId, OTHER_USER_ID)),
    ).toHaveLength(2);
    expect(
      await db
        .select()
        .from(schema.quickSubPairs)
        .where(eq(schema.quickSubPairs.userId, OTHER_USER_ID)),
    ).toHaveLength(1);
  });

  test("empty and nonexistent IDs are idempotent", async () => {
    await seedTeam(USER_ID, 1);
    const before = await appTableSnapshot();

    const emptyResponse = await deleteRequest([]);
    const missingResponse = await deleteRequest([999, 999]);

    expect(emptyResponse.status).toBe(204);
    expect(missingResponse.status).toBe(204);
    expect(await appTableSnapshot()).toEqual(before);
  });
});
