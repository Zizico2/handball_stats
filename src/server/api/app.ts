import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  dbRowToActiveGame,
  dbRowToGame,
  dbRowToPlayerEvent,
  dbRowToTeam,
  dbRowToTeamPlayer,
} from "@/db";
import * as schema from "@/db/schema";
import { getDb } from "@/server/db";

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
  .get("/teams", async (c) => {
    const userId = await requireUserId();
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.teams)
      .where(eq(schema.teams.userId, userId));

    return c.json(rows.map(dbRowToTeam));
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
  .get("/games", async (c) => {
    const userId = await requireUserId();
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.games)
      .where(eq(schema.games.userId, userId));

    return c.json(rows.map(dbRowToGame));
  })
  .get("/active-game", async (c) => {
    const userId = await requireUserId();
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.activeGame)
      .where(eq(schema.activeGame.userId, userId));

    return c.json(rows.map(dbRowToActiveGame));
  });

export const apiApp = new Hono()
  .basePath("/api")
  .route("/collections", collectionsRoutes);

export type ApiApp = typeof apiApp;
