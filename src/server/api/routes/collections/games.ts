import { zValidator } from "@hono/zod-validator";
import { and, eq, getColumns, isNotNull, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { gamePauseStateBodySchema, startGameBodySchema } from "@/datamodel";
import { dbRowToGame, gameToDbRow } from "@/db";
import * as schema from "@/db/schema";
import type { ApiEnv } from "@/server/api/types";
import { getDb } from "@/server/db";
import {
  decidePhaseTransition,
  type GamePhaseTransition,
} from "@/server/gamePhaseTransitions";
import {
  GameNotFoundError,
  PauseStateConflictError,
  setGamePauseState,
} from "@/server/setGamePauseState";
import {
  StartGameConflictError,
  StartGameTeamNotFoundError,
  startGame,
} from "@/server/startGame";
import { gamesArraySchema } from "./shared";

const gameIdParamSchema = z.object({
  gameId: z.coerce.number().int().positive(),
});

const phaseTransitionBodySchema = z.object({
  to: z.enum(["firstHalf", "halftime", "secondHalf"]),
});

function gameDbRowWithoutPhaseTimestamps(
  item: z.infer<typeof gamesArraySchema>[number],
  userId: string,
) {
  return {
    ...gameToDbRow(item, userId),
    firstHalfStartedAtMs: null,
    halftimeStartedAtMs: null,
    secondHalfStartedAtMs: null,
  };
}

async function loadGameOrThrow(
  userId: string,
  gameId: number,
): Promise<typeof schema.games.$inferSelect> {
  const db = await getDb();
  const row = await db
    .select()
    .from(schema.games)
    .where(
      and(eq(schema.games.userId, userId), eq(schema.games.localId, gameId)),
    )
    .get();

  if (!row) {
    throw new HTTPException(404, { message: `Game ${gameId} not found` });
  }

  return row;
}

async function applyAtomicPhaseUpdate(
  userId: string,
  gameId: number,
  to: GamePhaseTransition,
  nowMs: number,
): Promise<typeof schema.games.$inferSelect | null> {
  const db = await getDb();
  const ownership = and(
    eq(schema.games.userId, userId),
    eq(schema.games.localId, gameId),
  );

  if (to === "firstHalf") {
    const updated = await db
      .update(schema.games)
      .set({ firstHalfStartedAtMs: nowMs })
      .where(
        and(
          ownership,
          isNull(schema.games.firstHalfStartedAtMs),
          isNull(schema.games.halftimeStartedAtMs),
          isNull(schema.games.secondHalfStartedAtMs),
        ),
      )
      .returning();
    return updated[0] ?? null;
  }

  if (to === "halftime") {
    const updated = await db
      .update(schema.games)
      .set({ halftimeStartedAtMs: nowMs })
      .where(
        and(
          ownership,
          isNotNull(schema.games.firstHalfStartedAtMs),
          isNull(schema.games.halftimeStartedAtMs),
          isNull(schema.games.secondHalfStartedAtMs),
        ),
      )
      .returning();
    return updated[0] ?? null;
  }

  const updated = await db
    .update(schema.games)
    .set({ secondHalfStartedAtMs: nowMs })
    .where(
      and(
        ownership,
        isNotNull(schema.games.firstHalfStartedAtMs),
        isNull(schema.games.secondHalfStartedAtMs),
      ),
    )
    .returning();
  return updated[0] ?? null;
}

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
      .values(
        items.map((item) => gameDbRowWithoutPhaseTimestamps(item, userId)),
      )
      .returning();

    return c.json(inserted.map(dbRowToGame));
  })
  .post("/start", zValidator("json", startGameBodySchema), async (c) => {
    const body = c.req.valid("json");
    const { userId } = c.env;
    const db = await getDb();

    try {
      const result = await startGame(db, userId, body);
      return c.json(result);
    } catch (error) {
      if (error instanceof StartGameConflictError) {
        throw new HTTPException(409, { message: error.message });
      }
      if (error instanceof StartGameTeamNotFoundError) {
        throw new HTTPException(404, { message: error.message });
      }
      throw error;
    }
  })
  .post(
    "/:gameId/transitions",
    zValidator("param", gameIdParamSchema),
    zValidator("json", phaseTransitionBodySchema),
    async (c) => {
      const { gameId } = c.req.valid("param");
      const { to } = c.req.valid("json");
      const { userId } = c.env;
      const nowMs = Date.now();

      // Always attempt the conditional write first so success is based on the
      // atomic UPDATE, not a pre-read that can go stale before the response.
      const updated = await applyAtomicPhaseUpdate(userId, gameId, to, nowMs);

      if (updated) {
        return c.json({ game: dbRowToGame(updated), applied: true });
      }

      const refreshed = await loadGameOrThrow(userId, gameId);
      const decision = decidePhaseTransition(
        {
          firstHalfStartedAtMs: refreshed.firstHalfStartedAtMs,
          halftimeStartedAtMs: refreshed.halftimeStartedAtMs,
          secondHalfStartedAtMs: refreshed.secondHalfStartedAtMs,
        },
        to,
      );

      if (decision.kind === "idempotent") {
        return c.json({ game: dbRowToGame(refreshed), applied: false });
      }

      throw new HTTPException(409, {
        message:
          decision.kind === "conflict"
            ? decision.reason
            : "Game phase transition conflict",
      });
    },
  )
  .post(
    "/:gameId/pause-state",
    zValidator("param", gameIdParamSchema),
    zValidator("json", gamePauseStateBodySchema),
    async (c) => {
      const { gameId } = c.req.valid("param");
      const { half, paused, clientId } = c.req.valid("json");
      const { userId } = c.env;
      const nowMs = Date.now();
      const resolvedClientId = clientId ?? crypto.randomUUID();

      try {
        const result = await setGamePauseState(
          userId,
          gameId,
          half,
          paused,
          resolvedClientId,
          nowMs,
        );
        return c.json(result);
      } catch (error) {
        if (error instanceof GameNotFoundError) {
          throw new HTTPException(404, { message: error.message });
        }
        if (error instanceof PauseStateConflictError) {
          throw new HTTPException(409, { message: error.message });
        }
        throw error;
      }
    },
  )
  .put("/", zValidator("json", gamesArraySchema), async (c) => {
    const items = c.req.valid("json");
    const { userId } = c.env;
    const db = await getDb();

    if (items.length === 0) {
      return c.json([]);
    }

    const gameColumns = getColumns(schema.games);
    const rows = items.map((item) =>
      gameDbRowWithoutPhaseTimestamps(item, userId),
    );
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
          // Phase timestamps are only set via POST /:gameId/transitions.
        },
      })
      .returning();

    return c.json(inserted.map(dbRowToGame));
  });
