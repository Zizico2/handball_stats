import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { dbRowToGame, gameToDbRow } from "@/db";
import * as schema from "@/db/schema";
import { getDb } from "@/server/db";
import { gamesArraySchema, requireUserId } from "./shared";

export const gamesRoutes = new Hono()
  .get("/", async (c) => {
    const userId = await requireUserId();
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.games)
      .where(eq(schema.games.userId, userId));

    return c.json(rows.map(dbRowToGame));
  })
  .post("/", zValidator("json", gamesArraySchema), async (c) => {
    const items = c.req.valid("json");
    const userId = await requireUserId();
    const db = await getDb();
    const inserted = await db
      .insert(schema.games)
      .values(items.map((item) => gameToDbRow(item, userId)))
      .returning();

    return c.json(inserted.map(dbRowToGame));
  });
