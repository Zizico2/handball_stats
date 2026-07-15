import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "@/db/schema";

mock.module("server-only", () => ({}));

let testDb: ReturnType<typeof drizzle<typeof schema>>;

mock.module("@/server/db", () => ({
  getDb: async () => testDb,
}));

const { gamesRoutes } = await import("./games");

const USER_ID = "user-phase-transitions";
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
  `);
  return drizzle({ client: sqlite, schema });
}

async function seedTeamAndEmptyGame() {
  await testDb.insert(schema.teams).values({
    userId: USER_ID,
    localId: TEAM_ID,
    name: "Home",
  });
  await testDb.insert(schema.games).values({
    userId: USER_ID,
    localId: GAME_ID,
    homeTeamLocalId: TEAM_ID,
    createdAt: "2026-01-01T00:00:00.000Z",
    firstHalfStartedAtMs: null,
    halftimeStartedAtMs: null,
    secondHalfStartedAtMs: null,
  });
}

function transitionRequest(gameId: number, to: string) {
  return gamesRoutes.request(
    `/${gameId}/transitions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to }),
    },
    { userId: USER_ID },
  );
}

describe("games phase transition API (sqlite)", () => {
  beforeEach(async () => {
    testDb = createTestDb();
    await seedTeamAndEmptyGame();
  });

  test("POST insert strips client phase timestamps", async () => {
    const res = await gamesRoutes.request(
      "/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          {
            id: 20,
            homeTeamId: TEAM_ID,
            createdAt: "2026-01-02T00:00:00.000Z",
            firstHalfStartedAtMs: 111,
            halftimeStartedAtMs: 222,
            secondHalfStartedAtMs: 333,
          },
        ]),
      },
      { userId: USER_ID },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([
      {
        id: 20,
        homeTeamId: TEAM_ID,
        createdAt: "2026-01-02T00:00:00.000Z",
        firstHalfStartedAtMs: null,
        halftimeStartedAtMs: null,
        secondHalfStartedAtMs: null,
      },
    ]);

    const row = await testDb
      .select()
      .from(schema.games)
      .where(eq(schema.games.localId, 20))
      .get();
    expect(row?.firstHalfStartedAtMs).toBeNull();
    expect(row?.halftimeStartedAtMs).toBeNull();
    expect(row?.secondHalfStartedAtMs).toBeNull();
  });

  test("PUT insert strips client phase timestamps", async () => {
    const res = await gamesRoutes.request(
      "/",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          {
            id: 21,
            homeTeamId: TEAM_ID,
            createdAt: "2026-01-03T00:00:00.000Z",
            firstHalfStartedAtMs: 111,
            halftimeStartedAtMs: 222,
            secondHalfStartedAtMs: 333,
          },
        ]),
      },
      { userId: USER_ID },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].firstHalfStartedAtMs).toBeNull();
    expect(body[0].halftimeStartedAtMs).toBeNull();
    expect(body[0].secondHalfStartedAtMs).toBeNull();
  });

  test("PUT upsert cannot clear existing phase timestamps", async () => {
    const started = await transitionRequest(GAME_ID, "firstHalf");
    expect(started.status).toBe(200);
    const { game: startedGame } = await started.json();
    expect(startedGame.firstHalfStartedAtMs).toBeNumber();

    const res = await gamesRoutes.request(
      "/",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          {
            id: GAME_ID,
            homeTeamId: TEAM_ID,
            createdAt: "2026-01-01T00:00:00.000Z",
            firstHalfStartedAtMs: null,
            halftimeStartedAtMs: null,
            secondHalfStartedAtMs: null,
          },
        ]),
      },
      { userId: USER_ID },
    );

    expect(res.status).toBe(200);
    const row = await testDb
      .select()
      .from(schema.games)
      .where(eq(schema.games.localId, GAME_ID))
      .get();
    expect(row?.firstHalfStartedAtMs).toBe(startedGame.firstHalfStartedAtMs);
  });

  test("transition applies server timestamp and applied=true", async () => {
    const before = Date.now();
    const res = await transitionRequest(GAME_ID, "firstHalf");
    const after = Date.now();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.applied).toBe(true);
    expect(body.game.firstHalfStartedAtMs).toBeGreaterThanOrEqual(before);
    expect(body.game.firstHalfStartedAtMs).toBeLessThanOrEqual(after);
    expect(body.game.halftimeStartedAtMs).toBeNull();
    expect(body.game.secondHalfStartedAtMs).toBeNull();
  });

  test("idempotent transition returns applied=false without changing timestamp", async () => {
    const first = await transitionRequest(GAME_ID, "firstHalf");
    const { game: firstGame } = await first.json();

    const second = await transitionRequest(GAME_ID, "firstHalf");
    expect(second.status).toBe(200);
    const body = await second.json();
    expect(body.applied).toBe(false);
    expect(body.game.firstHalfStartedAtMs).toBe(firstGame.firstHalfStartedAtMs);
  });

  test("stale backward transition returns 409", async () => {
    expect((await transitionRequest(GAME_ID, "firstHalf")).status).toBe(200);
    expect((await transitionRequest(GAME_ID, "secondHalf")).status).toBe(200);

    const staleHalftime = await transitionRequest(GAME_ID, "halftime");
    expect(staleHalftime.status).toBe(409);

    const row = await testDb
      .select()
      .from(schema.games)
      .where(eq(schema.games.localId, GAME_ID))
      .get();
    expect(row?.secondHalfStartedAtMs).not.toBeNull();
    expect(row?.halftimeStartedAtMs).toBeNull();
  });

  test("concurrent first-half transitions: one applied, one idempotent, shared timestamp", async () => {
    const [a, b] = await Promise.all([
      transitionRequest(GAME_ID, "firstHalf"),
      transitionRequest(GAME_ID, "firstHalf"),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const bodyA = await a.json();
    const bodyB = await b.json();

    const applied = [bodyA, bodyB].filter((body) => body.applied);
    const idempotent = [bodyA, bodyB].filter((body) => !body.applied);
    expect(applied).toHaveLength(1);
    expect(idempotent).toHaveLength(1);
    expect(bodyA.game.firstHalfStartedAtMs).toBe(
      bodyB.game.firstHalfStartedAtMs,
    );
    expect(applied[0].game.firstHalfStartedAtMs).toBeNumber();
  });

  test("concurrent halftime transitions: one applied, one idempotent", async () => {
    expect((await transitionRequest(GAME_ID, "firstHalf")).status).toBe(200);

    const [a, b] = await Promise.all([
      transitionRequest(GAME_ID, "halftime"),
      transitionRequest(GAME_ID, "halftime"),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const bodyA = await a.json();
    const bodyB = await b.json();

    const applied = [bodyA, bodyB].filter((body) => body.applied);
    const idempotent = [bodyA, bodyB].filter((body) => !body.applied);
    expect(applied).toHaveLength(1);
    expect(idempotent).toHaveLength(1);
    expect(bodyA.game.halftimeStartedAtMs).toBe(bodyB.game.halftimeStartedAtMs);
    expect(applied[0].game.halftimeStartedAtMs).toBeNumber();
  });

  test("interleaved: after second half is applied, concurrent HT is always 409", async () => {
    expect((await transitionRequest(GAME_ID, "firstHalf")).status).toBe(200);
    const second = await transitionRequest(GAME_ID, "secondHalf");
    expect(second.status).toBe(200);
    const { game, applied } = await second.json();
    expect(applied).toBe(true);
    expect(game.secondHalfStartedAtMs).toBeNumber();

    const [htA, htB] = await Promise.all([
      transitionRequest(GAME_ID, "halftime"),
      transitionRequest(GAME_ID, "halftime"),
    ]);
    expect(htA.status).toBe(409);
    expect(htB.status).toBe(409);
  });
});
