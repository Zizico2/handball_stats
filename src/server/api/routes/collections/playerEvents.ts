import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import type { MatchHalf } from "@/datamodel";
import { dbRowToPlayerEvent, playerEventToDbRow } from "@/db";
import * as schema from "@/db/schema";
import type { ApiEnv } from "@/server/api/types";
import { getDb } from "@/server/db";
import { getMatchClockSnapshot } from "@/server/matchClock";
import { idsSchema, playerEventsArraySchema } from "./shared";

interface GameStartingPhase {
  firstHalfStartedAtMs: number | null;
  halftimeStartedAtMs: number | null;
  secondHalfStartedAtMs: number | null;
}

function resolveStartingPlayerHalf(phase: GameStartingPhase): MatchHalf {
  const { firstHalfStartedAtMs, halftimeStartedAtMs, secondHalfStartedAtMs } =
    phase;

  const isPreMatch =
    firstHalfStartedAtMs === null &&
    halftimeStartedAtMs === null &&
    secondHalfStartedAtMs === null;

  if (isPreMatch) {
    return "firstHalf";
  }

  const isHalftimeBeforeSecondStart =
    firstHalfStartedAtMs !== null &&
    halftimeStartedAtMs !== null &&
    secondHalfStartedAtMs === null;

  if (isHalftimeBeforeSecondStart) {
    return "secondHalf";
  }

  throw new Error(
    "Cannot create startingPlayer event: invalid game phase timestamps",
  );
}

export const playerEventsRoutes = new Hono<ApiEnv>()
  .get("/", async (c) => {
    const { userId } = c.env;
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.playerEvents)
      .where(eq(schema.playerEvents.userId, userId));

    return c.json(rows.map(dbRowToPlayerEvent));
  })
  .post("/", zValidator("json", playerEventsArraySchema), async (c) => {
    const items = c.req.valid("json");
    const { userId } = c.env;
    const db = await getDb();

    const nowMs = Date.now();
    const uniqueGameIds = [...new Set(items.map((item) => item.game_id))];

    const gameStartPhaseRows = await db
      .select({
        localId: schema.games.localId,
        firstHalfStartedAtMs: schema.games.firstHalfStartedAtMs,
        halftimeStartedAtMs: schema.games.halftimeStartedAtMs,
        secondHalfStartedAtMs: schema.games.secondHalfStartedAtMs,
      })
      .from(schema.games)
      .where(
        and(
          eq(schema.games.userId, userId),
          inArray(schema.games.localId, uniqueGameIds),
        ),
      );

    const gameStartPhaseByGameId = new Map<number, GameStartingPhase>(
      gameStartPhaseRows.map((row) => [
        row.localId,
        {
          firstHalfStartedAtMs: row.firstHalfStartedAtMs,
          halftimeStartedAtMs: row.halftimeStartedAtMs,
          secondHalfStartedAtMs: row.secondHalfStartedAtMs,
        },
      ]),
    );

    // Get both elapsed seconds and active half for each game
    const elapsedAndHalfByGameId = new Map<
      number,
      { elapsed: number; half: MatchHalf | null }
    >();
    await Promise.all(
      uniqueGameIds.map(async (gameId) => {
        const { activeElapsedSeconds, activeHalf } =
          await getMatchClockSnapshot(userId, gameId, nowMs);
        elapsedAndHalfByGameId.set(gameId, {
          elapsed: activeElapsedSeconds,
          half: activeHalf,
        });
      }),
    );

    const rowsWithServerElapsed = items.map((item) => {
      if (item.eventType === "startingPlayer") {
        const phase = gameStartPhaseByGameId.get(item.game_id);

        if (!phase) {
          throw new Error(
            "Cannot create startingPlayer event: game does not exist",
          );
        }

        const resolvedHalf = resolveStartingPlayerHalf(phase);

        return playerEventToDbRow(
          {
            ...item,
            // Starting lineup is allowed before a half is active.
            ellapsed_seconds: 0,
            half: resolvedHalf,
          },
          userId,
        );
      }

      const { elapsed, half } = elapsedAndHalfByGameId.get(item.game_id) ?? {
        elapsed: 0,
        half: null,
      };

      if (!half) {
        throw new Error("Cannot create player event: match half is not active");
      }

      return playerEventToDbRow(
        {
          ...item,
          ellapsed_seconds: elapsed,
          half,
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
    const { userId } = c.env;
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
