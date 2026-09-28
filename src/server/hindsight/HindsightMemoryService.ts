// LIVING CITY — HindsightMemoryService
//
// Dedicated service wrapping the real Hindsight memory system (vectorize-io/hindsight).
// Uses the official @vectorize-io/hindsight-client against a self-hosted Hindsight server.
//
// Methods:
//   retain_event_experience()    — store useful operational experience (not raw events)
//   recall_related_experiences() — retrieve prior experiences relevant to a current event
//   reflect_on_pattern()         — disposition-aware pattern synthesis over the memory bank
//
// Degraded mode: if Hindsight is unreachable, operations return status=UNAVAILABLE and the
// system continues running with deterministic analysis. We NEVER pretend memory was recalled.

import { HindsightClient } from "@vectorize-io/hindsight-client";
import { db } from "@/lib/db";
import { env } from "@/server/env";

export interface HindsightHealth {
  available: boolean;
  baseUrl: string;
  bankId: string;
  version?: string;
  detail?: string;
  checkedAt: string;
}

export interface RetainedExperience {
  success: boolean;
  documentId?: string;
  error?: string;
}

export interface RecalledExperience {
  id: string;
  text: string;
  type?: string | null;
  context?: string | null;
  occurredStart?: string | null;
  occurredEnd?: string | null;
  documentId?: string | null;
  score?: number | null;
}

export interface RecallOutcome {
  status: "SUCCESS" | "UNAVAILABLE";
  experiences: RecalledExperience[];
  error?: string;
}

export interface RetainInput {
  eventId: string;
  /** What happened (normalized, factual). */
  fact: string;
  /** Operational context, e.g. "monsoon downpour, Western Corridor". */
  context: string;
  /** When the event occurred (event start). */
  occurredAt: Date;
  tags: string[];
  metadata: Record<string, string>;
  /** Bank override (demo bank isolation). Defaults to the configured city bank. */
  bankId?: string;
}

export interface RecallInput {
  eventId: string;
  query: string;
  /** Optional tags to scope recall, e.g. zone + event type. */
  tags?: string[];
  limit?: number;
  /** Bank override (demo bank isolation). Defaults to the configured city bank. */
  bankId?: string;
}

/** Internal singleton client. */
let client: HindsightClient | null = null;
function getClient(): HindsightClient {
  if (!client) {
    client = new HindsightClient({
      baseUrl: env.hindsight.baseUrl,
      apiKey: env.hindsight.apiKey || undefined,
    });
  }
  return client;
}

async function logMemoryOperation(row: {
  eventId?: string | null;
  operation: "RETAIN" | "RECALL" | "REFLECT";
  status: "SUCCESS" | "FAILED" | "UNAVAILABLE";
  bankId: string;
  query?: string;
  resultCount?: number;
  detail?: unknown;
}) {
  try {
    await db.memoryOperation.create({
      data: {
        eventId: row.eventId ?? undefined,
        operation: row.operation,
        status: row.status,
        bankId: row.bankId,
        query: (row.query ?? "").slice(0, 500),
        resultCount: row.resultCount ?? 0,
        detail: JSON.stringify(sanitizeDetail(row.detail)).slice(0, 8000),
      },
    });
  } catch (e) {
    console.error("[hindsight] failed to log memory operation", e);
  }
}

function sanitizeDetail(detail: unknown): unknown {
  if (detail === undefined || detail === null) return {};
  if (typeof detail === "string") return { message: detail.slice(0, 2000) };
  try {
    const json = JSON.stringify(detail);
    return JSON.parse(json);
  } catch {
    return { message: String(detail).slice(0, 2000) };
  }
}

function mapRecallResults(results: Array<Record<string, unknown>>): RecalledExperience[] {
  return results.map((r) => ({
    id: String(r.id ?? ""),
    text: String(r.text ?? ""),
    type: (r.type as string | null) ?? null,
    context: (r.context as string | null) ?? null,
    occurredStart: (r.occurred_start as string | null) ?? null,
    occurredEnd: (r.occurred_end as string | null) ?? null,
    documentId: (r.document_id as string | null) ?? null,
    score: typeof r.score === "number" ? r.score : null,
  }));
}

export const HindsightMemoryService = {
  bankId: env.hindsight.bankId,

  /** Quick availability probe used by /api/health and /api/feeds/health. */
  async checkHealth(): Promise<HindsightHealth> {
    const base: HindsightHealth = {
      available: false,
      baseUrl: env.hindsight.baseUrl,
      bankId: env.hindsight.bankId,
      checkedAt: new Date().toISOString(),
    };
    if (!env.hindsight.enabled) {
      base.detail = "Hindsight disabled by configuration (HINDSIGHT_ENABLED=false).";
      return base;
    }
    try {
      const c = getClient();
      const version = await withTimeout(c.getVersion(), 5000);
      return { ...base, available: true, version: String((version as { version?: string })?.version ?? "unknown") };
    } catch (e) {
      return { ...base, detail: e instanceof Error ? e.message : String(e) };
    }
  },

  /**
   * RETAIN — store a useful operational experience in Hindsight.
   * Callers must pass distilled experience (facts + consequences), never raw payloads.
   */
  async retain_event_experience(input: RetainInput): Promise<RetainedExperience> {
    if (!env.hindsight.enabled) return { success: false, error: "Hindsight disabled" };
    const bankId = input.bankId ?? env.hindsight.bankId;
    try {
      const c = getClient();
      const res = await withTimeout(
        c.retain(bankId, input.fact, {
          timestamp: input.occurredAt,
          context: input.context,
          metadata: input.metadata,
          tags: input.tags,
        }),
        30000
      );
      await logMemoryOperation({
        eventId: input.eventId,
        operation: "RETAIN",
        status: "SUCCESS",
        bankId,
        query: input.fact,
        resultCount: 1,
        detail: { success: (res as { success?: boolean }).success, tags: input.tags },
      });
      return { success: true, documentId: (res as { document_id?: string }).document_id };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await logMemoryOperation({
        eventId: input.eventId,
        operation: "RETAIN",
        status: isUnavailable(e) ? "UNAVAILABLE" : "FAILED",
        bankId,
        query: input.fact,
        detail: { error: msg },
      });
      return { success: false, error: msg };
    }
  },

  /**
   * RECALL — retrieve prior city experiences relevant to the current event.
   */
  async recall_related_experiences(input: RecallInput): Promise<RecallOutcome> {
    const bankId = input.bankId ?? env.hindsight.bankId;
    if (!env.hindsight.enabled) {
      await logMemoryOperation({
        eventId: input.eventId,
        operation: "RECALL",
        status: "UNAVAILABLE",
        bankId,
        query: input.query,
        detail: { error: "Hindsight disabled" },
      });
      return { status: "UNAVAILABLE", experiences: [], error: "Hindsight disabled" };
    }
    try {
      const c = getClient();
      const res = await withTimeout(
        c.recall(bankId, input.query, {
          types: ["world", "experience", "observation"],
          maxTokens: 2048,
        }),
        30000
      );
      const raw = (res as { results?: Array<Record<string, unknown>> }).results ?? [];
      const experiences = mapRecallResults(raw).slice(0, input.limit ?? 12);
      await logMemoryOperation({
        eventId: input.eventId,
        operation: "RECALL",
        status: "SUCCESS",
        bankId,
        query: input.query,
        resultCount: experiences.length,
        detail: { experiences: experiences.slice(0, 8) },
      });
      return { status: "SUCCESS", experiences };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await logMemoryOperation({
        eventId: input.eventId,
        operation: "RECALL",
        status: isUnavailable(e) ? "UNAVAILABLE" : "FAILED",
        bankId,
        query: input.query,
        detail: { error: msg },
      });
      return { status: "UNAVAILABLE", experiences: [], error: msg };
    }
  },

  /**
   * REFLECT — disposition-aware pattern synthesis over retained city experience.
   * Falls back to null on unavailability; caller must handle degraded mode honestly.
   */
  async reflect_on_pattern(query: string): Promise<{ status: "SUCCESS" | "UNAVAILABLE"; text: string; error?: string }> {
    if (!env.hindsight.enabled) {
      return { status: "UNAVAILABLE", text: "", error: "Hindsight disabled" };
    }
    try {
      const c = getClient();
      const res = await withTimeout(c.reflect(env.hindsight.bankId, query), 60000);
      const text = String((res as { text?: string }).text ?? "");
      return { status: "SUCCESS", text };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { status: "UNAVAILABLE", text: "", error: msg };
    }
  },
};

function isUnavailable(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /fetch|ECONNREFUSED|timeout|timed out|network|404|502|503/i.test(msg);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}
