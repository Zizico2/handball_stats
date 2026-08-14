import type { APIRequestContext } from "@playwright/test";
import { testClientId, testPlayerEventId } from "../src/testing/clientId";

export const E2E_TEAM_ID = testClientId(1);
export const E2E_GAME_ID = testClientId(100);

const TEAM = { id: E2E_TEAM_ID, name: "E2E Home" } as const;

const PLAYERS = [
  { id: testClientId(11), teamId: E2E_TEAM_ID, name: "Alex", number: 7 },
  { id: testClientId(12), teamId: E2E_TEAM_ID, name: "Blake", number: 12 },
] as const;

const GAME = {
  id: E2E_GAME_ID,
  homeTeamId: E2E_TEAM_ID,
  createdAt: "2026-01-15T10:00:00.000Z",
} as const;

const STARTING_EVENTS = [
  {
    id: testPlayerEventId(21),
    player: 7,
    game_id: E2E_GAME_ID,
    ellapsed_seconds: 0,
    half: "firstHalf" as const,
    eventType: "startingPlayer" as const,
    eventGroup: "substitution" as const,
  },
  {
    id: testPlayerEventId(22),
    player: 12,
    game_id: E2E_GAME_ID,
    ellapsed_seconds: 0,
    half: "firstHalf" as const,
    eventType: "startingPlayer" as const,
    eventGroup: "substitution" as const,
  },
];

async function expectOk(
  response: Awaited<ReturnType<APIRequestContext["post"]>>,
) {
  if (!response.ok()) {
    throw new Error(
      `Request to ${response.url()} failed: ${response.status()} ${await response.text()}`,
    );
  }
}

export async function resetE2eData(request: APIRequestContext): Promise<void> {
  const token = process.env.E2E_RESET_TOKEN;
  if (!token) {
    throw new Error("E2E_RESET_TOKEN is required for the mutating E2E suite");
  }

  const response = await request.post("/api/e2e/reset", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status() !== 204) {
    throw new Error(
      `POST /api/e2e/reset failed: ${response.status()} ${await response.text()}`,
    );
  }
}

export async function seedE2eTeam(request: APIRequestContext): Promise<void> {
  await expectOk(
    await request.post("/api/collections/teams", { data: [TEAM] }),
  );
}

/** Seed the exact deterministic baseline after the fixture has reset the user. */
export async function seedE2eData(request: APIRequestContext): Promise<void> {
  const collections = "/api/collections";
  await seedE2eTeam(request);
  await expectOk(
    await request.post(`${collections}/team-players`, { data: PLAYERS }),
  );
  await expectOk(await request.put(`${collections}/games`, { data: [GAME] }));
  await expectOk(
    await request.post(`${collections}/player-events`, {
      data: STARTING_EVENTS,
    }),
  );
}
