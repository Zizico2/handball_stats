import {
  collectionOptions,
  type DbClient,
  type InitialQueryBuilder,
} from "@tanstack/db";
import type { QueryClient } from "@tanstack/query-core";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
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
  type CollectionQueryFns,
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

function queryFnsFor(client: DbClient): CollectionQueryFns {
  return (
    client.getDependency<CollectionQueryFns>("collectionQueries") ?? {
      listActiveGameQuery,
      listGamesQuery,
      listPauseTogglesQuery,
      listPlayerEventsQuery,
      listQuickSubPairsQuery,
      listTeamPlayersQuery,
      listTeamsQuery,
    }
  );
}

export const playerEventsCollection = collectionOptions(
  "game-events",
  (client) => {
    const queryFns = queryFnsFor(client);
    return queryCollectionOptions({
      id: "game-events",
      queryKey: ["player-events"],
      queryClient: client.requireDependency<QueryClient>("queryClient"),
      schema: playerEventSchema,
      getKey: (item: PlayerEvent) => item.id,
      queryFn: queryFns.listPlayerEventsQuery,
      onInsert: async ({ transaction }) => {
        const newItems = transaction.mutations.map((m) => m.modified);
        const persistedItems = await createPlayerEventsMutation(newItems);
        const persistedById = new Map(
          persistedItems.map((item) => [item.id, item]),
        );
        transaction.mutations.forEach((mutation) => {
          const persisted = persistedById.get(mutation.modified.id);
          if (!persisted) {
            throw new Error("Server response omitted an inserted player event");
          }
          mutation.modified = persisted;
        });
      },
      onDelete: async ({ transaction }) => {
        const ids = transaction.mutations.map((m) => m.key);
        await deletePlayerEventsMutation(ids);
      },
    });
  },
);

export const teamsCollection = collectionOptions("teams", (client) => {
  const queryFns = queryFnsFor(client);
  return queryCollectionOptions({
    id: "teams",
    queryKey: ["teams"],
    queryClient: client.requireDependency<QueryClient>("queryClient"),
    schema: teamSchema,
    getKey: (item: Team) => item.id,
    queryFn: queryFns.listTeamsQuery,
    onInsert: async ({ transaction }) => {
      const newItems = transaction.mutations.map((m) => m.modified);
      await createTeamsMutation(newItems);
    },
    onDelete: async ({ transaction }) => {
      const ids = transaction.mutations.map((m) => m.key);
      await deleteTeamsMutation(ids);
    },
  });
});

export const teamPlayersCollection = collectionOptions(
  "team-players",
  (client) => {
    const queryFns = queryFnsFor(client);
    return queryCollectionOptions({
      id: "team-players",
      queryKey: ["team-players"],
      queryClient: client.requireDependency<QueryClient>("queryClient"),
      schema: teamPlayerSchema,
      getKey: (item: TeamPlayer) => item.id,
      queryFn: queryFns.listTeamPlayersQuery,
      onInsert: async ({ transaction }) => {
        const newItems = transaction.mutations.map((m) => m.modified);
        await createTeamPlayersMutation(newItems);
      },
      onDelete: async ({ transaction }) => {
        const ids = transaction.mutations.map((m) => m.key);
        await deleteTeamPlayersMutation(ids);
      },
    });
  },
);

export const quickSubPairsCollection = collectionOptions(
  "quick-sub-pairs",
  (client) => {
    const queryFns = queryFnsFor(client);
    return queryCollectionOptions({
      id: "quick-sub-pairs",
      queryKey: ["quick-sub-pairs"],
      queryClient: client.requireDependency<QueryClient>("queryClient"),
      schema: quickSubPairSchema,
      getKey: (item: QuickSubPair) => item.id,
      queryFn: queryFns.listQuickSubPairsQuery,
      onInsert: async ({ transaction }) => {
        const newItems = transaction.mutations.map((m) => m.modified);
        await createQuickSubPairsMutation(newItems);
      },
      onDelete: async ({ transaction }) => {
        const ids = transaction.mutations.map((m) => m.key);
        await deleteQuickSubPairsMutation(ids);
      },
    });
  },
);

export const gamesCollection = collectionOptions("games", (client) => {
  const queryFns = queryFnsFor(client);
  return queryCollectionOptions({
    id: "games",
    queryKey: ["games"],
    queryClient: client.requireDependency<QueryClient>("queryClient"),
    schema: gameSchema,
    getKey: (item: Game) => item.id,
    queryFn: queryFns.listGamesQuery,
    onInsert: async ({ transaction }) => {
      const newItems = transaction.mutations.map((m) => m.modified);
      await createGamesMutation(newItems);
    },
    onUpdate: async ({ transaction }) => {
      const updatedItems = transaction.mutations.map((m) => m.modified);
      await upsertGamesMutation(updatedItems);
    },
  });
});

export const pauseTogglesCollection = collectionOptions(
  "pause-toggles",
  (client) => {
    const queryFns = queryFnsFor(client);
    return queryCollectionOptions({
      id: "pause-toggles",
      queryKey: ["pause-toggles"],
      queryClient: client.requireDependency<QueryClient>("queryClient"),
      schema: pauseToggleSchema,
      getKey: (item: PauseToggle) => item.id,
      queryFn: queryFns.listPauseTogglesQuery,
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
    });
  },
);

export const activeGameCollection = collectionOptions(
  "active-game",
  (client) => {
    const queryFns = queryFnsFor(client);
    return queryCollectionOptions({
      id: "active-game",
      queryKey: ["active-game"],
      queryClient: client.requireDependency<QueryClient>("queryClient"),
      schema: activeGameSchema,
      getKey: (item: ActiveGame) => item.id,
      queryFn: queryFns.listActiveGameQuery,
      onInsert: async ({ transaction }) => {
        const newItems = transaction.mutations.map((m) => m.modified);
        await upsertActiveGameMutation(newItems);
      },
      onDelete: async ({ transaction }) => {
        const ids = transaction.mutations.map((m) => m.key);
        await deleteActiveGameMutation(ids);
      },
    });
  },
);

export const playerEventsLiveQuery = {
  query: (q: InitialQueryBuilder) => q.from({ event: playerEventsCollection }),
};

export const teamsLiveQuery = {
  query: (q: InitialQueryBuilder) => q.from({ team: teamsCollection }),
};

export const teamPlayersLiveQuery = {
  query: (q: InitialQueryBuilder) => q.from({ player: teamPlayersCollection }),
};

export const quickSubPairsLiveQuery = {
  query: (q: InitialQueryBuilder) => q.from({ pair: quickSubPairsCollection }),
};

export const gamesLiveQuery = {
  query: (q: InitialQueryBuilder) => q.from({ game: gamesCollection }),
};

export const pauseTogglesLiveQuery = {
  query: (q: InitialQueryBuilder) =>
    q.from({ pauseToggle: pauseTogglesCollection }),
};

export const activeGameLiveQuery = {
  query: (q: InitialQueryBuilder) =>
    q.from({ activeGame: activeGameCollection }).findOne(),
};

export function materializeCollections(client: DbClient) {
  return {
    activeGameCollection: client.collection(activeGameCollection),
    gamesCollection: client.collection(gamesCollection),
    pauseTogglesCollection: client.collection(pauseTogglesCollection),
    playerEventsCollection: client.collection(playerEventsCollection),
    quickSubPairsCollection: client.collection(quickSubPairsCollection),
    teamPlayersCollection: client.collection(teamPlayersCollection),
    teamsCollection: client.collection(teamsCollection),
  };
}

export type AppCollections = ReturnType<typeof materializeCollections>;
