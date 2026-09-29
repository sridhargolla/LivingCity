// GET /api/events/[id]/memory — Hindsight memories linked to this event
// (from MemoryOperation audit rows + live Hindsight recall).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HindsightMemoryService } from "@/server/hindsight/HindsightMemoryService";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const event = await db.cityEvent.findUnique({ where: { id } });
  if (!event) return NextResponse.json({ error: "event not found" }, { status: 404 });

  const ops = await db.memoryOperation.findMany({
    where: { eventId: id },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  const recalls = ops.filter((o) => o.operation === "RECALL");
  const retains = ops.filter((o) => o.operation === "RETAIN");

  // Fresh recall scoped to this event's characteristics (does not create memory).
  const liveRecall = await HindsightMemoryService.recall_related_experiences({
    eventId: id,
    query: `${event.title} ${event.locationName} consequences what happened`,
    limit: 8,
  });

  const retainedFact = retains[0] ? extractFact(retains[0]) : null;

  return NextResponse.json({
    eventId: id,
    memoryStatus: liveRecall.status === "SUCCESS" ? "AVAILABLE" : "UNAVAILABLE",
    recalled: liveRecall.experiences,
    retainedFact,
    operations: ops.map((o) => ({
      id: o.id,
      operation: o.operation,
      status: o.status,
      resultCount: o.resultCount,
      createdAt: o.createdAt.toISOString(),
    })),
  });
}

function extractFact(op: { query: string; detail: string }): string | null {
  if (op.query && op.query.trim()) return op.query;
  try {
    const d = JSON.parse(op.detail) as Record<string, unknown>;
    const q = d.query ?? d.factPreview;
    return typeof q === "string" ? q : null;
  } catch {
    return null;
  }
}
