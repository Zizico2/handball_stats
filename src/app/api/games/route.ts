import { NextResponse } from "next/server";
import { getDb } from "@/app/api/db";
import * as schema from "@/db/schema";

export const runtime = 'edge';

export async function GET() {
  const db = await getDb();
  const rows = await db.select().from(schema.games);
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const db = await getDb();
  const body = (await request.json()) as unknown;
  const items = Array.isArray(body) ? body : [body];
  const inserted = await db.insert(schema.games).values(items).returning();
  return NextResponse.json(inserted);
}
