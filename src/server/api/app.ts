import { auth } from "@clerk/nextjs/server";
import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  activeGameSchema,
  gameSchema,
  playerEventSchema,
  teamPlayerSchema,
  teamSchema,
} from "@/datamodel";
import {
  activeGameToDbRow,
  dbRowToActiveGame,
  dbRowToGame,
  dbRowToPlayerEvent,
  dbRowToTeam,
  dbRowToTeamPlayer,
  gameToDbRow,
  playerEventToDbRow,
  teamPlayerToDbRow,
  teamToDbRow,
} from "@/db";
import * as schema from "@/db/schema";
import { getDb } from "@/server/db";

const idsSchema = teamSchema.shape.id.array();
const playerEventsArraySchema = playerEventSchema.array();
const teamsArraySchema = teamSchema.array();
const teamPlayersArraySchema = teamPlayerSchema.array();
const gamesArraySchema = gameSchema.array();
const activeGameArraySchema = activeGameSchema.array();

async function requireUserId() {
  const { userId } = await auth();

  if (!userId) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  return userId;
}

const collectionsRoutes = new Hono()
  .get("/player-events", async (c) => {
    const userId = await requireUserId();
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.playerEvents)
      .where(eq(schema.playerEvents.userId, userId));

    return c.json(rows.map(dbRowToPlayerEvent));
  })
  .post(
    "/player-events",
    zValidator("json", playerEventsArraySchema),
    async (c) => {
      const items = c.req.valid("json");
      const userId = await requireUserId();
      const db = await getDb();
      const inserted = await db
        .insert(schema.playerEvents)
        .values(items.map((item) => playerEventToDbRow(item, userId)))
        .returning();

      return c.json(inserted.map(dbRowToPlayerEvent));
    },
  )
  .delete("/player-events", zValidator("json", idsSchema), async (c) => {
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
  })
  .get("/teams", async (c) => {
    const userId = await requireUserId();
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.teams)
      .where(eq(schema.teams.userId, userId));

    return c.json(rows.map(dbRowToTeam));
  })
  .post("/teams", zValidator("json", teamsArraySchema), async (c) => {
    const items = c.req.valid("json");
    const userId = await requireUserId();
    const db = await getDb();
    const inserted = await db
      .insert(schema.teams)
      .values(items.map((item) => teamToDbRow(item, userId)))
      .returning();

    return c.json(inserted.map(dbRowToTeam));
  })
  .delete("/teams", zValidator("json", idsSchema), async (c) => {
    const ids = c.req.valid("json");
    const userId = await requireUserId();
    const db = await getDb();

    if (ids.length === 0) {
      return c.body(null, 204);
    }

    await db
      .delete(schema.teams)
      .where(
        and(
          eq(schema.teams.userId, userId),
          inArray(schema.teams.localId, ids),
        ),
      );

    return c.body(null, 204);
  })
  .get("/team-players", async (c) => {
    const userId = await requireUserId();
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.teamPlayers)
      .where(eq(schema.teamPlayers.userId, userId));

    return c.json(rows.map(dbRowToTeamPlayer));
  })
  .post(
    "/team-players",
    zValidator("json", teamPlayersArraySchema),
    async (c) => {
      const items = c.req.valid("json");
      const userId = await requireUserId();
      const db = await getDb();
      const inserted = await db
        .insert(schema.teamPlayers)
        .values(items.map((item) => teamPlayerToDbRow(item, userId)))
        .returning();

      return c.json(inserted.map(dbRowToTeamPlayer));
    },
  )
  .delete("/team-players", zValidator("json", idsSchema), async (c) => {
    const ids = c.req.valid("json");
    const userId = await requireUserId();
    const db = await getDb();

    if (ids.length === 0) {
      return c.body(null, 204);
    }

    await db
      .delete(schema.teamPlayers)
      .where(
        and(
          eq(schema.teamPlayers.userId, userId),
          inArray(schema.teamPlayers.localId, ids),
        ),
      );

    return c.body(null, 204);
  })
  .get("/games", async (c) => {
    const userId = await requireUserId();
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.games)
      .where(eq(schema.games.userId, userId));

    return c.json(rows.map(dbRowToGame));
  })
  .post("/games", zValidator("json", gamesArraySchema), async (c) => {
    const items = c.req.valid("json");
    const userId = await requireUserId();
    const db = await getDb();
    const inserted = await db
      .insert(schema.games)
      .values(items.map((item) => gameToDbRow(item, userId)))
      .returning();

    return c.json(inserted.map(dbRowToGame));
  })
  .get("/active-game", async (c) => {
    const userId = await requireUserId();
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.activeGame)
      .where(eq(schema.activeGame.userId, userId));

    return c.json(rows.map(dbRowToActiveGame));
  })
  .put("/active-game", zValidator("json", activeGameArraySchema), async (c) => {
    const items = c.req.valid("json");
    const userId = await requireUserId();
    const db = await getDb();
    if (items.length === 0) {
      return c.json([]);
    }

    const rows = items.map((item) => activeGameToDbRow(item, userId));
    const inserted = await db
      .insert(schema.activeGame)
      .values(rows)
      .onConflictDoUpdate({
        target: [schema.activeGame.userId, schema.activeGame.localId],
        set: {
          gameLocalId: sql`excluded.game_local_id`,
          homeTeamLocalId: sql`excluded.home_team_local_id`,
        },
      })
      .returning();

    return c.json(inserted.map(dbRowToActiveGame));
  })
  .delete("/active-game", zValidator("json", idsSchema), async (c) => {
    const ids = c.req.valid("json");
    const userId = await requireUserId();
    const db = await getDb();

    if (ids.length === 0) {
      return c.body(null, 204);
    }

    await db
      .delete(schema.activeGame)
      .where(
        and(
          eq(schema.activeGame.userId, userId),
          inArray(schema.activeGame.localId, ids),
        ),
      );

    return c.body(null, 204);
  });

export const apiApp = new Hono()
  .basePath("/api")
  .route("/collections", collectionsRoutes);

export type ApiApp = typeof apiApp;
