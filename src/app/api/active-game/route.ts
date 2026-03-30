import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/app/api/db";
import * as schema from "@/db/schema";

export async function GET() {
  const db = await getDb();
  const rows = await db.select().from(schema.activeGame);
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const db = await getDb();
  const body = (await request.json()) as { id?: number; gameId: number; homeTeamId: number };
  const inserted = await db
    .insert(schema.activeGame)
    .values(body)
    .onConflictDoUpdate({
      target: schema.activeGame.id,
      set: { gameId: body.gameId, homeTeamId: body.homeTeamId },
    })
    .returning();
  return NextResponse.json(inserted);
}

export async function DELETE(request: Request) {
  const db = await getDb();
  const { ids } = (await request.json()) as { ids: number[] };
  for (const id of ids) {
    await db
      .delete(schema.activeGame)
      .where(eq(schema.activeGame.id, id));
  }
  return NextResponse.json({ ok: true });
}
