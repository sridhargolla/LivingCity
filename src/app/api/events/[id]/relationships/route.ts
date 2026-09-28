// GET /api/events/[id]/relationships — relationship graph data for one event.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { publicEvent } from "@/server/ingestion/ingest";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const event = await db.cityEvent.findUnique({ where: { id } });
  if (!event) return NextResponse.json({ error: "event not found" }, { status: 404 });

  const rels = await db.eventRelationship.findMany({
    where: { OR: [{ fromEventId: id }, { toEventId: id }] },
    include: { fromEvent: true, toEvent: true },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  return NextResponse.json({
    focus: publicEvent(event),
    edges: rels.map((r) => ({
      id: r.id,
      relation: r.relation,
      confidence: r.confidence,
      explanation: r.explanation,
      basis: r.basis,
      direction: r.fromEventId === id ? ("outgoing" as const) : ("incoming" as const),
      other: publicEvent(r.fromEventId === id ? r.toEvent : r.fromEvent),
    })),
  });
}
