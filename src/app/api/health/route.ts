import { NextResponse } from "next/server";
import { HindsightMemoryService } from "@/server/hindsight/HindsightMemoryService";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const [hindsight, eventCount] = await Promise.all([
    HindsightMemoryService.checkHealth(),
    db.cityEvent.count().catch(() => -1),
  ]);

  return NextResponse.json({
    ok: true,
    service: "living-city",
    city: "Hyderabad",
    time: new Date().toISOString(),
    hindsight,
    database: { ok: eventCount >= 0, eventCount },
  });
}
