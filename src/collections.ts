import { QueryClient } from "@tanstack/query-core";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { createCollection } from "@tanstack/react-db";
import type {
  ActiveGame,
  Game,
  PauseToggle,
  PlayerEvent,
  Team,
  TeamPlayer,
} from "@/datamodel";
import {
  activeGameSchema,
  gameSchema,
  pauseToggleSchema,
  playerEventSchema,
  teamPlayerSchema,
  teamSchema,
} from "@/datamodel";
import {
  createGamesMutation,
  createPauseTogglesMutation,
  createPlayerEventsMutation,
  createTeamPlayersMutation,
  createTeamsMutation,
  deleteActiveGameMutation,
  deletePauseTogglesMutation,
  deletePlayerEventsMutation,
  deleteTeamPlayersMutation,
  deleteTeamsMutation,
  listActiveGameQuery,
  listGamesQuery,
  listPauseTogglesQuery,
  listPlayerEventsQuery,
  listTeamPlayersQuery,
  listTeamsQuery,
  upsertActiveGameMutation,
  upsertGamesMutation,
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
    // TODO: use `Promise.all` or similar to run these in parallel instead of sequentially
    onInsert: async ({ transaction }) => {
      const newItems = transaction.mutations.map((m) => m.modified);
      await createPlayerEventsMutation(newItems);
    },
    // TODO: use `Promise.all` or similar to run these in parallel instead of sequentially
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
    // TODO: use `Promise.all` or similar to run these in parallel instead of sequentially
    onInsert: async ({ transaction }) => {
      const newItems = transaction.mutations.map((m) => m.modified);
      await createTeamsMutation(newItems);
    },
    // TODO: use `Promise.all` or similar to run these in parallel instead of sequentially
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
    // TODO: use `Promise.all` or similar to run these in parallel instead of sequentially
    onInsert: async ({ transaction }) => {
      const newItems = transaction.mutations.map((m) => m.modified);
      await createTeamPlayersMutation(newItems);
    },
    // TODO: use `Promise.all` or similar to run these in parallel instead of sequentially
    onDelete: async ({ transaction }) => {
      const ids = transaction.mutations.map((m) => m.key);
      await deleteTeamPlayersMutation(ids);
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
    // TODO: use `Promise.all` or similar to run these in parallel instead of sequentially
    onInsert: async ({ transaction }) => {
      const newItems = transaction.mutations.map((m) => m.modified);
      await createGamesMutation(newItems);
    },
    // TODO: use `Promise.all` or similar to run these in parallel instead of sequentially
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
    getKey: (item: PauseToggle) => `${item.gameId}-${item.toggledAtMs}`,
    // TODO: make sure `toggledAtMs` are unique in this function. they don't have to be unique accross the whole DB, but withing the same game, they do, which is what this collection should represent.
    queryFn: listPauseTogglesQuery,
    // TODO: use `Promise.all` or similar to run these in parallel instead of sequentially
    onInsert: async ({ transaction }) => {
      const newItems = transaction.mutations.map((m) => m.modified);
      await createPauseTogglesMutation(newItems);
    },
    // TODO: use `Promise.all` or similar to run these in parallel instead of sequentially
    onDelete: async ({ transaction }) => {
      const ids = transaction.mutations.map((m) => m.key);
      await deletePauseTogglesMutation(ids);
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
    // TODO: use `Promise.all` or similar to run these in parallel instead of sequentially
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
