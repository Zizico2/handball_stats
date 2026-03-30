import { QueryClient } from "@tanstack/query-core";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { createCollection } from "@tanstack/react-db";
import {
  createGamesAction,
  createPlayerEventsAction,
  createTeamPlayersAction,
  createTeamsAction,
  deleteActiveGameAction,
  deletePlayerEventsAction,
  deleteTeamPlayersAction,
  deleteTeamsAction,
  listActiveGameAction,
  listGamesAction,
  listPlayerEventsAction,
  listTeamPlayersAction,
  listTeamsAction,
  upsertActiveGameAction,
} from "@/app/actions/collections";
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

const queryClient = new QueryClient();

export const playerEventsCollection = createCollection(
  queryCollectionOptions({
    id: "game-events",
    queryKey: ["player-events"],
    queryClient,
    schema: playerEventSchema,
    getKey: (item: PlayerEvent) => item.id,
    queryFn: listPlayerEventsAction,
    onInsert: async ({ transaction }) => {
      const newItems = transaction.mutations.map((m) => m.modified);
      await createPlayerEventsAction(newItems);
    },
    onDelete: async ({ transaction }) => {
      const ids = transaction.mutations.map((m) => m.key);
      await deletePlayerEventsAction(ids);
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
    queryFn: listTeamsAction,
    onInsert: async ({ transaction }) => {
      const newItems = transaction.mutations.map((m) => m.modified);
      await createTeamsAction(newItems);
    },
    onDelete: async ({ transaction }) => {
      const ids = transaction.mutations.map((m) => m.key);
      await deleteTeamsAction(ids);
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
    queryFn: listTeamPlayersAction,
    onInsert: async ({ transaction }) => {
      const newItems = transaction.mutations.map((m) => m.modified);
      await createTeamPlayersAction(newItems);
    },
    onDelete: async ({ transaction }) => {
      const ids = transaction.mutations.map((m) => m.key);
      await deleteTeamPlayersAction(ids);
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
    queryFn: listGamesAction,
    onInsert: async ({ transaction }) => {
      const newItems = transaction.mutations.map((m) => m.modified);
      await createGamesAction(newItems);
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
    queryFn: listActiveGameAction,
    onInsert: async ({ transaction }) => {
      const newItems = transaction.mutations.map((m) => m.modified);
      await upsertActiveGameAction(newItems);
    },
    onDelete: async ({ transaction }) => {
      const ids = transaction.mutations.map((m) => m.key);
      await deleteActiveGameAction(ids);
    },
  }),
);
