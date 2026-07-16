import type { APIRequestContext } from "@playwright/test";

/** Stable local IDs so re-runs stay idempotent for the e2e Clerk user. */
export const E2E_TEAM_ID = 1;
export const E2E_GAME_ID = 1;

const TEAM = { id: E2E_TEAM_ID, name: "E2E Home" } as const;

const PLAYERS = [
  { id: 1, teamId: E2E_TEAM_ID, name: "Alex", number: 7 },
  { id: 2, teamId: E2E_TEAM_ID, name: "Blake", number: 12 },
] as const;

const GAME = {
  id: E2E_GAME_ID,
  homeTeamId: E2E_TEAM_ID,
  createdAt: "2026-01-15T10:00:00.000Z",
} as const;

const STARTING_EVENTS = [
  {
    id: 1,
    player: 7,
    game_id: E2E_GAME_ID,
    ellapsed_seconds: 0,
    half: "firstHalf" as const,
    eventType: "startingPlayer" as const,
    eventGroup: "substitution" as const,
  },
  {
    id: 2,
    player: 12,
    game_id: E2E_GAME_ID,
    ellapsed_seconds: 0,
    half: "firstHalf" as const,
    eventType: "startingPlayer" as const,
    eventGroup: "substitution" as const,
  },
];

async function getJson<T>(request: APIRequestContext, url: string): Promise<T> {
  const response = await request.get(url);
  if (!response.ok()) {
    throw new Error(
      `GET ${url} failed: ${response.status()} ${await response.text()}`,
    );
  }
  return response.json() as Promise<T>;
}

async function postJson(
  request: APIRequestContext,
  url: string,
  data: unknown,
): Promise<void> {
  const response = await request.post(url, { data });
  if (!response.ok()) {
    throw new Error(
      `POST ${url} failed: ${response.status()} ${await response.text()}`,
    );
  }
}

/** Seed one finished past game for the signed-in e2e user via collections API. */
export async function seedE2eData(request: APIRequestContext): Promise<void> {
  const collections = "/api/collections";

  const activeGames = await getJson<Array<{ id: number }>>(
    request,
    `${collections}/active-game`,
  );
  if (activeGames.length > 0) {
    const response = await request.delete(`${collections}/active-game`, {
      data: activeGames.map((game) => game.id),
    });
    if (!response.ok() && response.status() !== 204) {
      throw new Error(
        `DELETE ${collections}/active-game failed: ${response.status()} ${await response.text()}`,
      );
    }
  }

  const teams = await getJson<Array<{ id: number }>>(
    request,
    `${collections}/teams`,
  );
  if (!teams.some((team) => team.id === TEAM.id)) {
    await postJson(request, `${collections}/teams`, [TEAM]);
  }

  const teamPlayers = await getJson<Array<{ id: number }>>(
    request,
    `${collections}/team-players`,
  );
  for (const player of PLAYERS) {
    if (!teamPlayers.some((row) => row.id === player.id)) {
      await postJson(request, `${collections}/team-players`, [player]);
    }
  }

  const gameResponse = await request.put(`${collections}/games`, {
    data: [GAME],
  });
  if (!gameResponse.ok()) {
    throw new Error(
      `PUT ${collections}/games failed: ${gameResponse.status()} ${await gameResponse.text()}`,
    );
  }

  const events = await getJson<Array<{ id: number; game_id: number }>>(
    request,
    `${collections}/player-events`,
  );
  const hasGameEvents = events.some((event) => event.game_id === E2E_GAME_ID);
  if (!hasGameEvents) {
    await postJson(request, `${collections}/player-events`, STARTING_EVENTS);
  }
}
