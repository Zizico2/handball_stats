import { auth } from "@clerk/nextjs/server";
import { HTTPException } from "hono/http-exception";
import {
  activeGameSchema,
  gameSchema,
  pauseToggleSchema,
  playerEventSchema,
  teamPlayerSchema,
  teamSchema,
} from "@/datamodel";

export const idsSchema = teamSchema.shape.id.array();
export const playerEventsArraySchema = playerEventSchema.array();
export const teamsArraySchema = teamSchema.array();
export const teamPlayersArraySchema = teamPlayerSchema.array();
export const gamesArraySchema = gameSchema.array();
export const activeGameArraySchema = activeGameSchema.array();
export const pauseTogglesArraySchema = pauseToggleSchema.array();

export async function requireUserId() {
  const { userId } = await auth();

  if (!userId) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  return userId;
}
