import { zValidator } from "@hono/zod-validator";
import { and, asc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ClientId, MatchHalf } from "@/datamodel";
import {
  type DbPlayerEvent,
  dbRowToPlayerEvent,
  playerEventToDbRow,
} from "@/db";
import * as schema from "@/db/schema";
import { parseClientId } from "@/lib/clientId";
import type { ApiEnv } from "@/server/api/types";
import { getDb } from "@/server/db";
import { getGamesByClientId } from "@/server/dbClientIds";
import { getMatchClockSnapshot } from "@/server/matchClock";
import { idsSchema, playerEventsArraySchema } from "./shared";

function sqliteErrorText(error: unknown): string {
  if (error == null) return "";
  if (typeof error === "string") return error;
  if (typeof error !== "object") return String(error);
  const code =
    "code" in error && typeof error.code === "string" ? error.code : "";
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  const cause = "cause" in error ? sqliteErrorText(error.cause) : "";
  return `${code} ${message} ${cause}`;
}

function isUniqueConstraintError(error: unknown): boolean {
  return /SQLITE_CONSTRAINT_UNIQUE|CONSTRAINT_UNIQUE|unique constraint failed/i.test(
    sqliteErrorText(error),
  );
}

function isEndedSuspensionUniqueViolation(error: unknown): boolean {
  return /ended_suspension|suspension_ended_suspension_id/i.test(
    sqliteErrorText(error),
  );
}

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

    const endItems = items.filter(
      (item) => item.eventType === "twoMinuteSuspensionEnded",
    );
    const suspensionIds = [
      ...new Set(endItems.map((item) => item.event.suspensionId)),
    ];
    if (suspensionIds.length > 0) {
      const referencedRows = await db
        .select({
          clientId: schema.playerEvents.clientId,
          player: schema.playerEvents.player,
          gameId: schema.playerEvents.gameId,
          eventType: schema.playerEvents.eventType,
        })
        .from(schema.playerEvents)
        .where(
          and(
            eq(schema.playerEvents.userId, userId),
            inArray(schema.playerEvents.clientId, suspensionIds),
          ),
        );
      const referencedById = new Map(
        referencedRows.map((row) => [row.clientId, row]),
      );
      for (const item of items) {
        if (
          item.eventType !== "twoMinuteSuspension" ||
          referencedById.has(item.id)
        ) {
          continue;
        }
        const game = gamesByClientId.get(item.game_id);
        if (!game) continue;
        referencedById.set(item.id, {
          clientId: item.id,
          player: item.player,
          gameId: game.id,
          eventType: item.eventType,
        });
      }

      for (const item of endItems) {
        const referenced = referencedById.get(item.event.suspensionId);
        const game = gamesByClientId.get(item.game_id);
        if (
          !referenced ||
          !game ||
          referenced.eventType !== "twoMinuteSuspension" ||
          referenced.gameId !== game.id ||
          referenced.player !== item.player
        ) {
          throw new HTTPException(400, {
            message:
              "A suspension-ended event must reference an active suspension in the same game and player",
          });
        }
      }

      const alreadyEndedRows = await db
        .select({
          suspensionId: schema.playerEvents.suspensionEndedSuspensionId,
        })
        .from(schema.playerEvents)
        .where(
          and(
            eq(schema.playerEvents.userId, userId),
            inArray(
              schema.playerEvents.suspensionEndedSuspensionId,
              suspensionIds,
            ),
          ),
        );
      const alreadyEnded = new Set(
        alreadyEndedRows.flatMap((row) =>
          row.suspensionId === null ? [] : [row.suspensionId],
        ),
      );
      if (
        endItems.some((item) => alreadyEnded.has(item.event.suspensionId)) ||
        new Set(endItems.map((item) => item.event.suspensionId)).size !==
          endItems.length
      ) {
        throw new HTTPException(409, {
          message: "That suspension has already been ended",
        });
      }
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

    let inserted: DbPlayerEvent[];
    try {
      inserted = await db.insert(schema.playerEvents).values(rows).returning();
    } catch (error) {
      if (endItems.length > 0 && isUniqueConstraintError(error)) {
        const racedEndRows = await db
          .select({
            suspensionId: schema.playerEvents.suspensionEndedSuspensionId,
          })
          .from(schema.playerEvents)
          .where(
            and(
              eq(schema.playerEvents.userId, userId),
              inArray(
                schema.playerEvents.suspensionEndedSuspensionId,
                suspensionIds,
              ),
            ),
          );
        const racedEnds = new Set(
          racedEndRows.flatMap((row) =>
            row.suspensionId === null ? [] : [row.suspensionId],
          ),
        );
        if (
          isEndedSuspensionUniqueViolation(error) ||
          endItems.some((item) => racedEnds.has(item.event.suspensionId))
        ) {
          throw new HTTPException(409, {
            message: "That suspension has already been ended",
          });
        }
      }
      throw error;
    }
    const itemsByClientId = new Map(items.map((item) => [item.id, item]));
    return c.json(
      inserted.map((row) => {
        const item = itemsByClientId.get(parseClientId(row.clientId));
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

    const suspensionRows = await db
      .select({ clientId: schema.playerEvents.clientId })
      .from(schema.playerEvents)
      .where(
        and(
          eq(schema.playerEvents.userId, userId),
          inArray(schema.playerEvents.clientId, ids),
          eq(schema.playerEvents.eventType, "twoMinuteSuspension"),
        ),
      );
    const suspensionIds = suspensionRows.map((row) => row.clientId);
    const deleteRequestedEvents = db
      .delete(schema.playerEvents)
      .where(
        and(
          eq(schema.playerEvents.userId, userId),
          inArray(schema.playerEvents.clientId, ids),
        ),
      );
    if (suspensionIds.length > 0) {
      await db.batch([
        db
          .delete(schema.playerEvents)
          .where(
            and(
              eq(schema.playerEvents.userId, userId),
              inArray(
                schema.playerEvents.suspensionEndedSuspensionId,
                suspensionIds,
              ),
            ),
          ),
        deleteRequestedEvents,
      ]);
    } else {
      await deleteRequestedEvents;
    }
    return c.body(null, 204);
  });
