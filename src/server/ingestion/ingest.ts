// LIVING CITY — Ingestion pipeline:
// NORMALIZE → DEDUPLICATE → STORE → PUBLISH SSE → TRIGGER ANALYSIS (async)

import { db } from "@/lib/db";
import { buildNormalizedEvent, type NormalizedEvent } from "./normalize";
import { publish } from "@/server/realtime/eventBus";
import { analyzeEventInBackground } from "@/server/analysis/analyzeEvent";
import type { FeedId } from "@/server/types";

export interface IngestResult {
  accepted: number;
  duplicates: number;
  eventIds: string[];
}

export interface CandidateInput {
  source: string;
  sourceEventId?: string | null;
  dataOrigin: "LIVE" | "SIMULATED" | "USER_REPORTED";
  eventType: string;
  title: string;
  description?: string;
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string;
  severity?: string;
  confidence?: number;
  status?: string;
  startedAt?: Date;
  observedAt?: Date;
  tags?: string[];
  metadata?: Record<string, unknown>;
  /** user reports skip the auto-analysis cooldown as they're inherently unique */
  analysisPriority?: "high" | "normal";
  /** Optional dedup salt (demo runs must not dedupe against each other). */
  fingerprintSalt?: string;
}

/**
 * Ingest a batch of candidates. Deduplicates by fingerprint (source|type|severity-band|day|grid).
 * Analysis runs in the background — ingestion is never blocked by LLM/Hindsight latency.
 */
export async function ingestCandidates(feedId: FeedId, candidates: CandidateInput[]): Promise<IngestResult> {
  const started = Date.now();
  let accepted = 0;
  let duplicates = 0;
  const eventIds: string[] = [];

  for (const c of candidates) {
    const normalized: NormalizedEvent | null = buildNormalizedEvent(c);
    if (!normalized) continue;
    try {
      const created = await db.cityEvent.create({ data: toPrismaData(normalized) });
      accepted += 1;
      eventIds.push(created.id);
      publish("event.created", { event: publicEvent(created) });
      // Fire-and-forget analysis with bounded separation to avoid thundering-herd LLM calls.
      const delay = accepted === 1 ? 0 : 1500 * (accepted - 1);
      setTimeout(() => {
        analyzeEventInBackground(created.id, c.analysisPriority === "high").catch((e) =>
          console.error(`[ingest] analysis crashed for ${created.id}`, e)
        );
      }, delay);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/Unique constraint/.test(msg) || /P2002/.test(msg)) {
        duplicates += 1;
      } else {
        console.error(`[ingest] failed to store event: ${msg}`);
      }
    }
  }

  await db.feedRun.create({
    data: {
      feedId,
      status: "HEALTHY",
      durationMs: Date.now() - started,
      eventsFound: candidates.length,
      eventsNew: accepted,
    },
  });

  return { accepted, duplicates, eventIds };
}

function toPrismaData(n: NormalizedEvent) {
  return {
    source: n.source,
    sourceEventId: n.sourceEventId,
    dataOrigin: n.dataOrigin,
    eventType: n.eventType,
    title: n.title,
    description: n.description,
    latitude: n.latitude,
    longitude: n.longitude,
    locationName: n.locationName,
    severity: n.severity,
    confidence: n.confidence,
    status: n.status,
    startedAt: n.startedAt,
    observedAt: n.observedAt,
    tags: JSON.stringify(n.tags),
    metadata: JSON.stringify(n.metadata),
    fingerprint: n.fingerprint,
  };
}

/** Serialize an event row for public consumption (never leak raw payloads wholesale). */
export function publicEvent(e: {
  id: string;
  source: string;
  dataOrigin: string;
  eventType: string;
  title: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  locationName: string;
  severity: string;
  confidence: number;
  status: string;
  startedAt: Date;
  observedAt: Date;
  resolvedAt: Date | null;
  tags: string;
  createdAt: Date;
}) {
  let tags: string[] = [];
  try {
    tags = JSON.parse(e.tags);
  } catch {}
  return {
    id: e.id,
    source: e.source,
    dataOrigin: e.dataOrigin,
    eventType: e.eventType,
    title: e.title,
    description: e.description,
    latitude: e.latitude,
    longitude: e.longitude,
    locationName: e.locationName,
    severity: e.severity,
    confidence: e.confidence,
    status: e.status,
    startedAt: e.startedAt.toISOString(),
    observedAt: e.observedAt.toISOString(),
    resolvedAt: e.resolvedAt ? e.resolvedAt.toISOString() : null,
    tags,
    createdAt: e.createdAt.toISOString(),
  };
}
export type PublicEvent = ReturnType<typeof publicEvent>;

/** Record a feed failure honestly (shows DEGRADED/FAILED in feed health). */
export async function recordFeedFailure(feedId: FeedId, error: string, durationMs: number) {
  try {
    await db.feedRun.create({
      data: { feedId, status: "FAILED", durationMs, error: error.slice(0, 500), eventsFound: 0, eventsNew: 0 },
    });
  } catch (e) {
    console.error("[ingest] failed to record feed failure", e);
  }
}
