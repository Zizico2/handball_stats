import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "@/db/schema";
import {
  insertGameAndActiveMarkerAtomic,
  type StartGameDb,
} from "@/server/startGame";

mock.module("server-only", () => ({}));

let testDb: ReturnType<typeof drizzle<typeof schema>>;

mock.module("@/server/db", () => ({
  getDb: async () => testDb,
}));

const { gamesRoutes } = await import("./games");

const USER_ID = "user-start-game";
const TEAM_ID = 1;
const GAME_ID = 10;

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.run("PRAGMA foreign_keys = ON");
  sqlite.run(`
    CREATE TABLE teams (
      id integer PRIMARY KEY,
      user_id text NOT NULL,
      local_id integer NOT NULL,
      name text NOT NULL
    );
    CREATE UNIQUE INDEX teams_user_id_local_id_uq ON teams (user_id, local_id);
    CREATE TABLE games (
      id integer PRIMARY KEY,
      user_id text NOT NULL,
      local_id integer NOT NULL,
      home_team_local_id integer NOT NULL,
      created_at text NOT NULL,
      first_half_started_at_ms integer,
      halftime_started_at_ms integer,
      second_half_started_at_ms integer,
      FOREIGN KEY (user_id, home_team_local_id) REFERENCES teams(user_id, local_id)
    );
    CREATE UNIQUE INDEX games_user_id_local_id_uq ON games (user_id, local_id);
    CREATE TABLE active_game (
      id integer PRIMARY KEY,
      user_id text NOT NULL,
      local_id integer NOT NULL,
      game_local_id integer NOT NULL,
      home_team_local_id integer NOT NULL,
      FOREIGN KEY (user_id, game_local_id) REFERENCES games(user_id, local_id),
      FOREIGN KEY (user_id, home_team_local_id) REFERENCES teams(user_id, local_id)
    );
    CREATE UNIQUE INDEX active_game_user_id_local_id_uq ON active_game (user_id, local_id);
  `);
  return drizzle({ client: sqlite, schema });
}

async function seedTeam() {
  await testDb.insert(schema.teams).values({
    userId: USER_ID,
    localId: TEAM_ID,
    name: "Home",
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

describe("games start API (sqlite)", () => {
  beforeEach(async () => {
    testDb = createTestDb();
    await seedTeam();
  });

  test("POST /start creates game and active-game atomically", async () => {
    const res = await startRequest({
      id: GAME_ID,
      homeTeamId: TEAM_ID,
      createdAt: "2026-01-02T00:00:00.000Z",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
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

    const games = await testDb
      .select()
      .from(schema.games)
      .where(eq(schema.games.userId, USER_ID));
    const active = await testDb
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

    const games = await testDb
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

    const games = await testDb.select().from(schema.games);
    const active = await testDb.select().from(schema.activeGame);
    expect(games).toHaveLength(0);
    expect(active).toHaveLength(0);
  });

  test("failed active-game write rolls back the game row", async () => {
    await expect(
      insertGameAndActiveMarkerAtomic(
        testDb as unknown as StartGameDb,
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
          // Valid game FK would succeed, but this team FK fails and aborts the tx.
          homeTeamLocalId: 999,
        },
      ),
    ).rejects.toThrow(/FOREIGN KEY/i);

    const games = await testDb.select().from(schema.games);
    const active = await testDb.select().from(schema.activeGame);
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

    const games = await testDb
      .select()
      .from(schema.games)
      .where(eq(schema.games.userId, USER_ID));
    const active = await testDb
      .select()
      .from(schema.activeGame)
      .where(eq(schema.activeGame.userId, USER_ID));

    expect(games).toHaveLength(1);
    expect(active).toHaveLength(1);
  });

  test("unique constraint after pre-check maps to 409", async () => {
    const { startGame, StartGameConflictError } = await import(
      "@/server/startGame"
    );

    await testDb.insert(schema.games).values({
      userId: USER_ID,
      localId: GAME_ID,
      homeTeamLocalId: TEAM_ID,
      createdAt: "2026-01-02T00:00:00.000Z",
      firstHalfStartedAtMs: null,
      halftimeStartedAtMs: null,
      secondHalfStartedAtMs: null,
    });
    await testDb.insert(schema.activeGame).values({
      userId: USER_ID,
      localId: 1,
      gameLocalId: GAME_ID,
      homeTeamLocalId: TEAM_ID,
    });

    // Simulate the race: pre-check misses the winner, insert hits UNIQUE.
    let hideActiveOnce = true;
    const base = testDb as unknown as StartGameDb;
    const racingDb: StartGameDb = {
      select: () => ({
        from: (table: unknown) => ({
          where: (condition: unknown) => ({
            get: () => {
              if (hideActiveOnce && table === schema.activeGame) {
                hideActiveOnce = false;
                return undefined;
              }
              return base.select().from(table).where(condition).get();
            },
          }),
        }),
      }),
      insert: ((table: unknown) => base.insert(table)) as StartGameDb["insert"],
      transaction: ((fn) => base.transaction(fn)) as StartGameDb["transaction"],
    };

    await expect(
      startGame(racingDb, USER_ID, {
        id: GAME_ID + 1,
        homeTeamId: TEAM_ID,
        createdAt: "2026-01-03T00:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(StartGameConflictError);

    const res = await startRequest({
      id: GAME_ID + 1,
      homeTeamId: TEAM_ID,
      createdAt: "2026-01-03T00:00:00.000Z",
    });
    expect(res.status).toBe(409);
  });
});
