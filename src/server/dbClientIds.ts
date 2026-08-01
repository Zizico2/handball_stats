import { and, eq, inArray } from "drizzle-orm";
import type { ClientId } from "@/datamodel";
import type { AppDb, DbGame, DbTeam } from "@/db";
import * as schema from "@/db/schema";

export async function getTeamsByClientId(
  db: AppDb,
  userId: string,
  clientIds: ClientId[],
): Promise<Map<ClientId, DbTeam>> {
  const uniqueIds = [...new Set(clientIds)];
  if (uniqueIds.length === 0) return new Map();

  const rows = await db
    .select()
    .from(schema.teams)
    .where(
      and(
        eq(schema.teams.userId, userId),
        inArray(schema.teams.clientId, uniqueIds),
      ),
    );

  return new Map(rows.map((row) => [row.clientId, row]));
}

export async function getGamesByClientId(
  db: AppDb,
  userId: string,
  clientIds: ClientId[],
): Promise<Map<ClientId, DbGame>> {
  const uniqueIds = [...new Set(clientIds)];
  if (uniqueIds.length === 0) return new Map();

  const rows = await db
    .select()
    .from(schema.games)
    .where(
      and(
        eq(schema.games.userId, userId),
        inArray(schema.games.clientId, uniqueIds),
      ),
    );

  return new Map(rows.map((row) => [row.clientId, row]));
}
