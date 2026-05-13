import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { dbRowToPlayerEvent, playerEventToDbRow } from "@/db";
import * as schema from "@/db/schema";
import { getDb } from "@/server/db";
import { getMatchClockSnapshot } from "@/server/matchClock";
import { idsSchema, playerEventsArraySchema, requireUserId } from "./shared";

export const playerEventsRoutes = new Hono()
  .get("/", async (c) => {
    const userId = await requireUserId();
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.playerEvents)
      .where(eq(schema.playerEvents.userId, userId));

    return c.json(rows.map(dbRowToPlayerEvent));
  })
  .post("/", zValidator("json", playerEventsArraySchema), async (c) => {
    const items = c.req.valid("json");
    const userId = await requireUserId();
    const db = await getDb();
    const gameIds = [...new Set(items.map((item) => item.game_id))];
    const snapshotsByGameId = new Map(
      await Promise.all(
        gameIds.map(async (gameId) => {
          const snapshot = await getMatchClockSnapshot(userId, gameId);
          return [gameId, snapshot.activeElapsedSeconds] as const;
        }),
      ),
    );
    const rowsWithServerElapsed = items.map((item) => {
      const ellapsedSeconds = snapshotsByGameId.get(item.game_id);

      return playerEventToDbRow(
        {
          ...item,
          ellapsed_seconds: ellapsedSeconds,
        },
        userId,
      );
    });
    const inserted = await db
      .insert(schema.playerEvents)
      .values(rowsWithServerElapsed)
      .returning();

    return c.json(inserted.map(dbRowToPlayerEvent));
  })
  .delete("/", zValidator("json", idsSchema), async (c) => {
    const ids = c.req.valid("json");
    const userId = await requireUserId();
    const db = await getDb();

    if (ids.length === 0) {
      return c.body(null, 204);
    }

    await db
      .delete(schema.playerEvents)
      .where(
        and(
          eq(schema.playerEvents.userId, userId),
          inArray(schema.playerEvents.localId, ids),
        ),
      );

    return c.body(null, 204);
  });
