import { zValidator } from "@hono/zod-validator";
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { clientIdSchema } from "@/datamodel";
import { dbRowToPauseToggle, pauseToggleToDbRow } from "@/db";
import * as schema from "@/db/schema";
import type { ApiEnv } from "@/server/api/types";
import { getDb } from "@/server/db";
import { getGamesByClientId } from "@/server/dbClientIds";
import { upsertPauseToggleBodySchema } from "./shared";

const pauseToggleResourceIdSchema = z.object({ pauseToggleId: clientIdSchema });

export const pauseTogglesRoutes = new Hono<ApiEnv>()
  .get("/", async (c) => {
    const { userId } = c.env;
    const db = await getDb();
    const rows = await db
      .select({
        toggle: schema.pauseToggles,
        gameClientId: schema.games.clientId,
      })
      .from(schema.pauseToggles)
      .innerJoin(
        schema.games,
        and(
          eq(schema.games.userId, schema.pauseToggles.userId),
          eq(schema.games.id, schema.pauseToggles.gameId),
        ),
      )
      .where(eq(schema.pauseToggles.userId, userId))
      .orderBy(asc(schema.pauseToggles.toggledAtMs));

    return c.json(
      rows.map(({ toggle, gameClientId }) =>
        dbRowToPauseToggle(toggle, gameClientId),
      ),
    );
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
      const game = (await getGamesByClientId(db, userId, [gameId])).get(gameId);
      if (!game) {
        throw new HTTPException(404, { message: `Game ${gameId} not found` });
      }

      const inserted = await db
        .insert(schema.pauseToggles)
        .values(
          pauseToggleToDbRow(
            { id: pauseToggleId, gameId, half, toggledAtMs: Date.now() },
            userId,
            game.id,
          ),
        )
        .onConflictDoNothing({
          target: [schema.pauseToggles.userId, schema.pauseToggles.clientId],
        })
        .returning();

      if (inserted.length > 0) {
        return c.json(dbRowToPauseToggle(inserted[0], gameId));
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
      if (existing && existing.gameId === game.id && existing.half === half) {
        return c.json(dbRowToPauseToggle(existing, gameId));
      }

      throw new HTTPException(409, {
        message: "Pause toggle clientId conflicts with an existing record",
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
