import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ClientId, Game, GamePhaseTransitionResult } from "@/datamodel";
import { createDb } from "@/db";
import * as schema from "@/db/schema";
import { testClientId } from "@/testing/clientId";
import { getTestDb, resetAppTables } from "./db";

vi.mock("server-only", () => ({}));

vi.mock("@/server/db", () => ({
  getDb: async () => createDb(env.DB),
}));

const { gamesRoutes } = await import("@/server/api/routes/collections/games");

const USER_ID = "user-phase-transitions";
const TEAM_ID = testClientId(1);
const GAME_ID = testClientId(10);
const POST_GAME_ID = testClientId(20);
const PUT_GAME_ID = testClientId(21);

async function seedTeamAndEmptyGame() {
  const db = getTestDb();
  const [team] = await db
    .insert(schema.teams)
    .values({ userId: USER_ID, clientId: TEAM_ID, name: "Home" })
    .returning();
  await db.insert(schema.games).values({
    userId: USER_ID,
    clientId: GAME_ID,
    homeTeamId: team.id,
    createdAt: "2026-01-01T00:00:00.000Z",
    firstHalfStartedAtMs: null,
    halftimeStartedAtMs: null,
    secondHalfStartedAtMs: null,
  });
}

function transitionRequest(gameId: ClientId, to: string) {
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

describe("games phase transition API (D1)", () => {
  beforeEach(async () => {
    await resetAppTables();
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
            id: POST_GAME_ID,
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
    const body = (await res.json()) as Game[];
    expect(body).toEqual([
      {
        id: POST_GAME_ID,
        homeTeamId: TEAM_ID,
        createdAt: "2026-01-02T00:00:00.000Z",
        firstHalfStartedAtMs: null,
        halftimeStartedAtMs: null,
        secondHalfStartedAtMs: null,
      },
    ]);

    const row = await getTestDb()
      .select()
      .from(schema.games)
      .where(eq(schema.games.clientId, POST_GAME_ID))
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
            id: PUT_GAME_ID,
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
    const body = (await res.json()) as Game[];
    expect(body[0].firstHalfStartedAtMs).toBeNull();
    expect(body[0].halftimeStartedAtMs).toBeNull();
    expect(body[0].secondHalfStartedAtMs).toBeNull();
  });

  test("PUT upsert cannot clear existing phase timestamps", async () => {
    const started = await transitionRequest(GAME_ID, "firstHalf");
    expect(started.status).toBe(200);
    const { game: startedGame } =
      (await started.json()) as GamePhaseTransitionResult;
    expect(typeof startedGame.firstHalfStartedAtMs).toBe("number");

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
    const row = await getTestDb()
      .select()
      .from(schema.games)
      .where(eq(schema.games.clientId, GAME_ID))
      .get();
    expect(row?.firstHalfStartedAtMs).toBe(startedGame.firstHalfStartedAtMs);
  });

  test("transition applies server timestamp and applied=true", async () => {
    const before = Date.now();
    const res = await transitionRequest(GAME_ID, "firstHalf");
    const after = Date.now();

    expect(res.status).toBe(200);
    const body = (await res.json()) as GamePhaseTransitionResult;
    expect(body.applied).toBe(true);
    expect(body.game.firstHalfStartedAtMs).toBeGreaterThanOrEqual(before);
    expect(body.game.firstHalfStartedAtMs).toBeLessThanOrEqual(after);
    expect(body.game.halftimeStartedAtMs).toBeNull();
    expect(body.game.secondHalfStartedAtMs).toBeNull();
  });

  test("idempotent transition returns applied=false without changing timestamp", async () => {
    const first = await transitionRequest(GAME_ID, "firstHalf");
    const { game: firstGame } =
      (await first.json()) as GamePhaseTransitionResult;

    const second = await transitionRequest(GAME_ID, "firstHalf");
    expect(second.status).toBe(200);
    const body = (await second.json()) as GamePhaseTransitionResult;
    expect(body.applied).toBe(false);
    expect(body.game.firstHalfStartedAtMs).toBe(firstGame.firstHalfStartedAtMs);
  });

  test("stale backward transition returns 409", async () => {
    expect((await transitionRequest(GAME_ID, "firstHalf")).status).toBe(200);
    expect((await transitionRequest(GAME_ID, "secondHalf")).status).toBe(200);

    const staleHalftime = await transitionRequest(GAME_ID, "halftime");
    expect(staleHalftime.status).toBe(409);

    const row = await getTestDb()
      .select()
      .from(schema.games)
      .where(eq(schema.games.clientId, GAME_ID))
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
    const bodyA = (await a.json()) as GamePhaseTransitionResult;
    const bodyB = (await b.json()) as GamePhaseTransitionResult;

    const applied = [bodyA, bodyB].filter((body) => body.applied);
    const idempotent = [bodyA, bodyB].filter((body) => !body.applied);
    expect(applied).toHaveLength(1);
    expect(idempotent).toHaveLength(1);
    expect(bodyA.game.firstHalfStartedAtMs).toBe(
      bodyB.game.firstHalfStartedAtMs,
    );
    expect(typeof applied[0].game.firstHalfStartedAtMs).toBe("number");
  });

  test("concurrent halftime transitions: one applied, one idempotent", async () => {
    expect((await transitionRequest(GAME_ID, "firstHalf")).status).toBe(200);

    const [a, b] = await Promise.all([
      transitionRequest(GAME_ID, "halftime"),
      transitionRequest(GAME_ID, "halftime"),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const bodyA = (await a.json()) as GamePhaseTransitionResult;
    const bodyB = (await b.json()) as GamePhaseTransitionResult;

    const applied = [bodyA, bodyB].filter((body) => body.applied);
    const idempotent = [bodyA, bodyB].filter((body) => !body.applied);
    expect(applied).toHaveLength(1);
    expect(idempotent).toHaveLength(1);
    expect(bodyA.game.halftimeStartedAtMs).toBe(bodyB.game.halftimeStartedAtMs);
    expect(typeof applied[0].game.halftimeStartedAtMs).toBe("number");
  });

  test("interleaved: after second half is applied, concurrent HT is always 409", async () => {
    expect((await transitionRequest(GAME_ID, "firstHalf")).status).toBe(200);
    const second = await transitionRequest(GAME_ID, "secondHalf");
    expect(second.status).toBe(200);
    const { game, applied } =
      (await second.json()) as GamePhaseTransitionResult;
    expect(applied).toBe(true);
    expect(typeof game.secondHalfStartedAtMs).toBe("number");

    const [htA, htB] = await Promise.all([
      transitionRequest(GAME_ID, "halftime"),
      transitionRequest(GAME_ID, "halftime"),
    ]);
    expect(htA.status).toBe(409);
    expect(htB.status).toBe(409);
  });
});
