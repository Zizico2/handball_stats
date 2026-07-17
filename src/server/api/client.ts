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
  await parseResponse(apiClient.api.collections.teams.$delete({ json: ids }));
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

import type { ImportDiagnostic } from "@/gameImport/types";
import type {
  GameImportDuplicateStatus,
  GameImportPreview,
} from "@/server/gameImport";

export type GameImportPreviewResponse =
  | { status: "needs_metadata"; formatVersion: string; missing: string[] }
  | { status: "invalid"; diagnostics: ImportDiagnostic[] }
  | (Omit<GameImportPreview, "status"> & { status: "ready" });

export type GameImportConfirmResponse =
  | { gameId: number; source: "imported" }
  | { status: "invalid"; diagnostics: ImportDiagnostic[] }
  | {
      status: "conflict";
      code: "PREVIEW_STALE" | "EXACT_DUPLICATE" | "LIKELY_DUPLICATE";
      existingGameId?: number;
    };

export type GameImportRequestFields = {
  file: File;
  homeTeamId?: number;
  matchDate?: string;
  opponent?: string;
};

function gameImportFormData(
  fields: GameImportRequestFields,
  confirm?: { previewFingerprint: string; allowLikelyDuplicate: boolean },
): FormData {
  const form = new FormData();
  form.set("file", fields.file);
  if (fields.homeTeamId !== undefined) {
    form.set("homeTeamId", String(fields.homeTeamId));
  }
  if (fields.matchDate !== undefined && fields.matchDate !== "") {
    form.set("matchDate", fields.matchDate);
  }
  if (fields.opponent !== undefined && fields.opponent !== "") {
    form.set("opponent", fields.opponent);
  }
  if (confirm) {
    form.set("previewFingerprint", confirm.previewFingerprint);
    form.set(
      "allowLikelyDuplicate",
      confirm.allowLikelyDuplicate ? "true" : "false",
    );
  }
  return form;
}

export async function previewGameImportMutation(
  fields: GameImportRequestFields,
): Promise<{ httpStatus: number; body: GameImportPreviewResponse }> {
  const response = await fetch("/api/game-imports/preview", {
    method: "POST",
    body: gameImportFormData(fields),
  });

  if (!response.ok && response.status !== 422) {
    throw new Error(await readErrorMessage(response));
  }

  return {
    httpStatus: response.status,
    body: (await response.json()) as GameImportPreviewResponse,
  };
}

export async function confirmGameImportMutation(
  fields: GameImportRequestFields,
  confirm: { previewFingerprint: string; allowLikelyDuplicate: boolean },
): Promise<{ httpStatus: number; body: GameImportConfirmResponse }> {
  const response = await fetch("/api/game-imports/confirm", {
    method: "POST",
    body: gameImportFormData(fields, confirm),
  });

  if (!response.ok && response.status !== 409 && response.status !== 422) {
    throw new Error(await readErrorMessage(response));
  }

  return {
    httpStatus: response.status,
    body: (await response.json()) as GameImportConfirmResponse,
  };
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export type { GameImportDuplicateStatus };

export async function getMatchClockSnapshotQuery(gameId: number) {
  return parseResponse(
    apiClient.api.collections["match-clock"][":gameId"].$get({
      param: { gameId: String(gameId) },
    }),
  );
}
