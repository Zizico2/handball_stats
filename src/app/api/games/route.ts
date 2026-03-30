import { NextResponse } from "next/server";
import z from "zod";
import { getDb } from "@/app/api/db";
import * as schema from "@/db/schema";

export async function GET() {
  const db = await getDb();
  const rows = await db.select().from(schema.games);
  return NextResponse.json(rows);
}

const gameSchema = z.object({
  id: z.number().optional(),
  homeTeamId: z.number(),
  createdAt: z.string(),
});
const postBodySchema = z
  .union([gameSchema, z.array(gameSchema)])
  .transform((v) => (Array.isArray(v) ? v : [v]));
export async function POST(request: Request) {
  const db = await getDb();
  const items = postBodySchema.parse(await request.json());
  const inserted = await db.insert(schema.games).values(items).returning();
  return NextResponse.json(inserted);
}
