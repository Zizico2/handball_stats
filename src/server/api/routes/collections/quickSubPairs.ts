import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { dbRowToQuickSubPair, quickSubPairToDbRow } from "@/db";
import * as schema from "@/db/schema";
import type { ApiEnv } from "@/server/api/types";
import { getDb } from "@/server/db";
import { idsSchema, quickSubPairsArraySchema } from "./shared";

export const quickSubPairsRoutes = new Hono<ApiEnv>()
  .get("/", async (c) => {
    const { userId } = c.env;
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.quickSubPairs)
      .where(eq(schema.quickSubPairs.userId, userId));

    return c.json(rows.map(dbRowToQuickSubPair));
  })
  .post("/", zValidator("json", quickSubPairsArraySchema), async (c) => {
    const items = c.req.valid("json");
    const { userId } = c.env;
    const db = await getDb();
    const inserted = await db
      .insert(schema.quickSubPairs)
      .values(items.map((item) => quickSubPairToDbRow(item, userId)))
      .returning();

    return c.json(inserted.map(dbRowToQuickSubPair));
  })
  .delete("/", zValidator("json", idsSchema), async (c) => {
    const ids = c.req.valid("json");
    const { userId } = c.env;
    const db = await getDb();

    if (ids.length === 0) {
      return c.body(null, 204);
    }

    await db
      .delete(schema.quickSubPairs)
      .where(
        and(
          eq(schema.quickSubPairs.userId, userId),
          inArray(schema.quickSubPairs.localId, ids),
        ),
      );

    return c.body(null, 204);
  });
