import { eq } from "drizzle-orm";
import type { AppDb } from "@/db";
import * as schema from "@/db/schema";

export async function resetE2eUserData(db: AppDb, userId: string) {
  await db.batch([
    db.delete(schema.activeGame).where(eq(schema.activeGame.userId, userId)),
    db
      .delete(schema.pauseToggles)
      .where(eq(schema.pauseToggles.userId, userId)),
    db
      .delete(schema.playerEvents)
      .where(eq(schema.playerEvents.userId, userId)),
    db.delete(schema.games).where(eq(schema.games.userId, userId)),
    db
      .delete(schema.quickSubPairs)
      .where(eq(schema.quickSubPairs.userId, userId)),
    db.delete(schema.teamPlayers).where(eq(schema.teamPlayers.userId, userId)),
    db.delete(schema.teams).where(eq(schema.teams.userId, userId)),
  ]);
}
