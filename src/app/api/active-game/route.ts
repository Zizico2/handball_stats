import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/app/api/db";
import * as schema from "@/db/schema";
import { z } from "zod";

export async function GET() {
  const db = await getDb();
  const rows = await db.select().from(schema.activeGame);
  return NextResponse.json(rows);
}

const postBodySchema = z.object({
  id: z.number().optional(),
  gameId: z.number(),
  homeTeamId: z.number(),
});
export async function POST(request: Request) {
  const db = await getDb();
  const body = postBodySchema.parse(await request.json());
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

const deleteBodySchema = z.object({ ids: z.array(z.number()) });
export async function DELETE(request: Request) {
  const db = await getDb();
  const { ids } = deleteBodySchema.parse(await request.json());
  for (const id of ids) {
    await db.delete(schema.activeGame).where(eq(schema.activeGame.id, id));
  }
  return NextResponse.json({ ok: true });
}
