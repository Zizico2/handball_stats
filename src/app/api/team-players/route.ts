import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/app/api/db";
import * as schema from "@/db/schema";

export async function GET() {
  const db = await getDb();
  const rows = await db.select().from(schema.teamPlayers);
  return NextResponse.json(rows);
}

const teamPlayerSchema = z.object({
  id: z.number().optional(),
  teamId: z.number(),
  name: z.string(),
  number: z.number(),
});
const postBodySchema = z
  .union([teamPlayerSchema, z.array(teamPlayerSchema)])
  .transform((v) => (Array.isArray(v) ? v : [v]));
export async function POST(request: Request) {
  const db = await getDb();
  const items = postBodySchema.parse(await request.json());
  const inserted = await db
    .insert(schema.teamPlayers)
    .values(items)
    .returning();
  return NextResponse.json(inserted);
}

const deleteBodySchema = z.object({ ids: z.array(z.number()) });
export async function DELETE(request: Request) {
  const db = await getDb();
  const { ids } = deleteBodySchema.parse(await request.json());
  for (const id of ids) {
    await db.delete(schema.teamPlayers).where(eq(schema.teamPlayers.id, id));
  }
  return NextResponse.json({ ok: true });
}
