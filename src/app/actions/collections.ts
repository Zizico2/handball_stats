"use server";

import { eq } from "drizzle-orm";
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
  dbRowToTeamPlayer,
  gameToDbRow,
  playerEventToDbRow,
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

export async function listPlayerEventsAction() {
  const db = await getDb();
  const rows = await db.select().from(schema.playerEvents);

  return rows.map(dbRowToPlayerEvent);
}

export async function createPlayerEventsAction(
  items: InsertPlayerEventInput[],
) {
  const db = await getDb();
  const inserted = await db
    .insert(schema.playerEvents)
    .values(items.map(playerEventToDbRow))
    .returning();

  return inserted.map(dbRowToPlayerEvent);
}

export async function deletePlayerEventsAction(ids: DeleteIdsInput) {
  const db = await getDb();

  await Promise.all(
    ids.map((id) =>
      db.delete(schema.playerEvents).where(eq(schema.playerEvents.id, id)),
    ),
  );
}

export async function listTeamsAction() {
  const db = await getDb();
  const rows = await db.select().from(schema.teams);

  return rows;
}

export async function createTeamsAction(items: InsertTeamInput[]) {
  const db = await getDb();
  const inserted = await db.insert(schema.teams).values(items).returning();

  return inserted;
}

export async function deleteTeamsAction(ids: DeleteIdsInput) {
  const db = await getDb();

  await Promise.all(
    ids.map((id) => db.delete(schema.teams).where(eq(schema.teams.id, id))),
  );
}

export async function listTeamPlayersAction() {
  const db = await getDb();
  const rows = await db.select().from(schema.teamPlayers);

  return rows.map(dbRowToTeamPlayer);
}

export async function createTeamPlayersAction(items: InsertTeamPlayerInput[]) {
  const db = await getDb();
  const inserted = await db
    .insert(schema.teamPlayers)
    .values(items.map(teamPlayerToDbRow))
    .returning();

  return inserted.map(dbRowToTeamPlayer);
}

export async function deleteTeamPlayersAction(ids: DeleteIdsInput) {
  const db = await getDb();

  await Promise.all(
    ids.map((id) =>
      db.delete(schema.teamPlayers).where(eq(schema.teamPlayers.id, id)),
    ),
  );
}

export async function listGamesAction() {
  const db = await getDb();
  const rows = await db.select().from(schema.games);

  return rows.map(dbRowToGame);
}

export async function createGamesAction(items: InsertGameInput[]) {
  const db = await getDb();

  const inserted = await db
    .insert(schema.games)
    .values(items.map(gameToDbRow))
    .returning();

  return inserted.map(dbRowToGame);
}

export async function listActiveGameAction() {
  const db = await getDb();
  const rows = await db.select().from(schema.activeGame);

  return rows.map(dbRowToActiveGame);
}

export async function upsertActiveGameAction(items: InsertActiveGameInput[]) {
  const db = await getDb();
  const inserted = await Promise.all(
    items.map(async (item) => {
      const row = activeGameToDbRow(item);
      const [result] = await db
        .insert(schema.activeGame)
        .values(row)
        .onConflictDoUpdate({
          target: schema.activeGame.id,
          set: { gameId: row.gameId, homeTeamId: row.homeTeamId },
        })
        .returning();

      return dbRowToActiveGame(result);
    }),
  );

  return inserted;
}

export async function deleteActiveGameAction(ids: DeleteIdsInput) {
  const db = await getDb();

  await Promise.all(
    ids.map((id) =>
      db.delete(schema.activeGame).where(eq(schema.activeGame.id, id)),
    ),
  );
}
