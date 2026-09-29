// GET /api/analytics/summary?cityId=&days=14 — Analytics page data.
// Every series is aggregated from REAL stored rows (events, memory operations,
// relationships, anomalies). Empty series are returned as empty — never padded
// with synthetic values.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EVENT_TYPE_LABELS } from "@/server/types";
import { getCityConfig } from "@/server/cities";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const cityId = sp.get("cityId") ?? "hyderabad";
  const days = Math.min(Math.max(Number(sp.get("days") ?? 14) || 14, 7), 90);

  const cfg = getCityConfig(cityId);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [events, memoryOps, patterns, anomalies, counts] = await Promise.all([
    db.cityEvent.findMany({
      where: { cityId, observedAt: { gte: since }, dataOrigin: { not: "SIMULATED" } },
      orderBy: { observedAt: "asc" },
      select: {
        id: true,
        eventType: true,
        severity: true,
        status: true,
        observedAt: true,
        source: true,
        dataOrigin: true,
        metadata: true,
      },
    }),
    db.memoryOperation.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      select: { operation: true, status: true, createdAt: true },
    }),
    db.eventRelationship.findMany({
      where: { relation: { in: ["RECURRING_PATTERN", "SIMILAR"] } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { fromEvent: true, toEvent: true },
    }),
    db.anomaly.findMany({
      where: { cityId },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    db.cityEvent.groupBy({
      by: ["eventType", "status"],
      where: { cityId, dataOrigin: { not: "SIMULATED" } },
      _count: true,
    }),
  ]);

  // ── Events per day by type (stacked bars) ──────────────────────────────────
  const dayMap = new Map<string, Map<string, number>>();
  for (const e of events) {
    const day = e.observedAt.toISOString().slice(0, 10);
    if (!dayMap.has(day)) dayMap.set(day, new Map());
    const m = dayMap.get(day)!;
    m.set(e.eventType, (m.get(e.eventType) ?? 0) + 1);
  }
  const typesPresent = Array.from(new Set(events.map((e) => e.eventType)));
  const eventsByDay: Array<Record<string, string | number>> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const row: Record<string, string | number> = { day: d.slice(5) };
    for (const t of typesPresent) row[t] = dayMap.get(d)?.get(t) ?? 0;
    eventsByDay.push(row);
  }

  // ── Air-quality & precipitation series (from LIVE event metadata only) ─────
  const aqiSeries: Array<{ t: string; aqi: number }> = [];
  const precipSeries: Array<{ t: string; mm: number }> = [];
  for (const e of events) {
    if (e.dataOrigin !== "LIVE") continue;
    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse(e.metadata) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (e.eventType === "AIR_QUALITY" && typeof meta.usAqi === "number") {
      aqiSeries.push({ t: e.observedAt.toISOString(), aqi: Math.round(meta.usAqi) });
    }
    if (e.eventType === "WEATHER_RAIN" && typeof meta.precipMm === "number") {
      precipSeries.push({ t: e.observedAt.toISOString(), mm: Number(meta.precipMm.toFixed(1)) });
    }
  }

  // ── Severity + totals ───────────────────────────────────────────────────────
  const severityCounts = ["INFO", "MINOR", "MODERATE", "MAJOR", "CRITICAL"].map((s) => ({
    severity: s,
    count: events.filter((e) => e.severity === s).length,
  }));
  const typeCounts = typesPresent.map((t) => ({
    eventType: t,
    label: EVENT_TYPE_LABELS[t] ?? t,
    count: events.filter((e) => e.eventType === t).length,
  }));
  const totals = {
    events: counts.reduce((a, c) => a + c._count, 0),
    active: counts.filter((c) => c.status === "ACTIVE").reduce((a, c) => a + c._count, 0),
    resolved: counts.filter((c) => c.status === "RESOLVED").reduce((a, c) => a + c._count, 0),
  };

  // ── Memory operations per day ───────────────────────────────────────────────
  const memMap = new Map<string, { RETAIN: number; RECALL: number; REFLECT: number }>();
  for (const op of memoryOps) {
    const day = op.createdAt.toISOString().slice(0, 10);
    const row = memMap.get(day) ?? { RETAIN: 0, RECALL: 0, REFLECT: 0 };
    if (op.operation === "RETAIN" || op.operation === "RECALL" || op.operation === "REFLECT") {
      row[op.operation] += 1;
    }
    memMap.set(day, row);
  }
  const memoryOpsByDay: Array<{ day: string; RETAIN: number; RECALL: number; REFLECT: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const r = memMap.get(d) ?? { RETAIN: 0, RECALL: 0, REFLECT: 0 };
    memoryOpsByDay.push({ day: d.slice(5), ...r });
  }

  return NextResponse.json({
    cityId,
    cityName: cfg.name,
    windowDays: days,
    totals,
    eventsByDay,
    typeKeys: typesPresent,
    typeCounts,
    severityCounts,
    aqiSeries,
    precipSeries,
    memoryOpsByDay,
    patterns: patterns
      .filter((p) => p.fromEvent && p.toEvent)
      .map((p) => ({
        id: p.id,
        relation: p.relation,
        confidence: p.confidence,
        explanation: p.explanation,
        basis: p.basis,
        from: { id: p.fromEvent.id, title: p.fromEvent.title, observedAt: p.fromEvent.observedAt.toISOString() },
        to: { id: p.toEvent.id, title: p.toEvent.title, observedAt: p.toEvent.observedAt.toISOString() },
      })),
    anomalies: anomalies.map((a) => ({
      id: a.id,
      metric: a.metric,
      description: a.description,
      status: a.status,
      deviation: a.deviation,
      direction: a.direction,
      createdAt: a.createdAt.toISOString(),
    })),
    note: "All series are aggregated from real stored events and memory operations. Empty charts mean no data has been collected yet.",
  });
}
