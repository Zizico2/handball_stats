import { zValidator } from "@hono/zod-validator";
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { dbRowToPauseToggle, pauseToggleToDbRow } from "@/db";
import * as schema from "@/db/schema";
import { getDb } from "@/server/db";
import { requireUserId, upsertPauseToggleBodySchema } from "./shared";

const pauseToggleResourceIdSchema = z.object({
  pauseToggleId: z.string().min(1),
});

function decodePauseToggleResourceId(resourceId: string) {
  const decoded = decodeURIComponent(resourceId);
  const [gameIdRaw, toggledAtMsRaw] = decoded.split(":");
  const gameId = Number(gameIdRaw);
  const toggledAtMs = Number(toggledAtMsRaw);

  if (!Number.isInteger(gameId) || !Number.isInteger(toggledAtMs)) {
    throw new Error(`Invalid pause toggle resource id: ${resourceId}`);
  }

  return { gameId, toggledAtMs };
}

export const pauseTogglesRoutes = new Hono()
  .get("/", async (c) => {
    const userId = await requireUserId();
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
      const { half } = c.req.valid("json");
      const userId = await requireUserId();
      const db = await getDb();
      const { gameId, toggledAtMs } =
        decodePauseToggleResourceId(pauseToggleId);

      const inserted = await db
        .insert(schema.pauseToggles)
        .values(
          pauseToggleToDbRow(
            {
              gameId,
              half,
              toggledAtMs,
            },
            userId,
          ),
        )
        .onConflictDoNothing({
          target: [
            schema.pauseToggles.userId,
            schema.pauseToggles.gameLocalId,
            schema.pauseToggles.toggledAtMs,
          ],
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
            eq(schema.pauseToggles.gameLocalId, gameId),
            eq(schema.pauseToggles.toggledAtMs, toggledAtMs),
          ),
        )
        .get();

      return c.json(
        existing
          ? dbRowToPauseToggle(existing)
          : {
              gameId,
              half,
              toggledAtMs,
            },
      );
    },
  )
  .delete(
    "/:pauseToggleId",
    zValidator("param", pauseToggleResourceIdSchema),
    async (c) => {
      const { pauseToggleId } = c.req.valid("param");
      const userId = await requireUserId();
      const db = await getDb();
      const { gameId, toggledAtMs } =
        decodePauseToggleResourceId(pauseToggleId);

      await db
        .delete(schema.pauseToggles)
        .where(
          and(
            eq(schema.pauseToggles.userId, userId),
            eq(schema.pauseToggles.gameLocalId, gameId),
            eq(schema.pauseToggles.toggledAtMs, toggledAtMs),
          ),
        );

      return c.body(null, 204);
    },
  );
