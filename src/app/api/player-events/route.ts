import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/app/api/db";
import { dbRowToPlayerEvent, playerEventToDbRow } from "@/db";
import * as schema from "@/db/schema";

export async function GET() {
  const db = await getDb();
  const rows = await db.select().from(schema.playerEvents);
  return NextResponse.json(rows.map(dbRowToPlayerEvent));
}

export async function POST(request: Request) {
  const db = await getDb();
  const body = await request.json();
  const items = Array.isArray(body) ? body : [body];
  const dbRows = items.map(playerEventToDbRow);
  const inserted = await db
    .insert(schema.playerEvents)
    .values(dbRows)
    .returning();
  return NextResponse.json(inserted.map(dbRowToPlayerEvent));
}

export async function DELETE(request: Request) {
  const db = await getDb();
  const { ids } = (await request.json()) as { ids: number[] };
  for (const id of ids) {
    await db.delete(schema.playerEvents).where(eq(schema.playerEvents.id, id));
  }
  return NextResponse.json({ ok: true });
}
