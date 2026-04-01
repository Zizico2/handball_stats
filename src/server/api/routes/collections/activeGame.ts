import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { activeGameToDbRow, dbRowToActiveGame } from "@/db";
import * as schema from "@/db/schema";
import { getDb } from "@/server/db";
import { activeGameArraySchema, idsSchema, requireUserId } from "./shared";

export const activeGameRoutes = new Hono()
  .get("/", async (c) => {
    const userId = await requireUserId();
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.activeGame)
      .where(eq(schema.activeGame.userId, userId));

    return c.json(rows.map(dbRowToActiveGame));
  })
  .put("/", zValidator("json", activeGameArraySchema), async (c) => {
    const items = c.req.valid("json");
    const userId = await requireUserId();
    const db = await getDb();

    if (items.length === 0) {
      return c.json([]);
    }

    const rows = items.map((item) => activeGameToDbRow(item, userId));
    const inserted = await db
      .insert(schema.activeGame)
      .values(rows)
      .onConflictDoUpdate({
        target: [schema.activeGame.userId, schema.activeGame.localId],
        set: {
          gameLocalId: sql`excluded.game_local_id`,
          homeTeamLocalId: sql`excluded.home_team_local_id`,
        },
      })
      .returning();

    return c.json(inserted.map(dbRowToActiveGame));
  })
  .delete("/", zValidator("json", idsSchema), async (c) => {
    const ids = c.req.valid("json");
    const userId = await requireUserId();
    const db = await getDb();

    if (ids.length === 0) {
      return c.body(null, 204);
    }

    await db
      .delete(schema.activeGame)
      .where(
        and(
          eq(schema.activeGame.userId, userId),
          inArray(schema.activeGame.localId, ids),
        ),
      );

    return c.body(null, 204);
  });
