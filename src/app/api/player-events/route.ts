import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/app/api/db";
import { dbRowToPlayerEvent, playerEventToDbRow } from "@/db";
import { playerEventSchema } from "@/datamodel";
import * as schema from "@/db/schema";

export async function GET() {
  const db = await getDb();
  const rows = await db.select().from(schema.playerEvents);
  return NextResponse.json(rows.map(dbRowToPlayerEvent));
}

const postBodySchema = z
  .union([playerEventSchema, z.array(playerEventSchema)])
  .transform((v) => (Array.isArray(v) ? v : [v]));
export async function POST(request: Request) {
  const db = await getDb();
  const items = postBodySchema.parse(await request.json());
  const dbRows = items.map(playerEventToDbRow);
  const inserted = await db
    .insert(schema.playerEvents)
    .values(dbRows)
    .returning();
  return NextResponse.json(inserted.map(dbRowToPlayerEvent));
}

const deleteBodySchema = z.object({ ids: z.array(z.number()) });
export async function DELETE(request: Request) {
  const db = await getDb();
  const { ids } = deleteBodySchema.parse(await request.json());
  for (const id of ids) {
    await db.delete(schema.playerEvents).where(eq(schema.playerEvents.id, id));
  }
  return NextResponse.json({ ok: true });
}
