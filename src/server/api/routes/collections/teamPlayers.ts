import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray, or } from "drizzle-orm";
import { Hono } from "hono";
import { dbRowToTeamPlayer, teamPlayerToDbRow } from "@/db";
import * as schema from "@/db/schema";
import type { ApiEnv } from "@/server/api/types";
import { getDb } from "@/server/db";
import { idsSchema, teamPlayersArraySchema } from "./shared";

export const teamPlayersRoutes = new Hono<ApiEnv>()
  .get("/", async (c) => {
    const { userId } = c.env;
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.teamPlayers)
      .where(eq(schema.teamPlayers.userId, userId));

    return c.json(rows.map(dbRowToTeamPlayer));
  })
  .post("/", zValidator("json", teamPlayersArraySchema), async (c) => {
    const items = c.req.valid("json");
    const { userId } = c.env;
    const db = await getDb();
    const inserted = await db
      .insert(schema.teamPlayers)
      .values(items.map((item) => teamPlayerToDbRow(item, userId)))
      .returning();

    return c.json(inserted.map(dbRowToTeamPlayer));
  })
  .delete("/", zValidator("json", idsSchema), async (c) => {
    const ids = c.req.valid("json");
    const { userId } = c.env;
    const db = await getDb();

    if (ids.length === 0) {
      return c.body(null, 204);
    }

    const targetedPlayers = await db
      .select({
        teamLocalId: schema.teamPlayers.teamLocalId,
        number: schema.teamPlayers.number,
      })
      .from(schema.teamPlayers)
      .where(
        and(
          eq(schema.teamPlayers.userId, userId),
          inArray(schema.teamPlayers.localId, ids),
        ),
      );

    if (targetedPlayers.length === 0) {
      return c.body(null, 204);
    }

    const pairReferences = targetedPlayers.map((player) =>
      and(
        eq(schema.quickSubPairs.teamLocalId, player.teamLocalId),
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
            inArray(schema.teamPlayers.localId, ids),
          ),
        ),
    ]);

    return c.body(null, 204);
  });
