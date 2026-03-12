import {
  createCollection,
  localStorageCollectionOptions,
} from "@tanstack/react-db";
import { playerEventSchema, teamPlayerSchema, teamSchema } from "@/datamodel";

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
