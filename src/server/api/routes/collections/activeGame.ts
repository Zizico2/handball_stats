import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { activeGameToDbRow, dbRowToActiveGame } from "@/db";
import * as schema from "@/db/schema";
import type { ApiEnv } from "@/server/api/types";
import { getDb } from "@/server/db";
import { activeGameArraySchema, idsSchema } from "./shared";

export const activeGameRoutes = new Hono<ApiEnv>()
  .get("/", async (c) => {
    const { userId } = c.env;
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
    const { userId } = c.env;
    const db = await getDb();

    if (items.length === 0) {
      return c.json([]);
    }

    const rows = items.map((item) => activeGameToDbRow(item, userId));
    const localIds = rows.map((row) => row.localId);

    // Replace rows instead of ON CONFLICT upsert: Drizzle's composite-target
    // upsert emits table-qualified conflict columns that fail on D1/SQLite.
    await db
      .delete(schema.activeGame)
      .where(
        and(
          eq(schema.activeGame.userId, userId),
          inArray(schema.activeGame.localId, localIds),
        ),
      );

    const inserted = await db
      .insert(schema.activeGame)
      .values(rows)
      .returning();

    return c.json(inserted.map(dbRowToActiveGame));
  })
  .delete("/", zValidator("json", idsSchema), async (c) => {
    const ids = c.req.valid("json");
    const { userId } = c.env;
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
