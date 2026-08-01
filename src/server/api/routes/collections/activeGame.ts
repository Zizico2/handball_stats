import { zValidator } from "@hono/zod-validator";
import { and, eq, getColumns, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { activeGameToDbRow, dbRowToActiveGame } from "@/db";
import * as schema from "@/db/schema";
import type { ApiEnv } from "@/server/api/types";
import { getDb } from "@/server/db";
import { getGamesByClientId, getTeamsByClientId } from "@/server/dbClientIds";
import { activeGameArraySchema, activeGameIdsSchema } from "./shared";

export const activeGameRoutes = new Hono<ApiEnv>()
  .get("/", async (c) => {
    const { userId } = c.env;
    const db = await getDb();
    const rows = await db
      .select({
        activeGame: schema.activeGame,
        gameClientId: schema.games.clientId,
        teamClientId: schema.teams.clientId,
      })
      .from(schema.activeGame)
      .innerJoin(
        schema.games,
        and(
          eq(schema.games.userId, schema.activeGame.userId),
          eq(schema.games.id, schema.activeGame.gameId),
        ),
      )
      .innerJoin(
        schema.teams,
        and(
          eq(schema.teams.userId, schema.activeGame.userId),
          eq(schema.teams.id, schema.activeGame.homeTeamId),
        ),
      )
      .where(eq(schema.activeGame.userId, userId));

    return c.json(
      rows.map(({ activeGame, gameClientId, teamClientId }) =>
        dbRowToActiveGame(activeGame, gameClientId, teamClientId),
      ),
    );
  })
  .put("/", zValidator("json", activeGameArraySchema), async (c) => {
    const items = c.req.valid("json");
    const { userId } = c.env;
    const db = await getDb();

    if (items.length === 0) return c.json([]);

    const gamesByClientId = await getGamesByClientId(
      db,
      userId,
      items.map((item) => item.gameId),
    );
    const teamsByClientId = await getTeamsByClientId(
      db,
      userId,
      items.map((item) => item.homeTeamId),
    );
    const resolvedItems = items.map((item) => {
      const game = gamesByClientId.get(item.gameId);
      const team = teamsByClientId.get(item.homeTeamId);
      if (!game || !team || game.homeTeamId !== team.id) {
        throw new HTTPException(400, {
          message: "Active game must reference an existing game and its team",
        });
      }
      return { item, game, team };
    });

    const columns = getColumns(schema.activeGame);
    const rows = resolvedItems.map(({ item, game, team }) =>
      activeGameToDbRow(item, userId, game.id, team.id),
    );
    const inserted = await db
      .insert(schema.activeGame)
      .values(rows)
      .onConflictDoUpdate({
        target: schema.activeGame.userId,
        set: {
          gameId: sql.raw(`excluded.${columns.gameId.name}`),
          homeTeamId: sql.raw(`excluded.${columns.homeTeamId.name}`),
        },
      })
      .returning();

    return c.json(
      inserted.map((row, index) =>
        dbRowToActiveGame(row, items[index].gameId, items[index].homeTeamId),
      ),
    );
  })
  .delete("/", zValidator("json", activeGameIdsSchema), async (c) => {
    const ids = c.req.valid("json");
    const { userId } = c.env;
    const db = await getDb();

    if (!ids.includes(1)) return c.body(null, 204);

    const targeted = await db
      .select({ gameId: schema.activeGame.gameId })
      .from(schema.activeGame)
      .where(eq(schema.activeGame.userId, userId));

    if (targeted.length === 0) return c.body(null, 204);

    await db.batch([
      db.delete(schema.pauseToggles).where(
        and(
          eq(schema.pauseToggles.userId, userId),
          inArray(
            schema.pauseToggles.gameId,
            targeted.map(({ gameId }) => gameId),
          ),
        ),
      ),
      db.delete(schema.activeGame).where(eq(schema.activeGame.userId, userId)),
    ]);

    return c.body(null, 204);
  });
