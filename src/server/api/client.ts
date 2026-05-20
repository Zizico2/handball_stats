import { hc } from "hono/client";
import type {
  ActiveGame,
  Game,
  MatchClockSnapshot,
  PauseToggle,
  PlayerEvent,
  Team,
  TeamPlayer,
} from "@/datamodel";
import type { ApiApp } from "@/server/api/app";

const apiClient = hc<ApiApp>("/");

type JsonResponseLike<T> = {
  ok: boolean;
  status: number;
  json: () => Promise<T>;
};

async function parseJsonResponse<T>(response: JsonResponseLike<T>) {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

async function assertSuccessfulResponse(
  response: Pick<JsonResponseLike<unknown>, "ok" | "status">,
) {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
}

export async function listPlayerEventsQuery() {
  const response = await apiClient.api.collections["player-events"].$get();

  return parseJsonResponse<PlayerEvent[]>(response);
}

export async function listTeamsQuery() {
  const response = await apiClient.api.collections.teams.$get();

  return parseJsonResponse<Team[]>(response);
}

export async function listTeamPlayersQuery() {
  const response = await apiClient.api.collections["team-players"].$get();

  return parseJsonResponse<TeamPlayer[]>(response);
}

export async function listGamesQuery() {
  const response = await apiClient.api.collections.games.$get();

  return parseJsonResponse<Game[]>(response);
}

export async function listActiveGameQuery() {
  const response = await apiClient.api.collections["active-game"].$get();

  return parseJsonResponse<ActiveGame[]>(response);
}

export async function createPlayerEventsMutation(items: PlayerEvent[]) {
  const response = await apiClient.api.collections["player-events"].$post({
    json: items,
  });

  return parseJsonResponse<PlayerEvent[]>(response);
}

export async function deletePlayerEventsMutation(ids: number[]) {
  const response = await apiClient.api.collections["player-events"].$delete({
    json: ids,
  });

  await assertSuccessfulResponse(response);
}

export async function createTeamsMutation(items: Team[]) {
  const response = await apiClient.api.collections.teams.$post({
    json: items,
  });

  return parseJsonResponse<Team[]>(response);
}

export async function deleteTeamsMutation(ids: number[]) {
  const response = await apiClient.api.collections.teams.$delete({
    json: ids,
  });

  await assertSuccessfulResponse(response);
}

export async function createTeamPlayersMutation(items: TeamPlayer[]) {
  const response = await apiClient.api.collections["team-players"].$post({
    json: items,
  });

  return parseJsonResponse<TeamPlayer[]>(response);
}

export async function deleteTeamPlayersMutation(ids: number[]) {
  const response = await apiClient.api.collections["team-players"].$delete({
    json: ids,
  });

  await assertSuccessfulResponse(response);
}

export async function createGamesMutation(items: Game[]) {
  const response = await apiClient.api.collections.games.$post({
    json: items,
  });

  return parseJsonResponse<Game[]>(response);
}

export async function upsertGamesMutation(items: Game[]) {
  const response = await apiClient.api.collections.games.$put({
    json: items,
  });

  return parseJsonResponse<Game[]>(response);
}

export async function upsertActiveGameMutation(items: ActiveGame[]) {
  const response = await apiClient.api.collections["active-game"].$put({
    json: items,
  });

  return parseJsonResponse<ActiveGame[]>(response);
}

export async function deleteActiveGameMutation(ids: number[]) {
  const response = await apiClient.api.collections["active-game"].$delete({
    json: ids,
  });

  await assertSuccessfulResponse(response);
}

export async function listPauseTogglesQuery() {
  const response = await apiClient.api.collections["pause-toggles"].$get();

  return parseJsonResponse<PauseToggle[]>(response);
}

export async function upsertPauseToggleMutation(item: PauseToggle) {
  const response = await apiClient.api.collections["pause-toggles"][
    ":pauseToggleId"
  ].$put({
    param: { pauseToggleId: item.id },
    json: {
      gameId: item.gameId,
      half: item.half,
    },
  });

  return parseJsonResponse<PauseToggle>(response);
}

export async function deletePauseToggleMutation(id: string) {
  const response = await apiClient.api.collections["pause-toggles"][
    ":pauseToggleId"
  ].$delete({
    param: { pauseToggleId: id },
  });

  await assertSuccessfulResponse(response);
}

export async function getMatchClockSnapshotQuery(gameId: number) {
  const response = await apiClient.api.collections["match-clock"][
    ":gameId"
  ].$get({
    param: { gameId: String(gameId) },
  });

  return parseJsonResponse<MatchClockSnapshot>(response);
}
