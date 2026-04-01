import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { dbRowToTeam, teamToDbRow } from "@/db";
import * as schema from "@/db/schema";
import { getDb } from "@/server/db";
import { idsSchema, requireUserId, teamsArraySchema } from "./shared";

export const teamsRoutes = new Hono()
  .get("/", async (c) => {
    const userId = await requireUserId();
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.teams)
      .where(eq(schema.teams.userId, userId));

    return c.json(rows.map(dbRowToTeam));
  })
  .post("/", zValidator("json", teamsArraySchema), async (c) => {
    const items = c.req.valid("json");
    const userId = await requireUserId();
    const db = await getDb();
    const inserted = await db
      .insert(schema.teams)
      .values(items.map((item) => teamToDbRow(item, userId)))
      .returning();

    return c.json(inserted.map(dbRowToTeam));
  })
  .delete("/", zValidator("json", idsSchema), async (c) => {
    const ids = c.req.valid("json");
    const userId = await requireUserId();
    const db = await getDb();

    if (ids.length === 0) {
      return c.body(null, 204);
    }

    await db
      .delete(schema.teams)
      .where(
        and(
          eq(schema.teams.userId, userId),
          inArray(schema.teams.localId, ids),
        ),
      );

    return c.body(null, 204);
  });
