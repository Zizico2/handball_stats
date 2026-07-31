import { hc, parseResponse } from "hono/client";
import type {
  ActiveGame,
  Game,
  PauseToggle,
  PlayerEvent,
  QuickSubPair,
  StartGameBody,
  Team,
  TeamPlayer,
} from "@/datamodel";
import type { ApiApp } from "@/server/api/app";
import {
  isTeamHasGamesConflict,
  TeamHasGamesError,
} from "@/server/api/teamDeletionErrors";

const apiClient = hc<ApiApp>("/");

export async function listPlayerEventsQuery() {
  return parseResponse(apiClient.api.collections["player-events"].$get());
}

export async function listTeamsQuery() {
  return parseResponse(apiClient.api.collections.teams.$get());
}

export async function listTeamPlayersQuery() {
  return parseResponse(apiClient.api.collections["team-players"].$get());
}

export async function listGamesQuery() {
  return parseResponse(apiClient.api.collections.games.$get());
}

export async function listActiveGameQuery() {
  return parseResponse(apiClient.api.collections["active-game"].$get());
}

export async function createPlayerEventsMutation(items: PlayerEvent[]) {
  return parseResponse(
    apiClient.api.collections["player-events"].$post({ json: items }),
  );
}

export async function deletePlayerEventsMutation(ids: number[]) {
  await parseResponse(
    apiClient.api.collections["player-events"].$delete({ json: ids }),
  );
}

export async function createTeamsMutation(items: Team[]) {
  return parseResponse(apiClient.api.collections.teams.$post({ json: items }));
}

export async function deleteTeamsMutation(ids: number[]) {
  try {
    await parseResponse(apiClient.api.collections.teams.$delete({ json: ids }));
  } catch (error) {
    if (isTeamHasGamesConflict(error)) {
      throw new TeamHasGamesError(error);
    }
    throw error;
  }
}

export async function createTeamPlayersMutation(items: TeamPlayer[]) {
  return parseResponse(
    apiClient.api.collections["team-players"].$post({ json: items }),
  );
}

export async function deleteTeamPlayersMutation(ids: number[]) {
  await parseResponse(
    apiClient.api.collections["team-players"].$delete({ json: ids }),
  );
}

export async function listQuickSubPairsQuery() {
  return parseResponse(apiClient.api.collections["quick-sub-pairs"].$get());
}

export async function createQuickSubPairsMutation(items: QuickSubPair[]) {
  return parseResponse(
    apiClient.api.collections["quick-sub-pairs"].$post({ json: items }),
  );
}

export async function deleteQuickSubPairsMutation(ids: number[]) {
  await parseResponse(
    apiClient.api.collections["quick-sub-pairs"].$delete({ json: ids }),
  );
}

export async function createGamesMutation(items: Game[]) {
  return parseResponse(apiClient.api.collections.games.$post({ json: items }));
}

export async function startGameMutation(body: StartGameBody) {
  return parseResponse(
    apiClient.api.collections.games.start.$post({ json: body }),
  );
}

export async function upsertGamesMutation(items: Game[]) {
  return parseResponse(apiClient.api.collections.games.$put({ json: items }));
}

export async function transitionGamePhaseMutation(
  gameId: number,
  to: "firstHalf" | "halftime" | "secondHalf",
) {
  return parseResponse(
    apiClient.api.collections.games[":gameId"].transitions.$post({
      param: { gameId: String(gameId) },
      json: { to },
    }),
  );
}

export async function setGamePauseStateMutation(
  gameId: number,
  body: {
    half: "firstHalf" | "secondHalf";
    paused: boolean;
    clientId?: string;
  },
) {
  return parseResponse(
    apiClient.api.collections.games[":gameId"]["pause-state"].$post({
      param: { gameId: String(gameId) },
      json: body,
    }),
  );
}

export async function upsertActiveGameMutation(items: ActiveGame[]) {
  return parseResponse(
    apiClient.api.collections["active-game"].$put({ json: items }),
  );
}

export async function deleteActiveGameMutation(ids: number[]) {
  await parseResponse(
    apiClient.api.collections["active-game"].$delete({ json: ids }),
  );
}

export async function listPauseTogglesQuery() {
  return parseResponse(apiClient.api.collections["pause-toggles"].$get());
}

export async function upsertPauseToggleMutation(item: PauseToggle) {
  return parseResponse(
    apiClient.api.collections["pause-toggles"][":pauseToggleId"].$put({
      param: { pauseToggleId: item.id },
      json: {
        gameId: item.gameId,
        half: item.half,
      },
    }),
  );
}

export async function deletePauseToggleMutation(id: string) {
  await parseResponse(
    apiClient.api.collections["pause-toggles"][":pauseToggleId"].$delete({
      param: { pauseToggleId: id },
    }),
  );
}

export async function getMatchClockSnapshotQuery(gameId: number) {
  return parseResponse(
    apiClient.api.collections["match-clock"][":gameId"].$get({
      param: { gameId: String(gameId) },
    }),
  );
}
