import { zValidator } from "@hono/zod-validator";
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { dbRowToPauseToggle, pauseToggleToDbRow } from "@/db";
import * as schema from "@/db/schema";
import type { ApiEnv } from "@/server/api/types";
import { getDb } from "@/server/db";
import { upsertPauseToggleBodySchema } from "./shared";

const pauseToggleResourceIdSchema = z.object({
  pauseToggleId: z.uuid(),
});

export const pauseTogglesRoutes = new Hono<ApiEnv>()
  .get("/", async (c) => {
    const { userId } = c.env;
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.pauseToggles)
      .where(eq(schema.pauseToggles.userId, userId))
      .orderBy(asc(schema.pauseToggles.toggledAtMs));

    return c.json(rows.map(dbRowToPauseToggle));
  })
  .put(
    "/:pauseToggleId",
    zValidator("param", pauseToggleResourceIdSchema),
    zValidator("json", upsertPauseToggleBodySchema),
    async (c) => {
      const { pauseToggleId } = c.req.valid("param");
      const { gameId, half } = c.req.valid("json");
      const { userId } = c.env;
      const db = await getDb();
      const toggledAtMs = Date.now();

      const inserted = await db
        .insert(schema.pauseToggles)
        .values(
          pauseToggleToDbRow(
            { id: pauseToggleId, gameId, half, toggledAtMs },
            userId,
          ),
        )
        .onConflictDoNothing({
          target: [schema.pauseToggles.userId, schema.pauseToggles.clientId],
        })
        .returning();

      if (inserted.length > 0) {
        return c.json(dbRowToPauseToggle(inserted[0]));
      }

      const existing = await db
        .select()
        .from(schema.pauseToggles)
        .where(
          and(
            eq(schema.pauseToggles.userId, userId),
            eq(schema.pauseToggles.clientId, pauseToggleId),
          ),
        )
        .get();

      if (existing) {
        return c.json(dbRowToPauseToggle(existing));
      }

      throw new HTTPException(409, {
        message:
          "Pause toggle could not be created because the clientId conflicts with an existing record.",
      });
    },
  )
  .delete(
    "/:pauseToggleId",
    zValidator("param", pauseToggleResourceIdSchema),
    async (c) => {
      const { pauseToggleId } = c.req.valid("param");
      const { userId } = c.env;
      const db = await getDb();

      await db
        .delete(schema.pauseToggles)
        .where(
          and(
            eq(schema.pauseToggles.userId, userId),
            eq(schema.pauseToggles.clientId, pauseToggleId),
          ),
        );

      return c.body(null, 204);
    },
  );
