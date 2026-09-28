// LIVING CITY — The memory loop / analysis engine.
//
// CURRENT EVENT
//   → feature extraction (deterministic)
//   → HINDSIGHT RECALL (real memory retrieval)
//   → context assembly
//   → LLM REASONING (z-ai, schema-validated, injection-defended)
//   → fallback: deterministic analysis when LLM or memory unavailable (honest degraded mode)
//   → relationship creation (deterministic + memory-informed)
//   → HINDSIGHT RETAIN (store the *experience*, not the raw event)
//   → SSE broadcast at every stage

import { db } from "@/lib/db";
import { publish } from "@/server/realtime/eventBus";
import { HindsightMemoryService } from "@/server/hindsight/HindsightMemoryService";
import { reasonAboutEvent, sanitizeUntrusted, type CityAnalysis } from "@/server/llm/reasoning";
import { EVENT_TYPE_LABELS, SEVERITY_ORDER } from "@/server/types";
import { publicEvent } from "@/server/ingestion/ingest";
import { DEMO_BANK } from "@/server/demo/scenarios";

/** In-process lock so the same event is never analyzed twice concurrently. */
const globalForLocks = globalThis as unknown as { __livingCityAnalysisLocks?: Set<string> };
const locks: Set<string> = (globalForLocks.__livingCityAnalysisLocks ??= new Set());

export function analyzeEventInBackground(eventId: string, priority = false): Promise<void> {
  if (locks.has(eventId)) return Promise.resolve();
  locks.add(eventId);
  return runAnalysis(eventId, priority).finally(() => locks.delete(eventId));
}

async function runAnalysis(eventId: string, priority: boolean): Promise<void> {
  const event = await db.cityEvent.findUnique({ where: { id: eventId } });
  if (!event) return;

  publish("analysis.started", { eventId, title: event.title });

  // ── 1. Feature extraction (deterministic) ────────────────────────────────
  const zone = event.latitude !== null && event.longitude !== null ? event.locationName : "citywide";
  const eventTypeLabel = EVENT_TYPE_LABELS[event.eventType] ?? event.eventType;

  // Demo events use an isolated demo bank so simulated experiences never
  // pollute the live city memory bank (and the before/after contrast stays clean).
  const isDemoEvent = event.source === "demo-scenarios";
  const bankId = isDemoEvent ? DEMO_BANK : undefined;

  // ── 2. HINDSIGHT RECALL ──────────────────────────────────────────────────
  const recallQuery = `${eventTypeLabel} ${zone} ${event.tags ? JSON.parse(event.tags).join(" ") : ""} what happened and what were the consequences`;
  const recall = await HindsightMemoryService.recall_related_experiences({
    eventId,
    query: recallQuery,
    limit: 12,
    bankId,
  });

  publish("memory.recalled", {
    eventId,
    status: recall.status,
    count: recall.experiences.length,
    memories: recall.experiences.slice(0, 6).map((m) => ({ id: m.id, text: m.text.slice(0, 160) })),
  });

  // ── 3+4. Context assembly + LLM reasoning ────────────────────────────────
  let analysis: CityAnalysis;
  let degraded = false;
  let memoryUsed = recall.status === "SUCCESS" && recall.experiences.length > 0;

  const reasoning = await reasonAboutEvent({
    event: {
      title: event.title,
      type: eventTypeLabel,
      severity: event.severity,
      location: event.locationName,
      description: event.description,
      observedAt: event.observedAt.toISOString(),
      dataOrigin: event.dataOrigin,
      metadataSummary: summarizeMetadata(event.metadata),
    },
    memories: recall.experiences.map((m) => ({ text: m.text, occurredStart: m.occurredStart })),
    memoryStatus: recall.status,
  });

  if (reasoning.status === "SUCCESS" && reasoning.analysis) {
    analysis = reasoning.analysis;
  } else {
    // Degraded but honest fallback — deterministic assessment, clearly flagged.
    degraded = true;
    analysis = deterministicAnalysis(event, recall.status);
    console.warn(`[analysis] degraded mode for ${eventId}: ${reasoning.status} ${reasoning.error ?? ""}`);
  }

  // ── 5. Persist analysis ──────────────────────────────────────────────────
  const saved = await db.analysisResult.upsert({
    where: { eventId },
    create: {
      eventId,
      riskLevel: analysis.risk_level,
      summary: analysis.summary,
      risks: JSON.stringify(analysis.risks),
      recommendations: JSON.stringify(analysis.recommendations),
      historicalBasis: JSON.stringify(recall.experiences.slice(0, 8).map((m) => m.id)),
      memoryUsed,
      memoryCount: recall.experiences.length,
      degraded,
      rawJson: JSON.stringify({ analysis, recallStatus: recall.status }),
    },
    update: {
      riskLevel: analysis.risk_level,
      summary: analysis.summary,
      risks: JSON.stringify(analysis.risks),
      recommendations: JSON.stringify(analysis.recommendations),
      historicalBasis: JSON.stringify(recall.experiences.slice(0, 8).map((m) => m.id)),
      memoryUsed,
      memoryCount: recall.experiences.length,
      degraded,
      rawJson: JSON.stringify({ analysis, recallStatus: recall.status }),
    },
  });

  // ── 6. Relationships (deterministic + memory-informed) ───────────────────
  const relations = await buildRelationships(event, recall, analysis);
  for (const r of relations) {
    try {
      await db.eventRelationship.upsert({
        where: { fromEventId_toEventId_relation: { fromEventId: r.fromEventId, toEventId: r.toEventId, relation: r.relation } },
        create: r,
        update: { confidence: r.confidence, explanation: r.explanation, basis: r.basis },
      });
      publish("event.relationship.created", {
        fromEventId: r.fromEventId,
        toEventId: r.toEventId,
        relation: r.relation,
        confidence: r.confidence,
      });
    } catch {
      // unique race — harmless
    }
  }

  publish("analysis.completed", {
    eventId,
    riskLevel: saved.riskLevel,
    summary: saved.summary.slice(0, 240),
    degraded,
    memoryCount: saved.memoryCount,
    analysisId: saved.id,
  });

  // ── 7. HINDSIGHT RETAIN — only when analysis has something worth keeping ─
  await retainExperience(event, analysis, recall, degraded, priority, bankId);
}

function summarizeMetadata(metaJson: string): string {
  try {
    const m = JSON.parse(metaJson) as Record<string, unknown>;
    const keys = ["precipMm", "temperatureC", "humidityPct", "windKmh", "usAqi", "pm25", "pm10", "zone", "category", "categoryName", "weatherDesc", "forecastMaxProb", "expectedMm"];
    const parts: string[] = [];
    for (const k of keys) {
      if (m[k] !== undefined && m[k] !== null) parts.push(`${k}=${m[k]}`);
    }
    return parts.join(", ") || "none";
  } catch {
    return "none";
  }
}

function deterministicAnalysis(
  event: { eventType: string; severity: string; locationName: string; title: string; description: string; dataOrigin: string },
  recallStatus: "SUCCESS" | "UNAVAILABLE"
): CityAnalysis {
  const sev = SEVERITY_ORDER[event.severity] ?? 0;
  const risk = sev >= 3 ? "HIGH" : sev === 2 ? "ELEVATED" : sev === 1 ? "LOW" : "NONE";
  const label = EVENT_TYPE_LABELS[event.eventType] ?? event.eventType;
  const memoryNote =
    recallStatus === "UNAVAILABLE"
      ? "Hindsight memory temporarily unavailable — assessment based on current conditions only."
      : "No related historical memories were available for this situation.";
  return {
    risk_level: risk,
    summary: `Deterministic assessment (degraded mode — reasoning engine offline): ${label} reported for ${event.locationName}. Severity ${event.severity}. ${memoryNote}`,
    risks: sev >= 2 ? ["Possible local disruption based on current severity"] : [],
    recommendations: sev >= 2 ? ["Monitor the situation", "Verify conditions on the ground"] : ["No action required at this time"],
    historical_comparison: {
      similar_past_situations: 0,
      recurring_outcomes: [],
      differences_now: [],
      cautious_note: "Without memory recall, no historical association can be claimed.",
    },
    relationship: "NOVEL",
  };
}

/** Deterministic relationship mining + memory-informed escalation detection. */
async function buildRelationships(
  event: { id: string; eventType: string; latitude: number | null; longitude: number | null; locationName: string; startedAt: Date; severity: string },
  recall: { status: string; experiences: Array<{ id: string; text: string; documentId?: string | null }> },
  analysis: CityAnalysis
) {
  type Rel = {
    fromEventId: string;
    toEventId: string;
    relation: string;
    confidence: number;
    explanation: string;
    basis: string;
  };
  const rels: Rel[] = [];

  // A. Same-type recurring pattern: same event type within 10km within 30 days.
  const since = new Date(event.startedAt.getTime() - 30 * 24 * 3600 * 1000);
  const recentSameType = await db.cityEvent.findMany({
    where: {
      id: { not: event.id },
      eventType: event.eventType,
      startedAt: { gte: since, lt: event.startedAt },
    },
    orderBy: { startedAt: "desc" },
    take: 5,
  });

  for (const prior of recentSameType.slice(0, 3)) {
    const distKm = haversineKm(event.latitude, event.longitude, prior.latitude, prior.longitude);
    const near = distKm === null || distKm <= 10;
    rels.push({
      fromEventId: event.id,
      toEventId: prior.id,
      relation: "RECURRING_PATTERN",
      confidence: near ? 0.75 : 0.55,
      explanation: near
        ? `Same event type (${EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}) observed ${prior.startedAt.toISOString().slice(0, 10)} within ${distKm === null ? "the city" : `${distKm.toFixed(1)} km`} — recurring pattern.`
        : `Same event type observed elsewhere in the city on ${prior.startedAt.toISOString().slice(0, 10)}.`,
      basis: "deterministic",
    });
  }

  // B. Causal-chain candidates: prior events in the same zone in the previous 24h of a
  //    different type are RELATED (e.g., rain → waterlogging).
  const dayBefore = new Date(event.startedAt.getTime() - 24 * 3600 * 1000);
  const priorDifferentType = await db.cityEvent.findMany({
    where: {
      id: { not: event.id },
      startedAt: { gte: dayBefore, lt: event.startedAt },
      status: { not: "RESOLVED" },
    },
    orderBy: { startedAt: "desc" },
    take: 8,
  });
  for (const prior of priorDifferentType.slice(0, 3)) {
    const distKm = haversineKm(event.latitude, event.longitude, prior.latitude, prior.longitude);
    if (distKm !== null && distKm > 12) continue;
    rels.push({
      fromEventId: event.id,
      toEventId: prior.id,
      relation: "RELATED",
      confidence: 0.5,
      explanation: `Occurred within 24h ${distKm !== null ? `and ${distKm.toFixed(1)} km` : "in the same area"} of "${prior.title}" — possible connection.`,
      basis: "deterministic",
    });
  }

  // C. Memory-informed escalation: if the LLM (with memory) flagged POSSIBLE_ESCALATION or
  //    RECURRING_PATTERN, link to the most similar memory-derived prior event if resolvable.
  if (analysis.relationship === "POSSIBLE_ESCALATION" && recall.status === "SUCCESS") {
    const first = recall.experiences[0];
    if (first?.documentId) {
      const priorEvent = await db.cityEvent.findFirst({ where: { id: first.documentId } }).catch(() => null);
      if (priorEvent) {
        rels.push({
          fromEventId: event.id,
          toEventId: priorEvent.id,
          relation: "POSSIBLE_ESCALATION",
          confidence: 0.65,
          explanation: "Memory recall matched this prior experience; current conditions resemble an escalation pattern.",
          basis: "memory",
        });
      }
    }
  }

  return rels;
}

/**
 * RETAIN — distill the event + analysis into durable city experience.
 * We store operational experience (what happened, consequences, pattern notes),
 * NOT raw payloads. documentId = city event id → memory↔event linkage.
 */
async function retainExperience(
  event: { id: string; eventType: string; title: string; locationName: string; severity: string; description: string; dataOrigin: string; startedAt: Date },
  analysis: CityAnalysis,
  recall: { status: string; experiences: Array<{ id: string; text: string }> },
  degraded: boolean,
  priority: boolean,
  bankId?: string
) {
  // Only retain when there is signal: severity MINOR+ or memory-informed analysis.
  const sev = SEVERITY_ORDER[event.severity] ?? 0;
  if (sev === 0 && !priority && analysis.risk_level === "NONE") return;

  const parts: string[] = [];
  parts.push(
    `On ${event.startedAt.toISOString().slice(0, 16)} (IST), ${event.title} — ${EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}, severity ${event.severity}, location ${event.locationName} (origin: ${event.dataOrigin}).`
  );
  if (event.description) parts.push(`Conditions: ${sanitizeUntrusted(event.description).slice(0, 400)}`);
  if (analysis.risk_level !== "NONE") parts.push(`Assessed risk: ${analysis.risk_level}.`);
  if (analysis.historical_comparison.recurring_outcomes.length > 0) {
    parts.push(`Historically associated with: ${analysis.historical_comparison.recurring_outcomes.slice(0, 3).join("; ")}.`);
  }
  if (analysis.historical_comparison.similar_past_situations > 0) {
    parts.push(`${analysis.historical_comparison.similar_past_situations} similar past situation(s) informed this assessment.`);
  }
  if (analysis.recommendations.length > 0) parts.push(`Recommended: ${analysis.recommendations.slice(0, 2).join("; ")}.`);

  const fact = parts.join(" ");
  const tags = [
    `type:${event.eventType}`,
    `severity:${event.severity}`,
    `zone:${event.locationName}`,
    `origin:${event.dataOrigin}`,
  ];

  const res = await HindsightMemoryService.retain_event_experience({
    eventId: event.id,
    fact,
    context: `Living City operational experience — Hyderabad ${EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}`,
    occurredAt: event.startedAt,
    tags,
    metadata: {
      eventId: event.id,
      eventType: event.eventType,
      severity: event.severity,
      riskLevel: analysis.risk_level,
      location: event.locationName,
    },
    bankId,
  });

  if (res.success) {
    // Link event → its retained memory so the operator sees "what was learned".
    await db.cityEvent.update({
      where: { id: event.id },
      data: { sourceEventId: event.sourceEventId, status: event.status },
    }).catch(() => undefined);
  }

  publish("memory.retained", {
    eventId: event.id,
    success: res.success,
    error: res.error,
    factPreview: fact.slice(0, 220),
  });
}

function haversineKm(aLat: number | null, aLon: number | null, bLat: number | null, bLon: number | null): number | null {
  if (aLat === null || aLon === null || bLat === null || bLon === null) return null;
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export { publicEvent };
