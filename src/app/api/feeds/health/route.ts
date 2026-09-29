// GET /api/feeds and /api/feeds/health — REAL feed health from actual runs.
import { NextResponse } from "next/server";
import { getFeedStatuses, lastRunAt } from "@/server/ingestion/runFeeds";

export const dynamic = "force-dynamic";

export async function GET() {
  const statuses = await getFeedStatuses();
  return NextResponse.json({ feeds: statuses, lastRunAt: lastRunAt(), time: new Date().toISOString() });
}
