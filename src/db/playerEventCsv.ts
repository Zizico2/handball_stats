import { dbPlayerEventSchema } from "@/db";
import type * as schema from "@/db/schema";

const playerEventSelectSchemaCsv = dbPlayerEventSchema.pick({
  player: true,
  ellapsedSeconds: true,
  eventType: true,
  eventGroup: true,
  half: true,
  shotGoal: true,
  shotDirection: true,
  shotAim: true,
  shotPosition: true,
  substitutionPlayerIn: true,
  suspensionServedBy: true,
  suspensionEndedSuspensionId: true,
});

export const PLAYER_EVENTS_CSV_COLUMN_KEYS = Object.keys(
  playerEventSelectSchemaCsv.shape,
) as Array<keyof typeof schema.playerEvents.$inferSelect>;
