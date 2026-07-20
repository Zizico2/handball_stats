import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { StartGameResult } from "@/datamodel";
import { createDb } from "@/db";
import * as schema from "@/db/schema";
import { insertGameAndActiveMarkerAtomic } from "@/server/startGame";
import { getTestDb, resetAppTables } from "./db";

vi.mock("server-only", () => ({}));

vi.mock("@/server/db", () => ({
  getDb: async () => createDb(env.DB),
}));

const { gamesRoutes } = await import("@/server/api/routes/collections/games");

const USER_ID = "user-start-game";
const TEAM_ID = 1;
const GAME_ID = 10;

async function seedTeam() {
  const db = getTestDb();
  await db.insert(schema.teams).values({
    userId: USER_ID,
    localId: TEAM_ID,
    name: "Home",
  });
  await db.insert(schema.teamPlayers).values({
    userId: USER_ID,
    localId: 1,
    teamLocalId: TEAM_ID,
    name: "Alex",
    number: 7,
  });
}

function startRequest(body: {
  id: number;
  homeTeamId: number;
  createdAt: string;
}) {
  return gamesRoutes.request(
    "/start",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    { userId: USER_ID },
  );
}

describe("games start API (D1)", () => {
  beforeEach(async () => {
    await resetAppTables();
    await seedTeam();
  });

  test("POST /start creates game and active-game atomically", async () => {
    const res = await startRequest({
      id: GAME_ID,
      homeTeamId: TEAM_ID,
      createdAt: "2026-01-02T00:00:00.000Z",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as StartGameResult;
    expect(body).toEqual({
      game: {
        id: GAME_ID,
        homeTeamId: TEAM_ID,
        createdAt: "2026-01-02T00:00:00.000Z",
        firstHalfStartedAtMs: null,
        halftimeStartedAtMs: null,
        secondHalfStartedAtMs: null,
      },
      activeGame: {
        id: 1,
        gameId: GAME_ID,
        homeTeamId: TEAM_ID,
      },
    });

    const db = getTestDb();
    const games = await db
      .select()
      .from(schema.games)
      .where(eq(schema.games.userId, USER_ID));
    const active = await db
      .select()
      .from(schema.activeGame)
      .where(eq(schema.activeGame.userId, USER_ID));

    expect(games).toHaveLength(1);
    expect(games[0].firstHalfStartedAtMs).toBeNull();
    expect(games[0].halftimeStartedAtMs).toBeNull();
    expect(games[0].secondHalfStartedAtMs).toBeNull();
    expect(active).toHaveLength(1);
    expect(active[0].gameLocalId).toBe(GAME_ID);
  });

  test("POST /start returns 409 when an active game already exists", async () => {
    await startRequest({
      id: GAME_ID,
      homeTeamId: TEAM_ID,
      createdAt: "2026-01-02T00:00:00.000Z",
    });

    const res = await startRequest({
      id: GAME_ID + 1,
      homeTeamId: TEAM_ID,
      createdAt: "2026-01-03T00:00:00.000Z",
    });

    expect(res.status).toBe(409);

    const db = getTestDb();
    const games = await db
      .select()
      .from(schema.games)
      .where(eq(schema.games.userId, USER_ID));
    expect(games).toHaveLength(1);
    expect(games[0].localId).toBe(GAME_ID);
  });

  test("POST /start returns 404 when home team is missing", async () => {
    const res = await startRequest({
      id: GAME_ID,
      homeTeamId: 999,
      createdAt: "2026-01-02T00:00:00.000Z",
    });

    expect(res.status).toBe(404);

    const db = getTestDb();
    const games = await db.select().from(schema.games);
    const active = await db.select().from(schema.activeGame);
    expect(games).toHaveLength(0);
    expect(active).toHaveLength(0);
  });

  test("POST /start returns 400 when the roster is empty", async () => {
    const db = getTestDb();
    await db.delete(schema.teamPlayers);

    const res = await startRequest({
      id: GAME_ID,
      homeTeamId: TEAM_ID,
      createdAt: "2026-01-02T00:00:00.000Z",
    });

    expect(res.status).toBe(400);

    const games = await db.select().from(schema.games);
    const active = await db.select().from(schema.activeGame);
    expect(games).toHaveLength(0);
    expect(active).toHaveLength(0);
  });

  test("failed active-game write rolls back the game row", async () => {
    const db = getTestDb();

    await expect(
      insertGameAndActiveMarkerAtomic(
        db,
        {
          userId: USER_ID,
          localId: GAME_ID,
          homeTeamLocalId: TEAM_ID,
          createdAt: "2026-01-02T00:00:00.000Z",
          firstHalfStartedAtMs: null,
          halftimeStartedAtMs: null,
          secondHalfStartedAtMs: null,
        },
        {
          userId: USER_ID,
          localId: 1,
          gameLocalId: GAME_ID,
          // Valid game FK would succeed; this team FK fails and aborts the batch.
          homeTeamLocalId: 999,
        },
      ),
    ).rejects.toThrow();

    const games = await db.select().from(schema.games);
    const active = await db.select().from(schema.activeGame);
    expect(games).toHaveLength(0);
    expect(active).toHaveLength(0);
  });

  test("concurrent starts: loser gets 409, not 500", async () => {
    const [first, second] = await Promise.all([
      startRequest({
        id: GAME_ID,
        homeTeamId: TEAM_ID,
        createdAt: "2026-01-02T00:00:00.000Z",
      }),
      startRequest({
        id: GAME_ID + 1,
        homeTeamId: TEAM_ID,
        createdAt: "2026-01-03T00:00:00.000Z",
      }),
    ]);

    const statuses = [first.status, second.status].toSorted((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);

    const db = getTestDb();
    const games = await db
      .select()
      .from(schema.games)
      .where(eq(schema.games.userId, USER_ID));
    const active = await db
      .select()
      .from(schema.activeGame)
      .where(eq(schema.activeGame.userId, USER_ID));

    expect(games).toHaveLength(1);
    expect(active).toHaveLength(1);
  });
});
