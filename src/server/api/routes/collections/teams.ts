import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import type { ClientId } from "@/datamodel";
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
  if (teamIds.length === 0) return [];

  const rows = await db
    .select({ teamId: schema.games.homeTeamId })
    .from(schema.games)
    .where(
      and(
        eq(schema.games.userId, userId),
        inArray(schema.games.homeTeamId, teamIds),
      ),
    );

  return [...new Set(rows.map(({ teamId }) => teamId))].toSorted(
    (a, b) => a - b,
  );
}

function clientIdsForInternalIds(
  teams: Array<{ id: number; clientId: string }>,
  internalIds: number[],
): ClientId[] {
  return teams
    .filter((team) => internalIds.includes(team.id))
    .map((team) => team.clientId as ClientId);
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
    const requestedClientIds = [...new Set(c.req.valid("json"))];
    const { userId } = c.env;
    const db = await getDb();

    if (requestedClientIds.length === 0) return c.body(null, 204);

    const requestedTeams = await db
      .select({ id: schema.teams.id, clientId: schema.teams.clientId })
      .from(schema.teams)
      .where(
        and(
          eq(schema.teams.userId, userId),
          inArray(schema.teams.clientId, requestedClientIds),
        ),
      );
    const requestedTeamIds = requestedTeams.map(({ id }) => id);
    const historicalTeamIds = await findHistoricalTeamIds(
      db,
      userId,
      requestedTeamIds,
    );

    if (historicalTeamIds.length > 0) {
      return c.json(
        {
          code: TEAM_HAS_GAMES,
          teamIds: clientIdsForInternalIds(requestedTeams, historicalTeamIds),
        },
        409,
      );
    }

    try {
      await db.batch([
        db
          .delete(schema.quickSubPairs)
          .where(
            and(
              eq(schema.quickSubPairs.userId, userId),
              inArray(schema.quickSubPairs.teamId, requestedTeamIds),
            ),
          ),
        db
          .delete(schema.teamPlayers)
          .where(
            and(
              eq(schema.teamPlayers.userId, userId),
              inArray(schema.teamPlayers.teamId, requestedTeamIds),
            ),
          ),
        db
          .delete(schema.teams)
          .where(
            and(
              eq(schema.teams.userId, userId),
              inArray(schema.teams.clientId, requestedClientIds),
            ),
          ),
      ]);
    } catch (error) {
      const racedHistoricalIds = await findHistoricalTeamIds(
        db,
        userId,
        requestedTeamIds,
      );
      if (racedHistoricalIds.length > 0) {
        return c.json(
          {
            code: TEAM_HAS_GAMES,
            teamIds: clientIdsForInternalIds(
              requestedTeams,
              racedHistoricalIds,
            ),
          },
          409,
        );
      }
      throw error;
    }

    return c.body(null, 204);
  });
