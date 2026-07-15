import { env } from "cloudflare:workers";
import { sql } from "drizzle-orm";
import { createDb } from "@/db";
import * as schema from "@/db/schema";

export function getTestDb() {
  return createDb(env.DB);
}

/** Deletes app rows in FK-safe order. Leaves `d1_migrations` intact. */
export async function resetAppTables() {
  const db = getTestDb();
  const allRows = sql`1 = 1`;
  await db.delete(schema.activeGame).where(allRows);
  await db.delete(schema.pauseToggles).where(allRows);
  await db.delete(schema.playerEvents).where(allRows);
  await db.delete(schema.games).where(allRows);
  await db.delete(schema.quickSubPairs).where(allRows);
  await db.delete(schema.teamPlayers).where(allRows);
  await db.delete(schema.teams).where(allRows);
}
