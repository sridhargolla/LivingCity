// GET /api/events/[id] — single event with analysis + outcomes.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { publicEvent } from "@/server/ingestion/ingest";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const event = await db.cityEvent.findUnique({
    where: { id },
    include: { analyses: true, outcomes: { orderBy: { createdAt: "desc" } } },
  });
  if (!event) return NextResponse.json({ error: "event not found" }, { status: 404 });

  const { analyses, outcomes, ...base } = event;
  const analysis = analyses[0]
    ? {
        id: analyses[0].id,
        riskLevel: analyses[0].riskLevel,
        summary: analyses[0].summary,
        risks: safeParse(analyses[0].risks),
        recommendations: safeParse(analyses[0].recommendations),
        memoryUsed: analyses[0].memoryUsed,
        memoryCount: analyses[0].memoryCount,
        degraded: analyses[0].degraded,
        createdAt: analyses[0].createdAt.toISOString(),
      }
    : null;

  return NextResponse.json({
    event: publicEvent(base),
    analysis,
    outcomes: outcomes.map((o) => ({
      id: o.id,
      outcomeType: o.outcomeType,
      description: o.description,
      severity: o.severity,
      source: o.source,
      createdAt: o.createdAt.toISOString(),
    })),
  });
}

function safeParse(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
