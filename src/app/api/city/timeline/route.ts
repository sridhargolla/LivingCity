// GET /api/city/timeline — past events vs current events for the memory timeline.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { publicEvent } from "@/server/ingestion/ingest";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const days = Math.min(Number(req.nextUrl.searchParams.get("days") ?? 14) || 14, 90);
  const originFilter = req.nextUrl.searchParams.get("origin");
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);

  const where: Record<string, unknown> = { observedAt: { gte: since } };
  if (originFilter) where.dataOrigin = originFilter;

  const events = await db.cityEvent.findMany({
    where,
    orderBy: { observedAt: "desc" },
    take: 300,
    select: {
      id: true, title: true, eventType: true, severity: true, dataOrigin: true,
      locationName: true, observedAt: true, startedAt: true, status: true,
      latitude: true, longitude: true, source: true, description: true, confidence: true,
      resolvedAt: true, tags: true, createdAt: true,
    },
  });

  const now = Date.now();
  const past = events.filter((e) => e.startedAt.getTime() < now - 3600 * 1000);
  const current = events.filter((e) => e.startedAt.getTime() >= now - 3600 * 1000);

  return NextResponse.json({
    timeline: {
      past: past.map(publicEvent),
      current: current.map(publicEvent),
    },
    windowDays: days,
  });
}
