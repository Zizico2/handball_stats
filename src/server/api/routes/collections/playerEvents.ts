import { zValidator } from "@hono/zod-validator";
import { and, asc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { type ClientId, clientIdSchema, type MatchHalf } from "@/datamodel";
import { dbRowToPlayerEvent, playerEventToDbRow } from "@/db";
import * as schema from "@/db/schema";
import type { ApiEnv } from "@/server/api/types";
import { getDb } from "@/server/db";
import { getGamesByClientId } from "@/server/dbClientIds";
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
  if (
    firstHalfStartedAtMs === null &&
    halftimeStartedAtMs === null &&
    secondHalfStartedAtMs === null
  ) {
    return "firstHalf";
  }
  if (
    firstHalfStartedAtMs !== null &&
    halftimeStartedAtMs !== null &&
    secondHalfStartedAtMs === null
  ) {
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
      .select({
        event: schema.playerEvents,
        gameClientId: schema.games.clientId,
      })
      .from(schema.playerEvents)
      .innerJoin(
        schema.games,
        and(
          eq(schema.games.userId, schema.playerEvents.userId),
          eq(schema.games.id, schema.playerEvents.gameId),
        ),
      )
      .where(eq(schema.playerEvents.userId, userId))
      .orderBy(asc(schema.playerEvents.id));

    return c.json(
      rows.map(({ event, gameClientId }) =>
        dbRowToPlayerEvent(event, gameClientId),
      ),
    );
  })
  .post("/", zValidator("json", playerEventsArraySchema), async (c) => {
    const items = c.req.valid("json");
    const { userId } = c.env;
    const db = await getDb();
    const gameClientIds = [...new Set(items.map((item) => item.game_id))];
    const gamesByClientId = await getGamesByClientId(db, userId, gameClientIds);
    if (gameClientIds.some((id) => !gamesByClientId.has(id))) {
      throw new HTTPException(400, {
        message: "Player events must reference an existing game",
      });
    }

    const nowMs = Date.now();
    const elapsedAndHalfByGameId = new Map<
      ClientId,
      { elapsed: number; half: MatchHalf | null }
    >();
    await Promise.all(
      gameClientIds.map(async (gameId) => {
        const { activeElapsedSeconds, activeHalf } =
          await getMatchClockSnapshot(userId, gameId, nowMs);
        elapsedAndHalfByGameId.set(gameId, {
          elapsed: activeElapsedSeconds,
          half: activeHalf,
        });
      }),
    );

    const rows = items.map((item) => {
      const game = gamesByClientId.get(item.game_id);
      if (!game) {
        throw new HTTPException(400, {
          message: "Player events must reference an existing game",
        });
      }
      if (item.eventType === "startingPlayer") {
        return playerEventToDbRow(
          {
            ...item,
            ellapsed_seconds: 0,
            half: resolveStartingPlayerHalf(game),
          },
          userId,
          game.id,
        );
      }

      const { elapsed, half } = elapsedAndHalfByGameId.get(item.game_id) ?? {
        elapsed: 0,
        half: null,
      };
      if (!half) {
        throw new HTTPException(400, {
          message: "Cannot create player event: match half is not active",
        });
      }
      return playerEventToDbRow(
        { ...item, ellapsed_seconds: elapsed, half },
        userId,
        game.id,
      );
    });

    const inserted = await db
      .insert(schema.playerEvents)
      .values(rows)
      .returning();
    const itemsByClientId = new Map(items.map((item) => [item.id, item]));
    return c.json(
      inserted.map((row) => {
        const item = itemsByClientId.get(clientIdSchema.parse(row.clientId));
        if (!item) throw new Error("Inserted event was not in the request");
        return dbRowToPlayerEvent(row, item.game_id);
      }),
    );
  })
  .delete("/", zValidator("json", idsSchema), async (c) => {
    const ids = c.req.valid("json");
    const { userId } = c.env;
    const db = await getDb();
    if (ids.length === 0) return c.body(null, 204);

    await db
      .delete(schema.playerEvents)
      .where(
        and(
          eq(schema.playerEvents.userId, userId),
          inArray(schema.playerEvents.clientId, ids),
        ),
      );
    return c.body(null, 204);
  });
