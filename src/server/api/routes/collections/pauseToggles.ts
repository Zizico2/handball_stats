import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { dbRowToPauseToggle, pauseToggleToDbRow } from "@/db";
import * as schema from "@/db/schema";
import { getDb } from "@/server/db";
import { idsSchema, pauseTogglesArraySchema, requireUserId } from "./shared";

export const pauseTogglesRoutes = new Hono()
  .get("/", async (c) => {
    const userId = await requireUserId();
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.pauseToggles)
      .where(eq(schema.pauseToggles.userId, userId));

    return c.json(rows.map(dbRowToPauseToggle));
  })
  .post("/", zValidator("json", pauseTogglesArraySchema), async (c) => {
    const items = c.req.valid("json");
    const userId = await requireUserId();
    const db = await getDb();
    const inserted = await db
      .insert(schema.pauseToggles)
      .values(items.map((item) => pauseToggleToDbRow(item, userId)))
      .returning();

    return c.json(inserted.map(dbRowToPauseToggle));
  })
  .delete("/", zValidator("json", idsSchema), async (c) => {
    const ids = c.req.valid("json");
    const userId = await requireUserId();
    const db = await getDb();

    if (ids.length === 0) {
      return c.body(null, 204);
    }

    await db
      .delete(schema.pauseToggles)
      .where(
        and(
          eq(schema.pauseToggles.userId, userId),
          inArray(schema.pauseToggles.localId, ids),
        ),
      );

    return c.body(null, 204);
  });
