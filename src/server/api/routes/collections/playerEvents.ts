import { zValidator } from "@hono/zod-validator";
import { and, asc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import type { MatchHalf } from "@/datamodel";
import { dbRowToPlayerEvent, playerEventToDbRow } from "@/db";
import * as schema from "@/db/schema";
import { getDb } from "@/server/db";
import { idsSchema, playerEventsArraySchema, requireUserId } from "./shared";

function calculateElapsedMs(
  startAtMs: number,
  toggleTimes: number[],
  nowMs: number,
) {
  let completedPausedMs = 0;

  for (let index = 0; index + 1 < toggleTimes.length; index += 2) {
    completedPausedMs += toggleTimes[index + 1] - toggleTimes[index];
  }

  const effectiveNowMs =
    toggleTimes.length % 2 === 1 ? toggleTimes[toggleTimes.length - 1] : nowMs;

  return Math.max(0, effectiveNowMs - startAtMs - completedPausedMs);
}

async function computeElapsedSeconds(
  userId: string,
  gameLocalId: number,
  nowMs: number,
) {
  const db = await getDb();
  const gameRow = await db
    .select()
    .from(schema.games)
    .where(
      and(
        eq(schema.games.userId, userId),
        eq(schema.games.localId, gameLocalId),
      ),
    )
    .get();

  if (!gameRow || gameRow.firstHalfStartedAtMs === null) {
    return 0;
  }

  const half: MatchHalf =
    gameRow.secondHalfStartedAtMs !== null &&
    nowMs >= gameRow.secondHalfStartedAtMs
      ? "secondHalf"
      : "firstHalf";
  const halfStartAtMs =
    half === "secondHalf"
      ? gameRow.secondHalfStartedAtMs
      : gameRow.firstHalfStartedAtMs;

  if (halfStartAtMs === null) {
    return 0;
  }

  const toggles = await db
    .select({ toggledAtMs: schema.pauseToggles.toggledAtMs })
    .from(schema.pauseToggles)
    .where(
      and(
        eq(schema.pauseToggles.userId, userId),
        eq(schema.pauseToggles.gameLocalId, gameLocalId),
        eq(schema.pauseToggles.half, half),
      ),
    )
    .orderBy(asc(schema.pauseToggles.toggledAtMs));

  const elapsedMs = calculateElapsedMs(
    halfStartAtMs,
    toggles.map((toggle) => toggle.toggledAtMs),
    nowMs,
  );

  return Math.floor(elapsedMs / 1000);
}

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
    const rowsWithServerElapsed = await Promise.all(
      items.map(async (item) => {
        const nowMs = Date.now();
        const ellapsedSeconds = await computeElapsedSeconds(
          userId,
          item.game_id,
          nowMs,
        );

        return playerEventToDbRow(
          {
            ...item,
            ellapsed_seconds: ellapsedSeconds,
          },
          userId,
        );
      }),
    );
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
