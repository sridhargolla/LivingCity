// GET /api/city/patterns — recurring patterns mined from real relationships + memory ops.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const [patterns, relationCounts, typeCounts] = await Promise.all([
    db.eventRelationship.findMany({
      where: { relation: { in: ["RECURRING_PATTERN", "POSSIBLE_ESCALATION", "SIMILAR"] } },
      include: { fromEvent: true, toEvent: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    db.eventRelationship.groupBy({ by: ["relation"], _count: { relation: true } }),
    db.cityEvent.groupBy({ by: ["eventType"], _count: { eventType: true }, orderBy: { _count: { eventType: "desc" } } }),
  ]);

  return NextResponse.json({
    patterns: patterns.map((p) => ({
      id: p.id,
      relation: p.relation,
      confidence: p.confidence,
      explanation: p.explanation,
      basis: p.basis,
      createdAt: p.createdAt.toISOString(),
      from: { id: p.fromEvent.id, title: p.fromEvent.title, eventType: p.fromEvent.eventType, observedAt: p.fromEvent.observedAt.toISOString() },
      to: { id: p.toEvent.id, title: p.toEvent.title, eventType: p.toEvent.eventType, observedAt: p.toEvent.observedAt.toISOString() },
    })),
    relationshipCounts: relationCounts.map((r) => ({ relation: r.relation, count: r._count.relation })),
    eventTypeCounts: typeCounts.map((t) => ({ eventType: t.eventType, count: t._count.eventType })),
  });
}
