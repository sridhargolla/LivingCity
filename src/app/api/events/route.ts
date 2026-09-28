// GET /api/events — list events with optional filters.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { publicEvent } from "@/server/ingestion/ingest";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Number(sp.get("limit") ?? 50) || 50, 200);
  const origin = sp.get("origin"); // LIVE | SIMULATED | USER_REPORTED
  const status = sp.get("status"); // ACTIVE | DEVELOPING | RESOLVED
  const type = sp.get("type");
  const cityId = sp.get("cityId");
  const sinceHours = Number(sp.get("sinceHours") ?? 0) || 0;

  const where: Record<string, unknown> = {};
  if (origin) where.dataOrigin = origin;
  if (status) where.status = status;
  if (type) where.eventType = type;
  if (cityId) where.cityId = cityId;
  if (sinceHours > 0) where.observedAt = { gte: new Date(Date.now() - sinceHours * 3600 * 1000) };

  const events = await db.cityEvent.findMany({ where, orderBy: { observedAt: "desc" }, take: limit });
  return NextResponse.json({ events: events.map(publicEvent), count: events.length });
}
