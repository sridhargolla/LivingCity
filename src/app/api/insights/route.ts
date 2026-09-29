// GET /api/insights?cityId= — concise AI insights built ONLY from verified live data,
// real stored events and Hindsight memory. Never fabricates an insight.
// Cached ~8 minutes per city (insights are reflective, not raw data). Honest degrade.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCityOverview, aqiCategory } from "@/server/conditions";
import { HindsightMemoryService } from "@/server/hindsight/HindsightMemoryService";
import { bankIdForCity } from "@/server/cities";
import { EVENT_TYPE_LABELS } from "@/server/types";

export const dynamic = "force-dynamic";

const InsightSchema = z.object({
  insights: z
    .array(
      z.object({
        text: z.string().min(4).max(280),
        basis: z.enum(["live", "memory", "event"]),
        refEventId: z.string().max(40).optional(),
      })
    )
    .max(4),
});

const globalForInsights = globalThis as unknown as {
  __livingCityInsights?: Map<string, { data: unknown; at: number }>;
};
const insightsCache = (globalForInsights.__livingCityInsights ??= new Map());
const TTL_MS = 8 * 60 * 1000;

function liveSummary(o: Awaited<ReturnType<typeof getCityOverview>>): string {
  const lines: string[] = [];
  const w = o.metrics.weather;
  if (w.status === "LIVE") {
    lines.push(`Weather: ${w.value} — ${w.detail} (observed ${w.observedAt}, source ${w.source}).`);
    if (o.weatherDetail?.forecast && o.weatherDetail.forecast.expectedMm >= 1) {
      lines.push(`Forecast: ~${o.weatherDetail.forecast.expectedMm.toFixed(1)} mm rain expected over next 6h (max prob ${o.weatherDetail.forecast.maxPrecipProb}%).`);
    }
  } else {
    lines.push(`Weather: unavailable (${w.detail}).`);
  }
  const a = o.metrics.airQuality;
  if (a.status === "LIVE") {
    lines.push(`Air quality: ${a.value} (${aqiCategory(o.airQualityDetail?.usAqi ?? null)}), ${a.detail} (observed ${a.observedAt}).`);
  } else {
    lines.push(`Air quality: unavailable.`);
  }
  lines.push(`Traffic: unavailable (no verified provider). Transit: unavailable (no verified provider).`);
  if (o.recentEvents.length === 0) {
    lines.push("No city events stored yet.");
  } else {
    for (const e of o.recentEvents.slice(0, 8)) {
      lines.push(`Event [${e.id}]: ${EVENT_TYPE_LABELS[e.eventType] ?? e.eventType} — "${e.title}" (${e.severity}, ${e.status}, observed ${e.observedAt}, source ${e.source}, origin ${e.dataOrigin}).`);
    }
  }
  if (o.alerts.length > 0) lines.push(`Active alerts: ${o.alerts.map((x) => x.title).join("; ")}.`);
  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  const cityId = req.nextUrl.searchParams.get("cityId") ?? "hyderabad";

  const cached = insightsCache.get(cityId);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return NextResponse.json(cached.data);
  }

  const overview = await getCityOverview(cityId);
  const liveBlock = liveSummary(overview);

  // Hindsight recall — real memories only; skip silently when unavailable.
  let memoryBlock = "";
  let memoryAvailable = false;
  if (overview.hindsight.available) {
    const recall = await HindsightMemoryService.recall_related_experiences({
      eventId: "insights",
      query: `current city situation ${overview.cityName} weather air quality incidents what happened before and what were the outcomes`,
      bankId: bankIdForCity(cityId),
      limit: 4,
    });
    if (recall.status === "SUCCESS" && recall.experiences.length > 0) {
      memoryAvailable = true;
      memoryBlock =
        "City memory (Hindsight, real retained experiences — may be imperfect matches):\n" +
        recall.experiences.map((m) => `- ${m.text.slice(0, 220)}`).join("\n");
    }
  }

  const significant = overview.recentEvents.filter((e) => e.severity !== "INFO" || e.status === "ACTIVE").length;
  if (!memoryAvailable && significant === 0 && overview.metrics.weather.status !== "LIVE") {
    const empty = {
      insights: [],
      degraded: false,
      note: "No significant city signals right now — insights will appear as verified data arrives.",
      generatedAt: new Date().toISOString(),
    };
    insightsCache.set(cityId, { data: empty, at: Date.now() });
    return NextResponse.json(empty);
  }

  try {
    const { getDefaultModel, chat } = await import("@/server/llm/gateway");
    const sys =
      "You are the insight engine of a city operations system. Using ONLY the data provided, output 2-3 concise insights (1 sentence each, max 200 chars). " +
      "Every insight must be directly supported by the provided live data, events, or memory. Do NOT speculate beyond it. " +
      "Set basis: 'live' for live sensor data, 'event' for stored events (set refEventId to that event's id), 'memory' for city memory. " +
      'Output JSON exactly: {"insights":[{"text":"...","basis":"live|event|memory","refEventId":"optional"}]}. No markdown, no extra keys.';
    const user = `DATA START\n${liveBlock}\n${memoryBlock || "City memory: unavailable this cycle."}\nDATA END`;
    const raw = await chat(sys, user, { model: getDefaultModel(), maxTokens: 500, temperature: 0.3 });
    const jsonText = raw.replace(/```json|```/g, "").trim();
    const parsed = InsightSchema.safeParse(JSON.parse(jsonText));

    if (!parsed.success || parsed.data.insights.length === 0) throw new Error("schema mismatch");

    // Verify event refs actually exist (LLM may only reference stored events).
    const storedIds = new Set(overview.recentEvents.map((e) => e.id));
    const insights = parsed.data.insights.filter((i) => !i.refEventId || storedIds.has(i.refEventId));

    const payload = {
      insights,
      degraded: false,
      memoryUsed: memoryAvailable,
      note: "AI-generated from verified live data, stored events and city memory only.",
      generatedAt: new Date().toISOString(),
    };
    insightsCache.set(cityId, { data: payload, at: Date.now() });
    return NextResponse.json(payload);
  } catch (e) {
    const payload = {
      insights: [],
      degraded: true,
      note: "AI insights unavailable right now — the system never substitutes invented insights.",
      error: e instanceof Error ? e.message.slice(0, 140) : "llm failed",
      generatedAt: new Date().toISOString(),
    };
    return NextResponse.json(payload); // don't cache failures
  }
}
