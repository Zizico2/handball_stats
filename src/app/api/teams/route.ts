import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/app/api/db";
import * as schema from "@/db/schema";

export async function GET() {
  const db = await getDb();
  const rows = await db.select().from(schema.teams);
  return NextResponse.json(rows);
}

const teamSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
});
const postBodySchema = z
  .union([teamSchema, z.array(teamSchema)])
  .transform((v) => (Array.isArray(v) ? v : [v]));
export async function POST(request: Request) {
  const db = await getDb();
  const items = postBodySchema.parse(await request.json());
  const inserted = await db.insert(schema.teams).values(items).returning();
  return NextResponse.json(inserted);
}

const deleteBodySchema = z.object({ ids: z.array(z.number()) });
export async function DELETE(request: Request) {
  const db = await getDb();
  const { ids } = deleteBodySchema.parse(await request.json());
  for (const id of ids) {
    await db.delete(schema.teams).where(eq(schema.teams.id, id));
  }
  return NextResponse.json({ ok: true });
}
