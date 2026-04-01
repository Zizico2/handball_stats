import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { dbRowToTeamPlayer, teamPlayerToDbRow } from "@/db";
import * as schema from "@/db/schema";
import { getDb } from "@/server/db";
import { idsSchema, requireUserId, teamPlayersArraySchema } from "./shared";

export const teamPlayersRoutes = new Hono()
  .get("/", async (c) => {
    const userId = await requireUserId();
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.teamPlayers)
      .where(eq(schema.teamPlayers.userId, userId));

    return c.json(rows.map(dbRowToTeamPlayer));
  })
  .post("/", zValidator("json", teamPlayersArraySchema), async (c) => {
    const items = c.req.valid("json");
    const userId = await requireUserId();
    const db = await getDb();
    const inserted = await db
      .insert(schema.teamPlayers)
      .values(items.map((item) => teamPlayerToDbRow(item, userId)))
      .returning();

    return c.json(inserted.map(dbRowToTeamPlayer));
  })
  .delete("/", zValidator("json", idsSchema), async (c) => {
    const ids = c.req.valid("json");
    const userId = await requireUserId();
    const db = await getDb();

    if (ids.length === 0) {
      return c.body(null, 204);
    }

    await db
      .delete(schema.teamPlayers)
      .where(
        and(
          eq(schema.teamPlayers.userId, userId),
          inArray(schema.teamPlayers.localId, ids),
        ),
      );

    return c.body(null, 204);
  });
