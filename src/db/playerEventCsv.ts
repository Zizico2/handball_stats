import type * as schema from "@/db/schema";

/**
 * Keep this list explicit so it can be shared by server and browser CSV
 * writers without pulling the D1/Drizzle runtime into the client bundle.
 */
export const PLAYER_EVENTS_CSV_COLUMN_KEYS = [
  "player",
  "ellapsedSeconds",
  "eventType",
  "eventGroup",
  "half",
  "shotGoal",
  "shotDirection",
  "shotAim",
  "shotPosition",
  "substitutionPlayerIn",
  "suspensionServedBy",
  "suspensionEndedSuspensionId",
] as const satisfies ReadonlyArray<
  keyof typeof schema.playerEvents.$inferSelect
>;
