import { zValidator } from "@hono/zod-validator";
import { eq, getColumns, sql } from "drizzle-orm";
import { Hono } from "hono";
import { dbRowToGame, gameToDbRow } from "@/db";
import * as schema from "@/db/schema";
import type { ApiEnv } from "@/server/api/types";
import { getDb } from "@/server/db";
import { gamesArraySchema } from "./shared";

export const gamesRoutes = new Hono<ApiEnv>()
  .get("/", async (c) => {
    const { userId } = c.env;
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.games)
      .where(eq(schema.games.userId, userId));

    return c.json(rows.map(dbRowToGame));
  })
  .post("/", zValidator("json", gamesArraySchema), async (c) => {
    const items = c.req.valid("json");
    const { userId } = c.env;
    const db = await getDb();
    const inserted = await db
      .insert(schema.games)
      .values(items.map((item) => gameToDbRow(item, userId)))
      .returning();

    return c.json(inserted.map(dbRowToGame));
  })
  .put("/", zValidator("json", gamesArraySchema), async (c) => {
    const items = c.req.valid("json");
    const { userId } = c.env;
    const db = await getDb();

    if (items.length === 0) {
      return c.json([]);
    }

    const gameColumns = getColumns(schema.games);
    const rows = items.map((item) => gameToDbRow(item, userId));
    const inserted = await db
      .insert(schema.games)
      .values(rows)
      .onConflictDoUpdate({
        target: [schema.games.userId, schema.games.localId],
        set: {
          homeTeamLocalId: sql.raw(
            `excluded.${gameColumns.homeTeamLocalId.name}`,
          ),
          createdAt: sql.raw(`excluded.${gameColumns.createdAt.name}`),
          firstHalfStartedAtMs: sql.raw(
            `excluded.${gameColumns.firstHalfStartedAtMs.name}`,
          ),
          halftimeStartedAtMs: sql.raw(
            `excluded.${gameColumns.halftimeStartedAtMs.name}`,
          ),
          secondHalfStartedAtMs: sql.raw(
            `excluded.${gameColumns.secondHalfStartedAtMs.name}`,
          ),
        },
      })
      .returning();

    return c.json(inserted.map(dbRowToGame));
  });
