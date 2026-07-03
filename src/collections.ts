import { QueryClient } from "@tanstack/query-core";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { createCollection } from "@tanstack/react-db";
import type {
  ActiveGame,
  Game,
  PauseToggle,
  PlayerEvent,
  QuickSubPair,
  Team,
  TeamPlayer,
} from "@/datamodel";
import {
  activeGameSchema,
  gameSchema,
  pauseToggleSchema,
  playerEventSchema,
  quickSubPairSchema,
  teamPlayerSchema,
  teamSchema,
} from "@/datamodel";
import {
  createGamesMutation,
  createPlayerEventsMutation,
  createQuickSubPairsMutation,
  createTeamPlayersMutation,
  createTeamsMutation,
  deleteActiveGameMutation,
  deletePauseToggleMutation,
  deletePlayerEventsMutation,
  deleteQuickSubPairsMutation,
  deleteTeamPlayersMutation,
  deleteTeamsMutation,
  listActiveGameQuery,
  listGamesQuery,
  listPauseTogglesQuery,
  listPlayerEventsQuery,
  listQuickSubPairsQuery,
  listTeamPlayersQuery,
  listTeamsQuery,
  upsertActiveGameMutation,
  upsertGamesMutation,
  upsertPauseToggleMutation,
} from "@/server/api/client";

const queryClient = new QueryClient();

export const playerEventsCollection = createCollection(
  queryCollectionOptions({
    id: "game-events",
    queryKey: ["player-events"],
    queryClient,
    schema: playerEventSchema,
    getKey: (item: PlayerEvent) => item.id,
    queryFn: listPlayerEventsQuery,
    onInsert: async ({ transaction }) => {
      const newItems = transaction.mutations.map((m) => m.modified);
      await createPlayerEventsMutation(newItems);
    },
    onDelete: async ({ transaction }) => {
      const ids = transaction.mutations.map((m) => m.key);
      await deletePlayerEventsMutation(ids);
    },
  }),
);

export const teamsCollection = createCollection(
  queryCollectionOptions({
    id: "teams",
    queryKey: ["teams"],
    queryClient,
    schema: teamSchema,
    getKey: (item: Team) => item.id,
    queryFn: listTeamsQuery,
    onInsert: async ({ transaction }) => {
      const newItems = transaction.mutations.map((m) => m.modified);
      await createTeamsMutation(newItems);
    },
    onDelete: async ({ transaction }) => {
      const ids = transaction.mutations.map((m) => m.key);
      await deleteTeamsMutation(ids);
    },
  }),
);

export const teamPlayersCollection = createCollection(
  queryCollectionOptions({
    id: "team-players",
    queryKey: ["team-players"],
    queryClient,
    schema: teamPlayerSchema,
    getKey: (item: TeamPlayer) => item.id,
    queryFn: listTeamPlayersQuery,
    onInsert: async ({ transaction }) => {
      const newItems = transaction.mutations.map((m) => m.modified);
      await createTeamPlayersMutation(newItems);
    },
    onDelete: async ({ transaction }) => {
      const ids = transaction.mutations.map((m) => m.key);
      await deleteTeamPlayersMutation(ids);
    },
  }),
);

export const quickSubPairsCollection = createCollection(
  queryCollectionOptions({
    id: "quick-sub-pairs",
    queryKey: ["quick-sub-pairs"],
    queryClient,
    schema: quickSubPairSchema,
    getKey: (item: QuickSubPair) => item.id,
    queryFn: listQuickSubPairsQuery,
    onInsert: async ({ transaction }) => {
      const newItems = transaction.mutations.map((m) => m.modified);
      await createQuickSubPairsMutation(newItems);
    },
    onDelete: async ({ transaction }) => {
      const ids = transaction.mutations.map((m) => m.key);
      await deleteQuickSubPairsMutation(ids);
    },
  }),
);

export const gamesCollection = createCollection(
  queryCollectionOptions({
    id: "games",
    queryKey: ["games"],
    queryClient,
    schema: gameSchema,
    getKey: (item: Game) => item.id,
    queryFn: listGamesQuery,
    onInsert: async ({ transaction }) => {
      const newItems = transaction.mutations.map((m) => m.modified);
      await createGamesMutation(newItems);
    },
    onUpdate: async ({ transaction }) => {
      const updatedItems = transaction.mutations.map((m) => m.modified);
      await upsertGamesMutation(updatedItems);
    },
  }),
);

export const pauseTogglesCollection = createCollection(
  queryCollectionOptions({
    id: "pause-toggles",
    queryKey: ["pause-toggles"],
    queryClient,
    schema: pauseToggleSchema,
    getKey: (item: PauseToggle) => item.id,
    queryFn: listPauseTogglesQuery,
    onInsert: async ({ transaction }) => {
      const newItems = transaction.mutations.map((m) => m.modified);
      const results = await Promise.all(
        newItems.map((item) => upsertPauseToggleMutation(item)),
      );
      results.forEach((result, index) => {
        transaction.mutations[index].modified = result;
      });
    },
    onDelete: async ({ transaction }) => {
      const ids = transaction.mutations.map((m) => m.key);
      await Promise.all(ids.map((id) => deletePauseToggleMutation(id)));
    },
  }),
);

export const activeGameCollection = createCollection(
  queryCollectionOptions({
    id: "active-game",
    queryKey: ["active-game"],
    queryClient,
    schema: activeGameSchema,
    getKey: (item: ActiveGame) => item.id,
    queryFn: listActiveGameQuery,
    onInsert: async ({ transaction }) => {
      const newItems = transaction.mutations.map((m) => m.modified);
      await upsertActiveGameMutation(newItems);
    },
    onDelete: async ({ transaction }) => {
      const ids = transaction.mutations.map((m) => m.key);
      await deleteActiveGameMutation(ids);
    },
  }),
);

// TODO: unused
function _test() {
  activeGameCollection.utils.refetch();
}
