// LIVING CITY — Anomaly detection (PHASE 10).
//
// Continuously compares incoming signals with baselines computed from the system's
// OWN stored observations. When a meaningful deviation appears:
//   - OBSERVED FACTS are recorded (actual stored measurements)
//   - a POSSIBLE EXPLANATION is recorded as a hypothesis — clearly labeled, never fact
//   - Hindsight is queried for similar past anomalies
//
// No fabricated baselines: with too little history, the detector stays silent.

import { db } from "@/lib/db";
import { publish } from "@/server/realtime/eventBus";
import { HindsightMemoryService } from "@/server/hindsight/HindsightMemoryService";
import { bankIdForCity } from "@/server/cities";

interface MetricSample {
  value: number;
  at: Date;
  eventId: string;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

async function hasRecentAnomaly(cityId: string, metric: string, withinMs = 3600_000): Promise<boolean> {
  const since = new Date(Date.now() - withinMs);
  const count = await db.anomaly.count({ where: { cityId, metric, createdAt: { gte: since }, status: { in: ["OPEN", "INVESTIGATING"] } } });
  return count > 0;
}

/** Detect metric anomalies for a city. Called after each ingestion batch. */
export async function detectAnomalies(cityId: string): Promise<void> {
  try {
    await detectValueAnomaly(cityId, "AQI", "AIR_QUALITY", "usAqi");
    await detectValueAnomaly(cityId, "PRECIP", "WEATHER_RAIN", "precipMm");
    await detectEventRateAnomaly(cityId);
  } catch (e) {
    console.error("[anomaly] detection failed", e);
  }
}

/** Value anomaly: latest observation deviates from the trailing 7-day baseline (>35% or <35% with enough history). */
async function detectValueAnomaly(cityId: string, metric: string, eventType: string, metaKey: string): Promise<void> {
  if (await hasRecentAnomaly(cityId, metric)) return;

  const weekAgo = new Date(Date.now() - 7 * 86400_000);
  const rows = await db.cityEvent.findMany({
    where: { cityId, eventType, observedAt: { gte: weekAgo } },
    orderBy: { observedAt: "desc" },
    take: 30,
  });

  const samples: MetricSample[] = [];
  for (const r of rows) {
    try {
      const m = JSON.parse(r.metadata) as Record<string, unknown>;
      const v = m[metaKey];
      if (typeof v === "number" && Number.isFinite(v)) samples.push({ value: v, at: r.observedAt, eventId: r.id });
    } catch {
      /* skip malformed */
    }
  }
  if (samples.length < 4) return; // not enough history for an honest baseline

  const latest = samples[0];
  const baseline = mean(samples.slice(1).map((s) => s.value));
  if (baseline <= 0) return;

  const ratio = latest.value / baseline;
  const UP = ratio >= 1.35;
  const DOWN = ratio <= 0.65;
  if (!UP && !DOWN) return;
  if (UP && latest.value < 8) return; // avoid noise on tiny absolute values (e.g. 2 vs 1.2 AQI)

  const observedFacts = samples
    .slice(0, 5)
    .map((s) => `${metaKey}=${s.value} at ${s.at.toISOString().slice(0, 16)}`);
  const baselineSamples = samples.slice(1, 6).map((s) => `${metaKey}=${s.value}`);

  // Investigation: related events in the same window (possible explanations, never asserted)
  const windowStart = new Date(latest.at.getTime() - 3 * 3600_000);
  const related = await db.cityEvent.findMany({
    where: {
      cityId,
      id: { not: latest.eventId },
      observedAt: { gte: windowStart, lte: new Date(latest.at.getTime() + 3600_000) },
    },
    take: 6,
  });

  let possibleExplanation = "";
  if (UP && metric === "AQI") {
    const rain = related.find((r) => r.eventType.startsWith("WEATHER"));
    possibleExplanation = rain
      ? `Weather activity (${rain.title}) was reported in the same window; the deviation may relate to that situation — not confirmed.`
      : "No related events were found in the same window; the cause is unknown.";
  } else if (UP && metric === "PRECIP") {
    possibleExplanation = "Consistent with seasonal monsoon behavior historically — not confirmed for this instance.";
  } else if (DOWN && metric === "PRECIP") {
    possibleExplanation = ""; // drying after rain is normal; not worth a hypothesis
  }

  // Hindsight: similar anomalies in the past?
  const recall = await HindsightMemoryService.recall_related_experiences({
    eventId: latest.eventId,
    query: `${metric === "AQI" ? "air quality spike" : "heavy rainfall"} deviation from normal what happened and what were the consequences`,
    limit: 4,
    bankId: bankIdForCity(cityId),
  });

  const description =
    metric === "AQI"
      ? `Air quality index ${latest.value.toFixed(0)} vs recent baseline ${baseline.toFixed(0)} — ${UP ? "significantly elevated" : "significantly lower"} (${(ratio * 100).toFixed(0)}% of baseline).`
      : `Rainfall ${latest.value.toFixed(1)} mm/h vs recent baseline ${baseline.toFixed(1)} mm/h — ${UP ? "significantly above" : "significantly below"} baseline.`;

  const anomaly = await db.anomaly.create({
    data: {
      cityId,
      metric,
      observedValue: latest.value,
      baselineValue: baseline,
      deviation: ratio,
      direction: UP ? "UP" : "DOWN",
      description,
      status: "OPEN",
      observedFacts: JSON.stringify(observedFacts),
      possibleExplanation,
      relatedEventIds: JSON.stringify([latest.eventId, ...related.slice(0, 3).map((r) => r.id)]),
      memoryRecallJson: JSON.stringify({
        status: recall.status,
        memories: recall.experiences.slice(0, 3).map((m) => ({ id: m.id, text: m.text.slice(0, 200) })),
      }),
    },
  });

  publish("anomaly.detected", {
    anomalyId: anomaly.id,
    cityId,
    metric,
    description,
    direction: UP ? "UP" : "DOWN",
    observedValue: latest.value,
    baselineValue: baseline,
  });
}

/** Rate anomaly: event frequency spike vs the trailing week's rate. */
async function detectEventRateAnomaly(cityId: string): Promise<void> {
  if (await hasRecentAnomaly(cityId, "EVENT_RATE")) return;
  const now = Date.now();
  const windowMs = 2 * 3600_000;
  const currentCount = await db.cityEvent.count({
    where: { cityId, observedAt: { gte: new Date(now - windowMs) } },
  });
  if (currentCount < 5) return; // not interesting

  const weekAgo = new Date(now - 7 * 86400_000);
  const pastTotal = await db.cityEvent.count({
    where: { cityId, observedAt: { gte: weekAgo, lt: new Date(now - windowMs) } },
  });
  const pastRate = pastTotal / (7 * 86400_000 - windowMs) * windowMs;
  if (pastRate <= 0) return;
  if (currentCount < pastRate * 2.5) return;

  const recent = await db.cityEvent.findMany({
    where: { cityId, observedAt: { gte: new Date(now - windowMs) } },
    orderBy: { observedAt: "desc" },
    take: 6,
  });
  const typeCounts = new Map<string, number>();
  for (const e of recent) typeCounts.set(e.eventType, (typeCounts.get(e.eventType) ?? 0) + 1);
  const dominant = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  await db.anomaly.create({
    data: {
      cityId,
      metric: "EVENT_RATE",
      observedValue: currentCount,
      baselineValue: pastRate,
      deviation: currentCount / pastRate,
      direction: "UP",
      description: `${currentCount} events in the last 2 hours vs a baseline of ~${pastRate.toFixed(1)} per 2 hours — a ${(currentCount / pastRate).toFixed(1)}× frequency spike, mostly ${dominant[0]}.`,
      status: "OPEN",
      observedFacts: JSON.stringify(recent.slice(0, 5).map((e) => `${e.eventType} "${e.title}" at ${e.observedAt.toISOString().slice(0, 16)}`)),
      relatedEventIds: JSON.stringify(recent.slice(0, 4).map((e) => e.id)),
    },
  });

  publish("anomaly.detected", {
    cityId,
    metric: "EVENT_RATE",
    description: `${currentCount} events in the last 2 hours vs baseline ~${pastRate.toFixed(1)}`,
    direction: "UP",
    observedValue: currentCount,
    baselineValue: pastRate,
  });
}

/** Mark an anomaly as investigating and attach the latest observed facts. */
export async function investigateAnomaly(anomalyId: string): Promise<void> {
  await db.anomaly.update({ where: { id: anomalyId }, data: { status: "INVESTIGATING" } });
  publish("anomaly.updated", { anomalyId, status: "INVESTIGATING" });
}

export async function resolveAnomaly(anomalyId: string): Promise<void> {
  await db.anomaly.update({ where: { id: anomalyId }, data: { status: "RESOLVED", resolvedAt: new Date() } });
  publish("anomaly.updated", { anomalyId, status: "RESOLVED" });
}
