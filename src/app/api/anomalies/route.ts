// Anomalies API (PHASE 10).
// GET  /api/anomalies?cityId=&status=      → list with related events + memory recall
// POST /api/anomalies {id, action}         → investigate | resolve
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { investigateAnomaly, resolveAnomaly } from "@/server/anomaly";
import { publicEvent } from "@/server/ingestion/ingest";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const cityId = sp.get("cityId") ?? "hyderabad";
  const status = sp.get("status"); // OPEN | INVESTIGATING | RESOLVED

  const anomalies = await db.anomaly.findMany({
    where: { cityId, ...(status ? { status } : { status: { in: ["OPEN", "INVESTIGATING"] } }) },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const items = await Promise.all(
    anomalies.map(async (a) => {
      let related: ReturnType<typeof publicEvent>[] = [];
      try {
        const ids = JSON.parse(a.relatedEventIds) as string[];
        if (ids.length) {
          const rows = await db.cityEvent.findMany({ where: { id: { in: ids.slice(0, 4) } } });
          related = rows.map(publicEvent);
        }
      } catch {}
      let memory: { status?: string; memories?: Array<{ id: string; text: string }> } = {};
      try {
        memory = JSON.parse(a.memoryRecallJson);
      } catch {}
      return {
        id: a.id,
        cityId: a.cityId,
        metric: a.metric,
        observedValue: a.observedValue,
        baselineValue: a.baselineValue,
        deviation: a.deviation,
        direction: a.direction,
        description: a.description,
        status: a.status,
        observedFacts: safeArr(a.observedFacts),
        possibleExplanation: a.possibleExplanation,
        related,
        memoryRecall: memory,
        createdAt: a.createdAt.toISOString(),
        resolvedAt: a.resolvedAt?.toISOString() ?? null,
      };
    })
  );

  return NextResponse.json({ anomalies: items });
}

const ActionSchema = z.object({
  id: z.string().max(64),
  action: z.enum(["investigate", "resolve"]),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  try {
    if (parsed.data.action === "investigate") await investigateAnomaly(parsed.data.id);
    else await resolveAnomaly(parsed.data.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Anomaly not found" }, { status: 404 });
  }
}

function safeArr(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String).slice(0, 6) : [];
  } catch {
    return [];
  }
}
