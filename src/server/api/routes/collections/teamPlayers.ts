import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray, or } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { dbRowToTeamPlayer, teamPlayerToDbRow } from "@/db";
import * as schema from "@/db/schema";
import type { ApiEnv } from "@/server/api/types";
import { getDb } from "@/server/db";
import { getTeamsByClientId } from "@/server/dbClientIds";
import { idsSchema, teamPlayersArraySchema } from "./shared";

export const teamPlayersRoutes = new Hono<ApiEnv>()
  .get("/", async (c) => {
    const { userId } = c.env;
    const db = await getDb();
    const rows = await db
      .select({
        player: schema.teamPlayers,
        teamClientId: schema.teams.clientId,
      })
      .from(schema.teamPlayers)
      .innerJoin(
        schema.teams,
        and(
          eq(schema.teams.userId, schema.teamPlayers.userId),
          eq(schema.teams.id, schema.teamPlayers.teamId),
        ),
      )
      .where(eq(schema.teamPlayers.userId, userId));

    return c.json(
      rows.map(({ player, teamClientId }) =>
        dbRowToTeamPlayer(player, teamClientId),
      ),
    );
  })
  .post("/", zValidator("json", teamPlayersArraySchema), async (c) => {
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
        message: "Team players must reference an existing team",
      });
    }

    const inserted = await db
      .insert(schema.teamPlayers)
      .values(
        items.map((item) => {
          const team = teamsByClientId.get(item.teamId);
          if (!team) throw new Error("Validated team was not resolved");
          return teamPlayerToDbRow(item, userId, team.id);
        }),
      )
      .returning();
    const itemsByClientId = new Map(items.map((item) => [item.id, item]));

    return c.json(
      inserted.map((row) => {
        const item = itemsByClientId.get(row.clientId);
        if (!item) throw new Error("Inserted player was not in the request");
        return dbRowToTeamPlayer(row, item.teamId);
      }),
    );
  })
  .delete("/", zValidator("json", idsSchema), async (c) => {
    const ids = c.req.valid("json");
    const { userId } = c.env;
    const db = await getDb();

    if (ids.length === 0) return c.body(null, 204);

    const targetedPlayers = await db
      .select({
        teamId: schema.teamPlayers.teamId,
        number: schema.teamPlayers.number,
      })
      .from(schema.teamPlayers)
      .where(
        and(
          eq(schema.teamPlayers.userId, userId),
          inArray(schema.teamPlayers.clientId, ids),
        ),
      );

    if (targetedPlayers.length === 0) return c.body(null, 204);

    const pairReferences = targetedPlayers.map((player) =>
      and(
        eq(schema.quickSubPairs.teamId, player.teamId),
        or(
          eq(schema.quickSubPairs.playerNumberA, player.number),
          eq(schema.quickSubPairs.playerNumberB, player.number),
        ),
      ),
    );

    await db.batch([
      db
        .delete(schema.quickSubPairs)
        .where(
          and(eq(schema.quickSubPairs.userId, userId), or(...pairReferences)),
        ),
      db
        .delete(schema.teamPlayers)
        .where(
          and(
            eq(schema.teamPlayers.userId, userId),
            inArray(schema.teamPlayers.clientId, ids),
          ),
        ),
    ]);

    return c.body(null, 204);
  });
