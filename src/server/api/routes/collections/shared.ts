import {
  activeGameSchema,
  gameSchema,
  pauseToggleSchema,
  playerEventSchema,
  quickSubPairSchema,
  teamPlayerSchema,
  teamSchema,
} from "@/datamodel";

export const idsSchema = teamSchema.shape.id.array();
export const activeGameIdsSchema = activeGameSchema.shape.id.array();
export const playerEventsArraySchema = playerEventSchema.array();
export const teamsArraySchema = teamSchema.array();
export const teamPlayersArraySchema = teamPlayerSchema.array();
export const quickSubPairsArraySchema = quickSubPairSchema.array();
export const gamesArraySchema = gameSchema.array();
export const activeGameArraySchema = activeGameSchema.array();
export const pauseTogglesArraySchema = pauseToggleSchema.array();
export const upsertPauseToggleBodySchema = pauseToggleSchema.omit({
  id: true,
  toggledAtMs: true,
});
