// POST /api/demo/seed — seed the memory bank with historical experiences (REAL retain calls).
import { NextResponse } from "next/server";
import { seedHistoricalMemory } from "@/server/demo/scenarios";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    const result = await seedHistoricalMemory();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
