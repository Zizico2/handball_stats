import { hc, parseResponse } from "hono/client";
import {
  type ActiveGame,
  activeGameSchema,
  type ClientId,
  type Game,
  gamePauseStateResultSchema,
  gamePhaseTransitionResultSchema,
  gameSchema,
  matchClockSnapshotSchema,
  type PauseToggle,
  type PlayerEvent,
  pauseToggleSchema,
  playerEventSchema,
  type QuickSubPair,
  quickSubPairSchema,
  type StartGameBody,
  startGameResultSchema,
  type Team,
  type TeamPlayer,
  teamPlayerSchema,
  teamSchema,
} from "@/datamodel";
import type { ApiApp } from "@/server/api/app";
import {
  isTeamHasGamesConflict,
  TeamHasGamesError,
} from "@/server/api/teamDeletionErrors";

type ApiClient = ReturnType<typeof hc<ApiApp>>;

export type CollectionQueryFns = {
  listPlayerEventsQuery: () => Promise<PlayerEvent[]>;
  listTeamsQuery: () => Promise<Team[]>;
  listTeamPlayersQuery: () => Promise<TeamPlayer[]>;
  listGamesQuery: () => Promise<Game[]>;
  listActiveGameQuery: () => Promise<ActiveGame[]>;
  listQuickSubPairsQuery: () => Promise<QuickSubPair[]>;
  listPauseTogglesQuery: () => Promise<PauseToggle[]>;
};

export function createCollectionQueries(client: ApiClient): CollectionQueryFns {
  return {
    async listPlayerEventsQuery() {
      return playerEventSchema
        .array()
        .parse(
          await parseResponse(client.api.collections["player-events"].$get()),
        );
    },
    async listTeamsQuery() {
      return teamSchema
        .array()
        .parse(await parseResponse(client.api.collections.teams.$get()));
    },
    async listTeamPlayersQuery() {
      return teamPlayerSchema
        .array()
        .parse(
          await parseResponse(client.api.collections["team-players"].$get()),
        );
    },
    async listGamesQuery() {
      return gameSchema
        .array()
        .parse(await parseResponse(client.api.collections.games.$get()));
    },
    async listActiveGameQuery() {
      return activeGameSchema
        .array()
        .parse(
          await parseResponse(client.api.collections["active-game"].$get()),
        );
    },
    async listQuickSubPairsQuery() {
      return quickSubPairSchema
        .array()
        .parse(
          await parseResponse(client.api.collections["quick-sub-pairs"].$get()),
        );
    },
    async listPauseTogglesQuery() {
      return pauseToggleSchema
        .array()
        .parse(
          await parseResponse(client.api.collections["pause-toggles"].$get()),
        );
    },
  };
}

const apiClient = hc<ApiApp>("/");
const collectionQueries = createCollectionQueries(apiClient);

export const {
  listActiveGameQuery,
  listGamesQuery,
  listPauseTogglesQuery,
  listPlayerEventsQuery,
  listQuickSubPairsQuery,
  listTeamPlayersQuery,
  listTeamsQuery,
} = collectionQueries;

export async function createPlayerEventsMutation(items: PlayerEvent[]) {
  return playerEventSchema
    .array()
    .parse(
      await parseResponse(
        apiClient.api.collections["player-events"].$post({ json: items }),
      ),
    );
}

export async function deletePlayerEventsMutation(ids: ClientId[]) {
  await parseResponse(
    apiClient.api.collections["player-events"].$delete({ json: ids }),
  );
}

export async function createTeamsMutation(items: Team[]) {
  return teamSchema
    .array()
    .parse(
      await parseResponse(
        apiClient.api.collections.teams.$post({ json: items }),
      ),
    );
}

export async function deleteTeamsMutation(ids: ClientId[]) {
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
  return teamPlayerSchema
    .array()
    .parse(
      await parseResponse(
        apiClient.api.collections["team-players"].$post({ json: items }),
      ),
    );
}

export async function deleteTeamPlayersMutation(ids: ClientId[]) {
  await parseResponse(
    apiClient.api.collections["team-players"].$delete({ json: ids }),
  );
}

export async function createQuickSubPairsMutation(items: QuickSubPair[]) {
  return quickSubPairSchema
    .array()
    .parse(
      await parseResponse(
        apiClient.api.collections["quick-sub-pairs"].$post({ json: items }),
      ),
    );
}

export async function deleteQuickSubPairsMutation(ids: ClientId[]) {
  await parseResponse(
    apiClient.api.collections["quick-sub-pairs"].$delete({ json: ids }),
  );
}

export async function createGamesMutation(items: Game[]) {
  return gameSchema
    .array()
    .parse(
      await parseResponse(
        apiClient.api.collections.games.$post({ json: items }),
      ),
    );
}

export async function startGameMutation(body: StartGameBody) {
  return startGameResultSchema.parse(
    await parseResponse(
      apiClient.api.collections.games.start.$post({ json: body }),
    ),
  );
}

export async function upsertGamesMutation(items: Game[]) {
  return gameSchema
    .array()
    .parse(
      await parseResponse(
        apiClient.api.collections.games.$put({ json: items }),
      ),
    );
}

export async function transitionGamePhaseMutation(
  gameId: ClientId,
  to: "firstHalf" | "halftime" | "secondHalf",
) {
  return gamePhaseTransitionResultSchema.parse(
    await parseResponse(
      apiClient.api.collections.games[":gameId"].transitions.$post({
        param: { gameId: String(gameId) },
        json: { to },
      }),
    ),
  );
}

export async function setGamePauseStateMutation(
  gameId: ClientId,
  body: {
    half: "firstHalf" | "secondHalf";
    paused: boolean;
    clientId?: ClientId;
  },
) {
  return gamePauseStateResultSchema.parse(
    await parseResponse(
      apiClient.api.collections.games[":gameId"]["pause-state"].$post({
        param: { gameId: String(gameId) },
        json: body,
      }),
    ),
  );
}

export async function upsertActiveGameMutation(items: ActiveGame[]) {
  return activeGameSchema
    .array()
    .parse(
      await parseResponse(
        apiClient.api.collections["active-game"].$put({ json: items }),
      ),
    );
}

export async function deleteActiveGameMutation(ids: 1[]) {
  await parseResponse(
    apiClient.api.collections["active-game"].$delete({ json: ids }),
  );
}

export async function upsertPauseToggleMutation(item: PauseToggle) {
  return pauseToggleSchema.parse(
    await parseResponse(
      apiClient.api.collections["pause-toggles"][":pauseToggleId"].$put({
        param: { pauseToggleId: item.id },
        json: {
          gameId: item.gameId,
          half: item.half,
        },
      }),
    ),
  );
}

export async function deletePauseToggleMutation(id: ClientId) {
  await parseResponse(
    apiClient.api.collections["pause-toggles"][":pauseToggleId"].$delete({
      param: { pauseToggleId: id },
    }),
  );
}

export async function getMatchClockSnapshotQuery(gameId: ClientId) {
  return matchClockSnapshotSchema.parse(
    await parseResponse(
      apiClient.api.collections["match-clock"][":gameId"].$get({
        param: { gameId: String(gameId) },
      }),
    ),
  );
}
