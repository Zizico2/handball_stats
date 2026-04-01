import { zValidator } from "@hono/zod-validator";
import { and, eq, getColumns, inArray, sql } from "drizzle-orm";
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
  // TODO: I don't like that this endpoint is using raw SQL for the upsert.
  // TODO: Maybe this should be split into 2 endpoints, one for creating and one for updating?
  // TODO: I think the app itself shouldn't rely on upsert behavior, it should know whether it's creating or updating an active game and call the appropriate endpoint.
  .put("/", zValidator("json", activeGameArraySchema), async (c) => {
    const items = c.req.valid("json");
    const userId = await requireUserId();
    const db = await getDb();

    if (items.length === 0) {
      return c.json([]);
    }

    const activeGameColumns = getColumns(schema.activeGame);
    const upsertSet = {
      // In SQLite upserts, `excluded` is the row that was attempted to be inserted.
      // Build refs from schema metadata so db column names are not hardcoded.
      gameLocalId: sql.raw(`excluded.${activeGameColumns.gameLocalId.name}`),
      homeTeamLocalId: sql.raw(
        `excluded.${activeGameColumns.homeTeamLocalId.name}`,
      ),
    };

    const rows = items.map((item) => activeGameToDbRow(item, userId));
    const inserted = await db
      .insert(schema.activeGame)
      .values(rows)
      .onConflictDoUpdate({
        target: [schema.activeGame.userId, schema.activeGame.localId],
        set: upsertSet,
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
