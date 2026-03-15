import {
  createCollection,
  localStorageCollectionOptions,
} from "@tanstack/react-db";
import {
  activeGameSchema,
  gameSchema,
  playerEventSchema,
  teamPlayerSchema,
  teamSchema,
} from "@/datamodel";

export const playerEventsCollection = createCollection(
  localStorageCollectionOptions({
    id: "game-events",
    storageKey: "game-events",
    schema: playerEventSchema,
    getKey: (item) => item.id,
  }),
);

export const teamsCollection = createCollection(
  localStorageCollectionOptions({
    id: "teams",
    storageKey: "teams",
    schema: teamSchema,
    getKey: (item) => item.id,
  }),
);

export const teamPlayersCollection = createCollection(
  localStorageCollectionOptions({
    id: "team-players",
    storageKey: "team-players",
    schema: teamPlayerSchema,
    getKey: (item) => item.id,
  }),
);

export const gamesCollection = createCollection(
  localStorageCollectionOptions({
    id: "games",
    storageKey: "games",
    schema: gameSchema,
    getKey: (item) => item.id,
  }),
);

export const activeGameCollection = createCollection(
  localStorageCollectionOptions({
    id: "active-game",
    storageKey: "active-game",
    schema: activeGameSchema,
    getKey: (item) => item.id,
  }),
);
