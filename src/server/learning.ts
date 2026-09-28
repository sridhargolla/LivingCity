// LIVING CITY — City Learning dashboard (PHASE 11).
// Every number is traceable: it links back to events, relationships, memory
// operations, or human feedback records. Nothing is invented.

import { db } from "@/lib/db";

export interface CityLearning {
  cityId: string;
  significantEvents: number;
  similarHistoricalExperiences: number;
  recurringPatterns: number;
  confirmedLessons: number;
  retainedExperiences: number;
  unresolvedQuestions: Array<{ id: string; kind: string; text: string; createdAt: string }>;
  topPatterns: Array<{ id: string; explanation: string; confidence: number; from: string; to: string; basis: string }>;
  lessons: Array<{ id: string; eventId: string; observation: string; verdict: string; note: string; retained: boolean; createdAt: string }>;
  recentMemories: Array<{ id: string; eventId: string | null; preview: string; createdAt: string }>;
  generatedAt: string;
}

export async function getCityLearning(cityId: string): Promise<CityLearning> {
  const monthAgo = new Date(Date.now() - 30 * 86400_000);

  const [significant, patterns, patternCount, confirmed, retainedCount, openAnomalies, feedbackRows, memoryRows] =
    await Promise.all([
      db.cityEvent.count({ where: { cityId, severity: { in: ["MODERATE", "MAJOR", "CRITICAL"] }, observedAt: { gte: monthAgo } } }),
      db.eventRelationship.findMany({
        where: { relation: "RECURRING_PATTERN" },
        orderBy: { confidence: "desc" },
        take: 5,
        include: { fromEvent: { select: { id: true, title: true } }, toEvent: { select: { id: true, title: true } } },
      }),
      db.eventRelationship.count({ where: { relation: "RECURRING_PATTERN" } }),
      db.humanFeedback.count({ where: { verdict: "CONFIRMED", event: { cityId } } }),
      db.memoryOperation.count({ where: { operation: "RETAIN", status: "SUCCESS" } }),
      db.anomaly.findMany({ where: { cityId, status: { in: ["OPEN", "INVESTIGATING"] } }, orderBy: { createdAt: "desc" }, take: 4 }),
      db.humanFeedback.findMany({
        where: { verdict: { in: ["CONFIRMED", "REJECTED"] }, event: { cityId } },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { event: { select: { id: true, title: true } } },
      }),
      db.memoryOperation.findMany({
        where: { operation: "RETAIN", status: "SUCCESS" },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
    ]);

  return {
    cityId,
    significantEvents: significant,
    similarHistoricalExperiences: await similarCount(cityId),
    recurringPatterns: patternCount,
    confirmedLessons: confirmed,
    retainedExperiences: retainedCount,
    unresolvedQuestions: openAnomalies.map((a) => ({
      id: a.id,
      kind: `ANOMALY:${a.metric}`,
      text: a.description,
      createdAt: a.createdAt.toISOString(),
    })),
    topPatterns: patterns.map((p) => ({
      id: p.id,
      explanation: p.explanation,
      confidence: p.confidence,
      from: p.fromEvent.title,
      to: p.toEvent.title,
      basis: p.basis,
    })),
    lessons: feedbackRows.map((f) => ({
      id: f.id,
      eventId: f.eventId,
      observation: f.observation.slice(0, 300) || f.event.title,
      verdict: f.verdict,
      note: f.note.slice(0, 200),
      retained: f.retainedToMemory,
      createdAt: f.createdAt.toISOString(),
    })),
    recentMemories: memoryRows.map((m) => ({
      id: m.id,
      eventId: m.eventId,
      preview: (m.detail ? m.detail : m.query).slice(0, 180),
      createdAt: m.createdAt.toISOString(),
    })),
    generatedAt: new Date().toISOString(),
  };
}

/** Distinct events that produced at least one successful memory recall. */
async function similarCount(cityId: string): Promise<number> {
  const rows = await db.memoryOperation.findMany({
    where: { operation: "RECALL", status: "SUCCESS", resultCount: { gt: 0 } },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { eventId: true },
  });
  return new Set(rows.filter((r) => r.eventId && r.eventId !== "copilot").map((r) => r.eventId)).size;
}
