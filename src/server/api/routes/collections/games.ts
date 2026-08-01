import { zValidator } from "@hono/zod-validator";
import { and, eq, getColumns, isNotNull, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import {
  type ClientId,
  clientIdSchema,
  gamePauseStateBodySchema,
  startGameBodySchema,
} from "@/datamodel";
import { dbRowToGame, gameToDbRow } from "@/db";
import * as schema from "@/db/schema";
import { createClientId, parseClientId } from "@/lib/clientId";
import type { ApiEnv } from "@/server/api/types";
import { getDb } from "@/server/db";
import { getTeamsByClientId } from "@/server/dbClientIds";
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
  StartGameRosterTooSmallError,
  StartGameTeamNotFoundError,
  startGame,
} from "@/server/startGame";
import { gamesArraySchema } from "./shared";

const gameIdParamSchema = z.object({
  gameId: clientIdSchema,
});

const phaseTransitionBodySchema = z.object({
  to: z.enum(["firstHalf", "halftime", "secondHalf"]),
});

function gameDbRowWithoutPhaseTimestamps(
  item: z.infer<typeof gamesArraySchema>[number],
  userId: string,
  homeTeamId: number,
) {
  return {
    ...gameToDbRow(item, userId, homeTeamId),
    firstHalfStartedAtMs: null,
    halftimeStartedAtMs: null,
    secondHalfStartedAtMs: null,
  };
}

async function loadGameOrThrow(
  userId: string,
  gameId: ClientId,
): Promise<typeof schema.games.$inferSelect> {
  const db = await getDb();
  const row = await db
    .select()
    .from(schema.games)
    .where(
      and(eq(schema.games.userId, userId), eq(schema.games.clientId, gameId)),
    )
    .get();

  if (!row) {
    throw new HTTPException(404, { message: `Game ${gameId} not found` });
  }

  return row;
}

async function applyAtomicPhaseUpdate(
  userId: string,
  gameId: ClientId,
  to: GamePhaseTransition,
  nowMs: number,
): Promise<typeof schema.games.$inferSelect | null> {
  const db = await getDb();
  const ownership = and(
    eq(schema.games.userId, userId),
    eq(schema.games.clientId, gameId),
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
      .select({ game: schema.games, teamClientId: schema.teams.clientId })
      .from(schema.games)
      .innerJoin(
        schema.teams,
        and(
          eq(schema.teams.userId, schema.games.userId),
          eq(schema.teams.id, schema.games.homeTeamId),
        ),
      )
      .where(eq(schema.games.userId, userId));

    return c.json(
      rows.map(({ game, teamClientId }) => dbRowToGame(game, teamClientId)),
    );
  })
  .post("/", zValidator("json", gamesArraySchema), async (c) => {
    const items = c.req.valid("json");
    const { userId } = c.env;
    const db = await getDb();
    const teamsByClientId = await getTeamsByClientId(
      db,
      userId,
      items.map((item) => item.homeTeamId),
    );
    if (items.some((item) => !teamsByClientId.has(item.homeTeamId))) {
      throw new HTTPException(400, {
        message: "Games must reference an existing team",
      });
    }
    const inserted = await db
      .insert(schema.games)
      .values(
        items.map((item) => {
          const team = teamsByClientId.get(item.homeTeamId);
          if (!team) throw new Error("Validated team was not resolved");
          return gameDbRowWithoutPhaseTimestamps(item, userId, team.id);
        }),
      )
      .returning();
    const itemsByClientId = new Map(items.map((item) => [item.id, item]));

    return c.json(
      inserted.map((row) => {
        const item = itemsByClientId.get(parseClientId(row.clientId));
        if (!item) throw new Error("Inserted game was not in the request");
        return dbRowToGame(row, item.homeTeamId);
      }),
    );
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
      if (error instanceof StartGameRosterTooSmallError) {
        throw new HTTPException(400, { message: error.message });
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
      const db = await getDb();

      // Always attempt the conditional write first so success is based on the
      // atomic UPDATE, not a pre-read that can go stale before the response.
      const updated = await applyAtomicPhaseUpdate(userId, gameId, to, nowMs);

      if (updated) {
        const team = await db
          .select({ clientId: schema.teams.clientId })
          .from(schema.teams)
          .where(
            and(
              eq(schema.teams.userId, userId),
              eq(schema.teams.id, updated.homeTeamId),
            ),
          )
          .get();
        if (!team) throw new Error("Game team was not found");
        return c.json({
          game: dbRowToGame(updated, team.clientId),
          applied: true,
        });
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
        const team = await db
          .select({ clientId: schema.teams.clientId })
          .from(schema.teams)
          .where(
            and(
              eq(schema.teams.userId, userId),
              eq(schema.teams.id, refreshed.homeTeamId),
            ),
          )
          .get();
        if (!team) throw new Error("Game team was not found");
        return c.json({
          game: dbRowToGame(refreshed, team.clientId),
          applied: false,
        });
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
      const resolvedClientId = clientId ?? createClientId();

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
    const teamsByClientId = await getTeamsByClientId(
      db,
      userId,
      items.map((item) => item.homeTeamId),
    );
    if (items.some((item) => !teamsByClientId.has(item.homeTeamId))) {
      throw new HTTPException(400, {
        message: "Games must reference an existing team",
      });
    }
    const rows = items.map((item) => {
      const team = teamsByClientId.get(item.homeTeamId);
      if (!team) throw new Error("Validated team was not resolved");
      return gameDbRowWithoutPhaseTimestamps(item, userId, team.id);
    });
    const inserted = await db
      .insert(schema.games)
      .values(rows)
      .onConflictDoUpdate({
        target: [schema.games.userId, schema.games.clientId],
        set: {
          homeTeamId: sql.raw(`excluded.${gameColumns.homeTeamId.name}`),
          createdAt: sql.raw(`excluded.${gameColumns.createdAt.name}`),
          // Phase timestamps are only set via POST /:gameId/transitions.
        },
      })
      .returning();

    const itemsByClientId = new Map(items.map((item) => [item.id, item]));
    return c.json(
      inserted.map((row) => {
        const item = itemsByClientId.get(parseClientId(row.clientId));
        if (!item) throw new Error("Upserted game was not in the request");
        return dbRowToGame(row, item.homeTeamId);
      }),
    );
  });
