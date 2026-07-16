import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { GamePauseStateResult } from "@/datamodel";
import { createDb } from "@/db";
import * as schema from "@/db/schema";
import { getTestDb, resetAppTables } from "./db";

vi.mock("server-only", () => ({}));

vi.mock("@/server/db", () => ({
  getDb: async () => createDb(env.DB),
}));

const { gamesRoutes } = await import("@/server/api/routes/collections/games");

const USER_ID = "user-pause-state";
const TEAM_ID = 1;
const GAME_ID = 10;

async function seedTeamAndStartedGame() {
  const db = getTestDb();
  await db.insert(schema.teams).values({
    userId: USER_ID,
    localId: TEAM_ID,
    name: "Home",
  });
  await db.insert(schema.games).values({
    userId: USER_ID,
    localId: GAME_ID,
    homeTeamLocalId: TEAM_ID,
    createdAt: "2026-01-01T00:00:00.000Z",
    firstHalfStartedAtMs: 1_000,
    halftimeStartedAtMs: null,
    secondHalfStartedAtMs: null,
  });
}

function pauseStateRequest(
  gameId: number,
  body: { half: string; paused: boolean; clientId?: string },
) {
  return gamesRoutes.request(
    `/${gameId}/pause-state`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    { userId: USER_ID },
  );
}

async function countToggles(half: "firstHalf" | "secondHalf") {
  const rows = await getTestDb()
    .select()
    .from(schema.pauseToggles)
    .where(
      and(
        eq(schema.pauseToggles.userId, USER_ID),
        eq(schema.pauseToggles.gameLocalId, GAME_ID),
        eq(schema.pauseToggles.half, half),
      ),
    );
  return rows.length;
}

describe("games pause-state API (D1)", () => {
  beforeEach(async () => {
    await resetAppTables();
    await seedTeamAndStartedGame();
  });

  test("pause when running inserts one row and applied=true", async () => {
    const before = Date.now();
    const res = await pauseStateRequest(GAME_ID, {
      half: "firstHalf",
      paused: true,
    });
    const after = Date.now();

    expect(res.status).toBe(200);
    const body = (await res.json()) as GamePauseStateResult;
    expect(body.applied).toBe(true);
    expect(body.paused).toBe(true);
    expect(body.toggleCount).toBe(1);
    expect(body.pauseToggle).not.toBeNull();
    expect(body.pauseToggle?.half).toBe("firstHalf");
    expect(body.pauseToggle?.toggledAtMs).toBeGreaterThanOrEqual(before);
    expect(body.pauseToggle?.toggledAtMs).toBeLessThanOrEqual(after);
    expect(await countToggles("firstHalf")).toBe(1);
  });

  test("pause when already paused is idempotent", async () => {
    expect(
      (await pauseStateRequest(GAME_ID, { half: "firstHalf", paused: true }))
        .status,
    ).toBe(200);

    const res = await pauseStateRequest(GAME_ID, {
      half: "firstHalf",
      paused: true,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as GamePauseStateResult;
    expect(body.applied).toBe(false);
    expect(body.paused).toBe(true);
    expect(body.toggleCount).toBe(1);
    expect(body.pauseToggle).toBeNull();
    expect(await countToggles("firstHalf")).toBe(1);
  });

  test("resume when paused inserts second row", async () => {
    expect(
      (await pauseStateRequest(GAME_ID, { half: "firstHalf", paused: true }))
        .status,
    ).toBe(200);

    const res = await pauseStateRequest(GAME_ID, {
      half: "firstHalf",
      paused: false,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as GamePauseStateResult;
    expect(body.applied).toBe(true);
    expect(body.paused).toBe(false);
    expect(body.toggleCount).toBe(2);
    expect(body.pauseToggle).not.toBeNull();
    expect(await countToggles("firstHalf")).toBe(2);
  });

  test("resume when already running is idempotent", async () => {
    const res = await pauseStateRequest(GAME_ID, {
      half: "firstHalf",
      paused: false,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as GamePauseStateResult;
    expect(body.applied).toBe(false);
    expect(body.paused).toBe(false);
    expect(body.toggleCount).toBe(0);
    expect(body.pauseToggle).toBeNull();
    expect(await countToggles("firstHalf")).toBe(0);
  });

  test("404 when game is missing", async () => {
    const res = await pauseStateRequest(999, {
      half: "firstHalf",
      paused: true,
    });
    expect(res.status).toBe(404);
  });

  test("concurrent double-pause: one applied, one idempotent, clock paused", async () => {
    const [a, b] = await Promise.all([
      pauseStateRequest(GAME_ID, { half: "firstHalf", paused: true }),
      pauseStateRequest(GAME_ID, { half: "firstHalf", paused: true }),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const bodyA = (await a.json()) as GamePauseStateResult;
    const bodyB = (await b.json()) as GamePauseStateResult;

    const applied = [bodyA, bodyB].filter((body) => body.applied);
    const idempotent = [bodyA, bodyB].filter((body) => !body.applied);
    expect(applied).toHaveLength(1);
    expect(idempotent).toHaveLength(1);
    expect(bodyA.paused).toBe(true);
    expect(bodyB.paused).toBe(true);
    expect(await countToggles("firstHalf")).toBe(1);
  });

  test("concurrent double-resume: one applied, one idempotent, clock running", async () => {
    expect(
      (await pauseStateRequest(GAME_ID, { half: "firstHalf", paused: true }))
        .status,
    ).toBe(200);

    const [a, b] = await Promise.all([
      pauseStateRequest(GAME_ID, { half: "firstHalf", paused: false }),
      pauseStateRequest(GAME_ID, { half: "firstHalf", paused: false }),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const bodyA = (await a.json()) as GamePauseStateResult;
    const bodyB = (await b.json()) as GamePauseStateResult;

    const applied = [bodyA, bodyB].filter((body) => body.applied);
    const idempotent = [bodyA, bodyB].filter((body) => !body.applied);
    expect(applied).toHaveLength(1);
    expect(idempotent).toHaveLength(1);
    expect(bodyA.paused).toBe(false);
    expect(bodyB.paused).toBe(false);
    expect(await countToggles("firstHalf")).toBe(2);
  });
});
