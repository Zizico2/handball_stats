import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createDb } from "@/db";
import * as schema from "@/db/schema";
import { testClientId } from "@/testing/clientId";
import { getTestDb, resetAppTables } from "./db";

vi.mock("server-only", () => ({}));

vi.mock("@/server/db", () => ({
  getDb: async () => createDb(env.DB),
}));

const { e2eRoutes } = await import("@/server/api/routes/e2e");

const USER_ID = "e2e-user";
const OTHER_USER_ID = "other-user";
const RESET_TOKEN = "test-reset-token";

async function seedUser(userId: string, offset: number) {
  const db = getTestDb();
  const teamId = offset + 1;
  const gameId = offset + 2;

  const [team] = await db
    .insert(schema.teams)
    .values({
      userId,
      clientId: testClientId(teamId),
      name: `${userId} team`,
    })
    .returning();
  await db.insert(schema.teamPlayers).values({
    userId,
    clientId: testClientId(offset + 3),
    teamId: team.id,
    name: `${userId} player`,
    number: 7,
  });
  await db.insert(schema.quickSubPairs).values({
    userId,
    clientId: testClientId(offset + 4),
    teamId: team.id,
    playerNumberA: 7,
    playerNumberB: 8,
  });
  const [game] = await db
    .insert(schema.games)
    .values({
      userId,
      clientId: testClientId(gameId),
      homeTeamId: team.id,
      createdAt: "2026-01-02T00:00:00.000Z",
    })
    .returning();
  await db.insert(schema.playerEvents).values({
    userId,
    clientId: testClientId(offset + 5),
    player: 7,
    gameId: game.id,
    ellapsedSeconds: 0,
    eventType: "starting-player",
    eventGroup: "starting-lineup",
    half: "firstHalf",
  });
  await db.insert(schema.pauseToggles).values({
    userId,
    clientId: `pause-${userId}`,
    gameId: game.id,
    half: "firstHalf",
    toggledAtMs: 1,
  });
  await db.insert(schema.activeGame).values({
    userId,
    gameId: game.id,
    homeTeamId: team.id,
  });
}

function resetRequest(token: string | undefined, authorization?: string) {
  const headers = authorization ? { Authorization: authorization } : undefined;
  return e2eRoutes.request(
    "/reset",
    { method: "POST", headers },
    { userId: USER_ID, E2E_RESET_TOKEN: token },
  );
}

async function userRowCounts(userId: string) {
  const db = getTestDb();
  return Promise.all([
    db
      .select()
      .from(schema.activeGame)
      .where(eq(schema.activeGame.userId, userId)),
    db
      .select()
      .from(schema.pauseToggles)
      .where(eq(schema.pauseToggles.userId, userId)),
    db
      .select()
      .from(schema.playerEvents)
      .where(eq(schema.playerEvents.userId, userId)),
    db.select().from(schema.games).where(eq(schema.games.userId, userId)),
    db
      .select()
      .from(schema.quickSubPairs)
      .where(eq(schema.quickSubPairs.userId, userId)),
    db
      .select()
      .from(schema.teamPlayers)
      .where(eq(schema.teamPlayers.userId, userId)),
    db.select().from(schema.teams).where(eq(schema.teams.userId, userId)),
  ]).then((rows) => rows.map((tableRows) => tableRows.length));
}

describe("E2E reset API (D1)", () => {
  beforeEach(async () => {
    await resetAppTables();
    await seedUser(USER_ID, 100);
    await seedUser(OTHER_USER_ID, 200);
  });

  test.each([
    ["disabled", undefined, undefined],
    ["missing authorization", RESET_TOKEN, undefined],
    ["incorrect authorization", RESET_TOKEN, "Bearer wrong-token"],
  ])("returns 404 when %s", async (_case, token, authorization) => {
    const response = await resetRequest(token, authorization);

    expect(response.status).toBe(404);
    expect(await userRowCounts(USER_ID)).toEqual([1, 1, 1, 1, 1, 1, 1]);
    expect(await userRowCounts(OTHER_USER_ID)).toEqual([1, 1, 1, 1, 1, 1, 1]);
  });

  test("removes every row for the authenticated user only", async () => {
    const response = await resetRequest(RESET_TOKEN, `Bearer ${RESET_TOKEN}`);

    expect(response.status).toBe(204);
    expect(await userRowCounts(USER_ID)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(await userRowCounts(OTHER_USER_ID)).toEqual([1, 1, 1, 1, 1, 1, 1]);
  });
});
