import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createDb } from "@/db";
import * as schema from "@/db/schema";
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

async function seedMatch(
  userId: string,
  {
    activeId,
    gameId,
    teamId,
  }: { activeId: number; gameId: number; teamId: number },
) {
  const db = getTestDb();
  await db.insert(schema.teams).values({
    userId,
    localId: teamId,
    name: `${userId} team ${teamId}`,
  });
  await db.insert(schema.games).values({
    userId,
    localId: gameId,
    homeTeamLocalId: teamId,
    createdAt: "2026-01-02T00:00:00.000Z",
    firstHalfStartedAtMs: 1_000,
  });
  await db.insert(schema.playerEvents).values({
    userId,
    localId: gameId,
    player: 7,
    gameLocalId: gameId,
    ellapsedSeconds: 5,
    eventType: "starting-player",
    eventGroup: "starting-lineup",
    half: "firstHalf",
  });
  await db.insert(schema.pauseToggles).values({
    userId,
    clientId: `${userId}-${gameId}-pause`,
    gameLocalId: gameId,
    half: "firstHalf",
    toggledAtMs: 2_000,
  });
  await db.insert(schema.activeGame).values({
    userId,
    localId: activeId,
    gameLocalId: gameId,
    homeTeamLocalId: teamId,
  });
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
  return getTestDb()
    .select()
    .from(schema.pauseToggles)
    .where(
      and(
        eq(schema.pauseToggles.userId, userId),
        eq(schema.pauseToggles.gameLocalId, gameId),
      ),
    );
}

describe("active-game DELETE API (D1)", () => {
  beforeEach(async () => {
    await resetAppTables();
    await seedMatch(USER_ID, { activeId: 1, gameId: 10, teamId: 100 });
    await seedMatch(USER_ID, { activeId: 2, gameId: 20, teamId: 200 });
    await seedMatch(OTHER_USER_ID, {
      activeId: 1,
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
    ).toHaveLength(1);
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

    expect(
      await getTestDb()
        .select()
        .from(schema.games)
        .where(
          and(eq(schema.games.userId, USER_ID), eq(schema.games.localId, 10)),
        ),
    ).toHaveLength(1);
    expect(
      await getTestDb()
        .select()
        .from(schema.playerEvents)
        .where(
          and(
            eq(schema.playerEvents.userId, USER_ID),
            eq(schema.playerEvents.gameLocalId, 10),
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
