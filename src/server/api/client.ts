import { hc } from "hono/client";
import type {
  ActiveGame,
  Game,
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
