import { QueryClient } from "@tanstack/query-core";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { createCollection } from "@tanstack/react-db";
import type {
  ActiveGame,
  Game,
  PlayerEvent,
  Team,
  TeamPlayer,
} from "@/datamodel";
import {
  activeGameSchema,
  gameSchema,
  playerEventSchema,
  teamPlayerSchema,
  teamSchema,
} from "@/datamodel";
import {
  createGamesMutation,
  createPlayerEventsMutation,
  createTeamPlayersMutation,
  createTeamsMutation,
  deleteActiveGameMutation,
  deletePlayerEventsMutation,
  deleteTeamPlayersMutation,
  deleteTeamsMutation,
  listActiveGameQuery,
  listGamesQuery,
  listPlayerEventsQuery,
  listTeamPlayersQuery,
  listTeamsQuery,
  upsertActiveGameMutation,
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
