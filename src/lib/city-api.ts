// LIVING CITY — typed API client (frontend → Next.js API routes).
"use client";

export interface PublicEvent {
  id: string;
  source: string;
  dataOrigin: "LIVE" | "SIMULATED" | "USER_REPORTED";
  eventType: string;
  title: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  locationName: string;
  severity: string;
  confidence: number;
  status: string;
  startedAt: string;
  observedAt: string;
  resolvedAt: string | null;
  tags: string[];
  createdAt: string;
}

export interface EventAnalysis {
  id: string;
  riskLevel: string;
  summary: string;
  risks: string[];
  recommendations: string[];
  memoryUsed: boolean;
  memoryCount: number;
  degraded: boolean;
  createdAt: string;
}

export interface EventOutcomeRow {
  id: string;
  outcomeType: string;
  description: string;
  severity: string;
  source: string;
  createdAt: string;
}

export interface MemoryExperience {
  id: string;
  text: string;
  type?: string | null;
  context?: string | null;
  occurredStart?: string | null;
  occurredEnd?: string | null;
  documentId?: string | null;
  score?: number | null;
}

export interface MemoryStats {
  cityMemory: {
    hindsightAvailable: boolean;
    hindsightVersion: string | null;
    bankId: string;
    memoryOperations: number;
    eventsRemembered: number;
    retains: number;
    recalls: number;
    patternsDiscovered: number;
    relationshipsMapped: number;
    lastMemoryUpdate: string | null;
    lastMemoryUpdateStatus: string | null;
    bankMemoryCount: number | null;
  };
}

export interface FeedStatus {
  feedId: string;
  status: "HEALTHY" | "DEGRADED" | "FAILED" | "DORMANT";
  lastRunAt: string | null;
  durationMs: number | null;
  lastError: string | null;
  note: string;
}

export interface CitySummary {
  city: string;
  stats: {
    active: number;
    developing: number;
    resolved: number;
    total: number;
    byOrigin: { LIVE: number; SIMULATED: number; USER_REPORTED: number };
  };
  recent: Array<{ id: string; title: string; eventType: string; severity: string; dataOrigin: string; observedAt: string }>;
  time: string;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => "")}`.slice(0, 200));
  return res.json() as Promise<T>;
}

export interface HealthResponse {
  ok: boolean;
  service: string;
  city: string;
  time: string;
  hindsight: { available: boolean; baseUrl: string; bankId: string; version?: string; detail?: string };
  database: { ok: boolean; eventCount: number };
}

export const api = {
  health: () => getJson<HealthResponse>("/api/health"),
  city: () => getJson<CitySummary>("/api/city"),
  events: (params?: { origin?: string; sinceHours?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.origin) sp.set("origin", params.origin);
    if (params?.sinceHours) sp.set("sinceHours", String(params.sinceHours));
    if (params?.limit) sp.set("limit", String(params.limit));
    const qs = sp.toString();
    return getJson<{ events: PublicEvent[]; count: number }>(`/api/events${qs ? `?${qs}` : ""}`);
  },
  event: (id: string) =>
    getJson<{ event: PublicEvent; analysis: EventAnalysis | null; outcomes: EventOutcomeRow[] }>(`/api/events/${id}`),
  eventMemory: (id: string) =>
    getJson<{
      eventId: string;
      memoryStatus: "AVAILABLE" | "UNAVAILABLE";
      recalled: MemoryExperience[];
      retainedFact: string | null;
      operations: Array<{ id: string; operation: string; status: string; resultCount: number; createdAt: string }>;
    }>(`/api/events/${id}/memory`),
  eventRelationships: (id: string) =>
    getJson<{
      focus: PublicEvent;
      edges: Array<{
        id: string;
        relation: string;
        confidence: number;
        explanation: string;
        basis: string;
        direction: "outgoing" | "incoming";
        other: PublicEvent;
      }>;
    }>(`/api/events/${id}/relationships`),
  timeline: (days = 14, origin?: string) => {
    const sp = new URLSearchParams({ days: String(days) });
    if (origin) sp.set("origin", origin);
    return getJson<{
      timeline: { past: PublicEvent[]; current: PublicEvent[] };
      windowDays: number;
    }>(`/api/city/timeline?${sp}`);
  },
  patterns: () =>
    getJson<{
      patterns: Array<{
        id: string;
        relation: string;
        confidence: number;
        explanation: string;
        basis: string;
        createdAt: string;
        from: { id: string; title: string; eventType: string; observedAt: string };
        to: { id: string; title: string; eventType: string; observedAt: string };
      }>;
      relationshipCounts: Array<{ relation: string; count: number }>;
      eventTypeCounts: Array<{ eventType: string; count: number }>;
    }>("/api/city/patterns"),
  memoryStats: () => getJson<MemoryStats>("/api/memory/stats"),
  memoryOperations: (limit = 12) =>
    getJson<{
      operations: Array<{
        id: string;
        eventId: string | null;
        operation: string;
        status: string;
        resultCount: number;
        query: string;
        detail: Record<string, unknown>;
        createdAt: string;
      }>;
    }>(`/api/memory/operations?limit=${limit}`),
  feeds: () => getJson<{ feeds: FeedStatus[]; lastRunAt: string | null }>("/api/feeds"),
  report: async (body: {
    description: string;
    category: string;
    latitude?: number | null;
    longitude?: number | null;
    locationName?: string;
    severity?: string;
  }) => {
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
    return json as { ok: boolean; eventId: string };
  },
  demoSeed: async () => {
    const res = await fetch("/api/demo/seed", { method: "POST" });
    return res.json();
  },
  demoBeforeAfter: async () => {
    const res = await fetch("/api/demo/before-after", { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
    return json as { steps: Array<{ step: string; description: string; eventId?: string; analysis?: { summary: string; riskLevel: string; memoryUsed: boolean; memoryCount: number; degraded: boolean; recurringOutcomes: string[]; similarPastSituations: number } | null; outcomeRecorded?: string; retained?: boolean }>; error?: string };
  },
};
