"use server";

import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import type {
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
  teamToDbRow,
  teamPlayerToDbRow,
} from "@/db";
import * as schema from "@/db/schema";
import { getDb } from "@/server/db";

type InsertTeamInput = z.infer<typeof teamSchema>;
type InsertTeamPlayerInput = z.infer<typeof teamPlayerSchema>;
type InsertGameInput = z.infer<typeof gameSchema>;
type InsertActiveGameInput = z.infer<typeof activeGameSchema>;
type InsertPlayerEventInput = z.infer<typeof playerEventSchema>;
type DeleteIdsInput = number[];

async function requireUserId() {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  return userId;
}

export async function listPlayerEventsAction() {
  const userId = await requireUserId();
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.playerEvents)
    .where(eq(schema.playerEvents.userId, userId));

  return rows.map(dbRowToPlayerEvent);
}

export async function createPlayerEventsAction(
  items: InsertPlayerEventInput[],
) {
  const userId = await requireUserId();
  const db = await getDb();
  const inserted = await db
    .insert(schema.playerEvents)
    .values(items.map((item) => playerEventToDbRow(item, userId)))
    .returning();

  return inserted.map(dbRowToPlayerEvent);
}

export async function deletePlayerEventsAction(ids: DeleteIdsInput) {
  const userId = await requireUserId();
  const db = await getDb();

  await Promise.all(
    ids.map((id) =>
      db
        .delete(schema.playerEvents)
        .where(
          and(
            eq(schema.playerEvents.userId, userId),
            eq(schema.playerEvents.localId, id),
          ),
        ),
    ),
  );
}

export async function listTeamsAction() {
  const userId = await requireUserId();
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.teams)
    .where(eq(schema.teams.userId, userId));

  return rows.map(dbRowToTeam);
}

export async function createTeamsAction(items: InsertTeamInput[]) {
  const userId = await requireUserId();
  const db = await getDb();
  const inserted = await db
    .insert(schema.teams)
    .values(items.map((item) => teamToDbRow(item, userId)))
    .returning();

  return inserted.map(dbRowToTeam);
}

export async function deleteTeamsAction(ids: DeleteIdsInput) {
  const userId = await requireUserId();
  const db = await getDb();

  await Promise.all(
    ids.map((id) =>
      db
        .delete(schema.teams)
        .where(
          and(eq(schema.teams.userId, userId), eq(schema.teams.localId, id)),
        ),
    ),
  );
}

export async function listTeamPlayersAction() {
  const userId = await requireUserId();
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.teamPlayers)
    .where(eq(schema.teamPlayers.userId, userId));

  return rows.map(dbRowToTeamPlayer);
}

export async function createTeamPlayersAction(items: InsertTeamPlayerInput[]) {
  const userId = await requireUserId();
  const db = await getDb();
  const inserted = await db
    .insert(schema.teamPlayers)
    .values(items.map((item) => teamPlayerToDbRow(item, userId)))
    .returning();

  return inserted.map(dbRowToTeamPlayer);
}

export async function deleteTeamPlayersAction(ids: DeleteIdsInput) {
  const userId = await requireUserId();
  const db = await getDb();

  await Promise.all(
    ids.map((id) =>
      db
        .delete(schema.teamPlayers)
        .where(
          and(
            eq(schema.teamPlayers.userId, userId),
            eq(schema.teamPlayers.localId, id),
          ),
        ),
    ),
  );
}

export async function listGamesAction() {
  const userId = await requireUserId();
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.games)
    .where(eq(schema.games.userId, userId));

  return rows.map(dbRowToGame);
}

export async function createGamesAction(items: InsertGameInput[]) {
  const userId = await requireUserId();
  const db = await getDb();

  const inserted = await db
    .insert(schema.games)
    .values(items.map((item) => gameToDbRow(item, userId)))
    .returning();

  return inserted.map(dbRowToGame);
}

export async function listActiveGameAction() {
  const userId = await requireUserId();
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.activeGame)
    .where(eq(schema.activeGame.userId, userId));

  return rows.map(dbRowToActiveGame);
}

export async function upsertActiveGameAction(items: InsertActiveGameInput[]) {
  const userId = await requireUserId();
  const db = await getDb();
  const inserted = await Promise.all(
    items.map(async (item) => {
      const row = activeGameToDbRow(item, userId);
      const [result] = await db
        .insert(schema.activeGame)
        .values(row)
        .onConflictDoUpdate({
          target: [schema.activeGame.userId, schema.activeGame.localId],
          set: {
            gameLocalId: row.gameLocalId,
            homeTeamLocalId: row.homeTeamLocalId,
          },
        })
        .returning();

      return dbRowToActiveGame(result);
    }),
  );

  return inserted;
}

export async function deleteActiveGameAction(ids: DeleteIdsInput) {
  const userId = await requireUserId();
  const db = await getDb();

  await Promise.all(
    ids.map((id) =>
      db
        .delete(schema.activeGame)
        .where(
          and(
            eq(schema.activeGame.userId, userId),
            eq(schema.activeGame.localId, id),
          ),
        ),
    ),
  );
}
