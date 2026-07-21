import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { type AppDb, dbRowToTeam, teamToDbRow } from "@/db";
import * as schema from "@/db/schema";
import type { ApiEnv } from "@/server/api/types";
import { getDb } from "@/server/db";
import { idsSchema, teamsArraySchema } from "./shared";

const TEAM_HAS_GAMES = "TEAM_HAS_GAMES" as const;

async function findHistoricalTeamIds(
  db: AppDb,
  userId: string,
  teamIds: number[],
): Promise<number[]> {
  if (teamIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({ teamId: schema.games.homeTeamLocalId })
    .from(schema.games)
    .where(
      and(
        eq(schema.games.userId, userId),
        inArray(schema.games.homeTeamLocalId, teamIds),
      ),
    );

  return [...new Set(rows.map(({ teamId }) => teamId))].toSorted(
    (a, b) => a - b,
  );
}

export const teamsRoutes = new Hono<ApiEnv>()
  .get("/", async (c) => {
    const { userId } = c.env;
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.teams)
      .where(eq(schema.teams.userId, userId));

    return c.json(rows.map(dbRowToTeam));
  })
  .post("/", zValidator("json", teamsArraySchema), async (c) => {
    const items = c.req.valid("json");
    const { userId } = c.env;
    const db = await getDb();
    const inserted = await db
      .insert(schema.teams)
      .values(items.map((item) => teamToDbRow(item, userId)))
      .returning();

    return c.json(inserted.map(dbRowToTeam));
  })
  .delete("/", zValidator("json", idsSchema), async (c) => {
    const ids = c.req.valid("json");
    const { userId } = c.env;
    const db = await getDb();
    const requestedTeamIds = [...new Set(ids)].toSorted((a, b) => a - b);

    if (requestedTeamIds.length === 0) {
      return c.body(null, 204);
    }

    const historicalTeamIds = await findHistoricalTeamIds(
      db,
      userId,
      requestedTeamIds,
    );
    if (historicalTeamIds.length > 0) {
      return c.json({ code: TEAM_HAS_GAMES, teamIds: historicalTeamIds }, 409);
    }

    try {
      await db.batch([
        db
          .delete(schema.quickSubPairs)
          .where(
            and(
              eq(schema.quickSubPairs.userId, userId),
              inArray(schema.quickSubPairs.teamLocalId, requestedTeamIds),
            ),
          ),
        db
          .delete(schema.teamPlayers)
          .where(
            and(
              eq(schema.teamPlayers.userId, userId),
              inArray(schema.teamPlayers.teamLocalId, requestedTeamIds),
            ),
          ),
        db
          .delete(schema.teams)
          .where(
            and(
              eq(schema.teams.userId, userId),
              inArray(schema.teams.localId, requestedTeamIds),
            ),
          ),
      ]);
    } catch (error) {
      const racedHistoricalTeamIds = await findHistoricalTeamIds(
        db,
        userId,
        requestedTeamIds,
      );
      if (racedHistoricalTeamIds.length > 0) {
        return c.json(
          { code: TEAM_HAS_GAMES, teamIds: racedHistoricalTeamIds },
          409,
        );
      }

      throw error;
    }

    return c.body(null, 204);
  });
