import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { dbRowToQuickSubPair, quickSubPairToDbRow } from "@/db";
import * as schema from "@/db/schema";
import type { ApiEnv } from "@/server/api/types";
import { getDb } from "@/server/db";
import { getTeamsByClientId } from "@/server/dbClientIds";
import { idsSchema, quickSubPairsArraySchema } from "./shared";

export const quickSubPairsRoutes = new Hono<ApiEnv>()
  .get("/", async (c) => {
    const { userId } = c.env;
    const db = await getDb();
    const rows = await db
      .select({
        pair: schema.quickSubPairs,
        teamClientId: schema.teams.clientId,
      })
      .from(schema.quickSubPairs)
      .innerJoin(
        schema.teams,
        and(
          eq(schema.teams.userId, schema.quickSubPairs.userId),
          eq(schema.teams.id, schema.quickSubPairs.teamId),
        ),
      )
      .where(eq(schema.quickSubPairs.userId, userId));

    return c.json(
      rows.map(({ pair, teamClientId }) =>
        dbRowToQuickSubPair(pair, teamClientId),
      ),
    );
  })
  .post("/", zValidator("json", quickSubPairsArraySchema), async (c) => {
    const items = c.req.valid("json");
    const { userId } = c.env;
    const db = await getDb();
    const teamsByClientId = await getTeamsByClientId(
      db,
      userId,
      items.map((item) => item.teamId),
    );

    if (items.some((item) => !teamsByClientId.has(item.teamId))) {
      throw new HTTPException(400, {
        message: "Quick-sub pairs must reference an existing team",
      });
    }

    const internalTeamIds = [...teamsByClientId.values()].map(
      (team) => team.id,
    );
    const rosterRows =
      internalTeamIds.length === 0
        ? []
        : await db
            .select({
              teamId: schema.teamPlayers.teamId,
              number: schema.teamPlayers.number,
            })
            .from(schema.teamPlayers)
            .where(
              and(
                eq(schema.teamPlayers.userId, userId),
                inArray(schema.teamPlayers.teamId, internalTeamIds),
              ),
            );
    const roster = new Set(
      rosterRows.map((row) => `${row.teamId}:${row.number}`),
    );
    const valid = items.every((item) => {
      const teamId = teamsByClientId.get(item.teamId)?.id;
      if (teamId === undefined) return false;
      return (
        roster.has(`${teamId}:${item.playerNumberA}`) &&
        roster.has(`${teamId}:${item.playerNumberB}`)
      );
    });

    if (!valid) {
      throw new HTTPException(400, {
        message: "Quick-sub pairs must reference players rostered on the team",
      });
    }

    const inserted = await db
      .insert(schema.quickSubPairs)
      .values(
        items.map((item) => {
          const team = teamsByClientId.get(item.teamId);
          if (!team) throw new Error("Validated team was not resolved");
          return quickSubPairToDbRow(item, userId, team.id);
        }),
      )
      .returning();
    const itemsByClientId = new Map(items.map((item) => [item.id, item]));

    return c.json(
      inserted.map((row) => {
        const item = itemsByClientId.get(row.clientId);
        if (!item) throw new Error("Inserted pair was not in the request");
        return dbRowToQuickSubPair(row, item.teamId);
      }),
    );
  })
  .delete("/", zValidator("json", idsSchema), async (c) => {
    const ids = c.req.valid("json");
    const { userId } = c.env;
    const db = await getDb();

    if (ids.length === 0) return c.body(null, 204);

    await db
      .delete(schema.quickSubPairs)
      .where(
        and(
          eq(schema.quickSubPairs.userId, userId),
          inArray(schema.quickSubPairs.clientId, ids),
        ),
      );

    return c.body(null, 204);
  });
