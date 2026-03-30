import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/app/api/db";
import * as schema from "@/db/schema";

export async function GET() {
  const db = await getDb();
  const rows = await db.select().from(schema.teams);
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const db = await getDb();
  const body = (await request.json()) as unknown;
  const items = Array.isArray(body) ? body : [body];
  const inserted = await db.insert(schema.teams).values(items).returning();
  return NextResponse.json(inserted);
}

export async function DELETE(request: Request) {
  const db = await getDb();
  const { ids } = (await request.json()) as { ids: number[] };
  for (const id of ids) {
    await db.delete(schema.teams).where(eq(schema.teams.id, id));
  }
  return NextResponse.json({ ok: true });
}
