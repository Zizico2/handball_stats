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

const { activeGameRoutes } = await import(
  "@/server/api/routes/collections/activeGame"
);

const USER_ID = "user-ending-match";
const OTHER_USER_ID = "other-user";
const gameInternalIds = new Map<string, number>();

function gameKey(userId: string, gameId: number) {
  return `${userId}:${gameId}`;
}

async function seedMatch(
  userId: string,
  {
    isActive,
    gameId,
    teamId,
  }: { isActive: boolean; gameId: number; teamId: number },
) {
  const db = getTestDb();
  const [team] = await db
    .insert(schema.teams)
    .values({
      userId,
      clientId: testClientId(teamId),
      name: `${userId} team ${teamId}`,
    })
    .returning();
  const [game] = await db
    .insert(schema.games)
    .values({
      userId,
      clientId: testClientId(gameId),
      homeTeamId: team.id,
      createdAt: "2026-01-02T00:00:00.000Z",
      firstHalfStartedAtMs: 1_000,
    })
    .returning();
  gameInternalIds.set(gameKey(userId, gameId), game.id);
  await db.insert(schema.playerEvents).values({
    userId,
    clientId: testClientId(gameId),
    player: 7,
    gameId: game.id,
    ellapsedSeconds: 5,
    eventType: "starting-player",
    eventGroup: "starting-lineup",
    half: "firstHalf",
  });
  await db.insert(schema.pauseToggles).values({
    userId,
    clientId: `pause-${userId}-${gameId}`,
    gameId: game.id,
    half: "firstHalf",
    toggledAtMs: 2_000,
  });
  if (isActive) {
    await db.insert(schema.activeGame).values({
      userId,
      gameId: game.id,
      homeTeamId: team.id,
    });
  }
}

function deleteRequest(ids: number[]) {
  return activeGameRoutes.request(
    "/",
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids),
    },
    { userId: USER_ID },
  );
}

async function pauseTogglesForUserAndGame(userId: string, gameId: number) {
  const internalGameId = gameInternalIds.get(gameKey(userId, gameId));
  if (internalGameId === undefined)
    throw new Error("Game must be seeded first");
  return getTestDb()
    .select()
    .from(schema.pauseToggles)
    .where(
      and(
        eq(schema.pauseToggles.userId, userId),
        eq(schema.pauseToggles.gameId, internalGameId),
      ),
    );
}

describe("active-game DELETE API (D1)", () => {
  beforeEach(async () => {
    await resetAppTables();
    gameInternalIds.clear();
    await seedMatch(USER_ID, { isActive: true, gameId: 10, teamId: 100 });
    await seedMatch(USER_ID, { isActive: false, gameId: 20, teamId: 200 });
    await seedMatch(OTHER_USER_ID, {
      isActive: true,
      gameId: 10,
      teamId: 100,
    });
  });

  test("removes targeted active markers and their pause toggles", async () => {
    const response = await deleteRequest([1]);

    expect(response.status).toBe(204);
    expect(
      await getTestDb()
        .select()
        .from(schema.activeGame)
        .where(eq(schema.activeGame.userId, USER_ID)),
    ).toHaveLength(0);
    expect(await pauseTogglesForUserAndGame(USER_ID, 10)).toHaveLength(0);
  });

  test("preserves non-target matches and other users' rows", async () => {
    await deleteRequest([1]);

    expect(await pauseTogglesForUserAndGame(USER_ID, 20)).toHaveLength(1);
    expect(
      await getTestDb()
        .select()
        .from(schema.activeGame)
        .where(eq(schema.activeGame.userId, OTHER_USER_ID)),
    ).toHaveLength(1);
    expect(await pauseTogglesForUserAndGame(OTHER_USER_ID, 10)).toHaveLength(1);
  });

  test("retains the completed game's record and player events", async () => {
    await deleteRequest([1]);
    const internalGameId = gameInternalIds.get(gameKey(USER_ID, 10));
    if (internalGameId === undefined)
      throw new Error("Seeded game was not found");

    expect(
      await getTestDb()
        .select()
        .from(schema.games)
        .where(
          and(
            eq(schema.games.userId, USER_ID),
            eq(schema.games.clientId, testClientId(10)),
          ),
        ),
    ).toHaveLength(1);
    expect(
      await getTestDb()
        .select()
        .from(schema.playerEvents)
        .where(
          and(
            eq(schema.playerEvents.userId, USER_ID),
            eq(schema.playerEvents.gameId, internalGameId),
          ),
        ),
    ).toHaveLength(1);
  });

  test("empty IDs return 204 without changing stored rows", async () => {
    const db = getTestDb();
    const before = await Promise.all([
      db.select().from(schema.activeGame),
      db.select().from(schema.pauseToggles),
      db.select().from(schema.games),
      db.select().from(schema.playerEvents),
    ]);

    const response = await deleteRequest([]);

    expect(response.status).toBe(204);
    const after = await Promise.all([
      db.select().from(schema.activeGame),
      db.select().from(schema.pauseToggles),
      db.select().from(schema.games),
      db.select().from(schema.playerEvents),
    ]);
    expect(after).toEqual(before);
  });
});
