// LIVING CITY — typed API client (frontend → Next.js API routes).
"use client";

export interface PublicEvent {
  id: string;
  cityId?: string;
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

// ── Copilot / conversations ──────────────────────────────────────────────────

export interface EvidenceObject {
  claim: string;
  source: string;
  sourceName: string;
  observed_at: string;
  location: string;
  data_origin: "LIVE" | "USER_REPORTED" | "SIMULATED";
  event_id: string;
  source_url: string | null;
  coordinates: { lat: number; lon: number } | null;
  raw: Record<string, unknown>;
}

export interface ChatAction {
  type:
    | "open_event"
    | "focus_map"
    | "show_evidence"
    | "open_source"
    | "open_memory"
    | "open_historical_event"
    | "show_related_events"
    | "show_memory_graph"
    | "show_conversation"
    | "retain_memory"
    | "run_scenario";
  eventId?: string;
  url?: string;
  memoryId?: string;
  conversationId?: string;
}

export interface ChatAssistantMessage {
  id: string;
  role: "assistant";
  content: string;
  intent?: string;
  actions?: ChatAction[];
  eventRefs?: string[];
  memoryRefs?: string[];
  evidence?: EvidenceObject[];
  degraded?: boolean;
  transferred?: { cityId: string; cityName: string; text: string } | null;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  cityId: string;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview: string;
}

export interface ConversationDetail {
  id: string;
  title: string;
  cityId: string;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    intent?: string | null;
    actions?: ChatAction[];
    eventRefs?: string[];
    memoryRefs?: string[];
    evidenceRefs?: EvidenceObject[];
    degraded?: boolean;
    createdAt: string;
  }>;
}

// ── Anomalies ────────────────────────────────────────────────────────────────

export interface AnomalyRow {
  id: string;
  cityId: string;
  metric: string;
  observedValue: number;
  baselineValue: number;
  deviation: number;
  direction: string;
  description: string;
  status: string;
  observedFacts: string[];
  possibleExplanation: string;
  related: PublicEvent[];
  memoryRecall: { status?: string; memories?: Array<{ id: string; text: string }> };
  createdAt: string;
  resolvedAt: string | null;
}

// ── City learning ────────────────────────────────────────────────────────────

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

// ── Scenario ─────────────────────────────────────────────────────────────────

export interface ScenarioResult {
  id: string;
  question: string;
  assumptions: string[];
  considerations: Array<{ label: "OBSERVED" | "HISTORICAL" | "SCENARIO"; text: string }>;
  summary: string;
  memoryUsed: boolean;
  memoryCount: number;
  degraded: boolean;
  eventId: string | null;
}

// ── Simulator + city state ───────────────────────────────────────────────────

export interface SimulatorStatus {
  running: boolean;
  cityId: string;
  intervalMs: number;
  lastScenario: string | null;
  runCount: number;
}

export interface CityStateCard {
  key: string;
  label: string;
  value: string;
  level: number;
  provenance: "LIVE" | "SIMULATED" | "USER_REPORTED" | "NO_DATA";
  note: string;
}

export const api = {
  health: () => getJson<HealthResponse>("/api/health"),
  city: (cityId?: string) => getJson<CitySummary>(`/api/city${cityId ? `?cityId=${cityId}` : ""}`),
  events: (params?: { origin?: string; sinceHours?: number; limit?: number; cityId?: string }) => {
    const sp = new URLSearchParams();
    if (params?.origin) sp.set("origin", params.origin);
    if (params?.sinceHours) sp.set("sinceHours", String(params.sinceHours));
    if (params?.limit) sp.set("limit", String(params.limit));
    if (params?.cityId) sp.set("cityId", params.cityId);
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

  // ── PHASE 14: multi-city ──────────────────────────────────────────────────
  cities: () =>
    getJson<{
      cities: Array<{
        cityId: string;
        name: string;
        country: string;
        timezone: string;
        latitude: number;
        longitude: number;
        primary: boolean;
        providers: { weather: boolean; airQuality: boolean; traffic: boolean; transit: boolean };
      }>;
    }>("/api/cities"),

  // ── PHASE 4: evidence ─────────────────────────────────────────────────────
  evidence: (params?: { cityId?: string; origin?: string; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.cityId) sp.set("cityId", params.cityId);
    if (params?.origin) sp.set("origin", params.origin);
    if (params?.limit) sp.set("limit", String(params.limit));
    const qs = sp.toString();
    return getJson<{ evidence: EvidenceObject[]; count: number }>(`/api/evidence${qs ? `?${qs}` : ""}`);
  },

  // ── PHASE 5: conversations ────────────────────────────────────────────────
  conversations: (params?: { cityId?: string; q?: string }) => {
    const sp = new URLSearchParams();
    if (params?.cityId) sp.set("cityId", params.cityId);
    if (params?.q) sp.set("q", params.q);
    const qs = sp.toString();
    return getJson<{ conversations: ConversationSummary[] }>(`/api/conversations${qs ? `?${qs}` : ""}`);
  },
  createConversation: async (cityId: string) => {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cityId }),
    });
    return res.json() as Promise<{ ok: boolean; conversation: { id: string; title: string; cityId: string } }>;
  },
  conversation: (id: string) => getJson<{ conversation: ConversationDetail }>(`/api/conversations/${id}`),
  renameConversation: async (id: string, title: string) => {
    const res = await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    return res.json();
  },
  deleteConversation: async (id: string) => {
    const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    return res.json();
  },
  askCity: async (
    conversationId: string,
    message: string,
    selectedEventId?: string | null
  ) => {
    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, selectedEventId: selectedEventId ?? null }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
    return json as {
      ok: boolean;
      assistantMessage: ChatAssistantMessage;
      userMessage: { id: string; role: string; content: string; createdAt: string };
    };
  },

  // ── PHASE 12: human feedback ──────────────────────────────────────────────
  feedback: async (eventId: string, body: { verdict: string; observation?: string; note?: string }) => {
    const res = await fetch(`/api/events/${eventId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
    return json as { ok: boolean; feedbackId: string; retainedToMemory: boolean };
  },

  // ── PHASE 10: anomalies ───────────────────────────────────────────────────
  anomalies: (cityId: string, status?: string) => {
    const sp = new URLSearchParams({ cityId });
    if (status) sp.set("status", status);
    return getJson<{ anomalies: AnomalyRow[] }>(`/api/anomalies?${sp}`);
  },
  anomalyAction: async (id: string, action: "investigate" | "resolve") => {
    const res = await fetch("/api/anomalies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    return res.json();
  },

  // ── PHASE 11: city learning ───────────────────────────────────────────────
  learning: (cityId: string) => getJson<CityLearning>(`/api/city/learning?cityId=${cityId}`),

  // ── PHASE 13: scenario ────────────────────────────────────────────────────
  scenario: async (cityId: string, question: string, eventId?: string | null) => {
    const res = await fetch("/api/scenario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cityId, question, eventId: eventId ?? null }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
    return json as { ok: boolean; scenario: ScenarioResult };
  },

  // ── simulator ─────────────────────────────────────────────────────────────
  simulatorStatus: () =>
    getJson<{ status: SimulatorStatus; scenarios: Array<{ key: string; label: string }> }>("/api/simulator"),
  simulator: async (action: "start" | "stop" | "trigger", cityId: string, scenario?: string, intervalMs?: number) => {
    const res = await fetch("/api/simulator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, cityId, scenario, intervalMs }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
    return json as { ok: boolean; status?: SimulatorStatus; scenario?: string; eventIds?: string[] };
  },
  cityState: (cityId: string) =>
    getJson<{ cityId: string; cards: CityStateCard[]; simulator: SimulatorStatus; updatedAt: string }>(
      `/api/city/state?cityId=${cityId}`
    ),
};
