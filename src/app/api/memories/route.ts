// GET /api/memories?cityId=&q=&limit= — the Memories page data source.
//
// Memory items come from REAL stored city experience:
//   1. Hindsight bank recall (vector search over retained experiences) — primary.
//   2. Retain-log fallback (MemoryOperation rows with the retained fact) — always
//      available, honest about the degraded state when Hindsight is unreachable.
//
// We never fabricate a memory. When nothing is stored, we say so.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HindsightMemoryService } from "@/server/hindsight/HindsightMemoryService";
import { bankIdForCity, getCityConfig } from "@/server/cities";

export const dynamic = "force-dynamic";

export interface MemoryItem {
  id: string;
  text: string;
  context: string | null;
  occurredStart: string | null;
  occurredEnd: string | null;
  eventId: string | null;
  /** hindsight = retrieved from the Hindsight bank; retain-log = stored retain record */
  storage: "hindsight" | "retain-log";
  score: number | null;
  tags: string[];
  createdAt: string;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const cityId = sp.get("cityId") ?? "hyderabad";
  const q = (sp.get("q") ?? "").trim().slice(0, 160);
  const limit = Math.min(Number(sp.get("limit") ?? 40) || 40, 80);

  const cfg = getCityConfig(cityId);
  const items: MemoryItem[] = [];

  // 1) Hindsight recall (search or browse).
  let hindsightAvailable = false;
  let hindsightError: string | null = null;
  try {
    const health = await HindsightMemoryService.checkHealth();
    hindsightAvailable = health.available;
    if (!health.available) hindsightError = health.detail ?? "unavailable";
  } catch (e) {
    hindsightError = e instanceof Error ? e.message : "probe failed";
  }

  if (hindsightAvailable) {
    const recall = await HindsightMemoryService.recall_related_experiences({
      eventId: "memories-page",
      query: q || `${cfg.name} city events weather rain traffic flooding air quality outcomes lessons what happened`,
      bankId: bankIdForCity(cityId),
      limit,
    });
    if (recall.status === "SUCCESS") {
      for (const r of recall.experiences) {
        items.push({
          id: r.documentId ?? r.id,
          text: r.text,
          context: r.context,
          occurredStart: r.occurredStart,
          occurredEnd: r.occurredEnd,
          eventId: null,
          storage: "hindsight",
          score: r.score,
          tags: [],
          createdAt: r.occurredStart ?? new Date().toISOString(),
        });
      }
    } else {
      hindsightError = recall.error ?? "recall failed";
    }
  }

  // 2) Retain log (durable record of what was retained, when, for which event).
  const retains = await db.memoryOperation.findMany({
    where: { operation: "RETAIN", status: "SUCCESS", ...(q ? { query: { contains: q } } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  const retainedIds = new Set(items.map((i) => `${i.text.slice(0, 80)}`));
  for (const r of retains) {
    let detail: Record<string, unknown> = {};
    try {
      detail = JSON.parse(r.detail) as Record<string, unknown>;
    } catch {
      /* keep empty */
    }
    const text = r.query;
    if (!text || retainedIds.has(text.slice(0, 80))) continue;
    retainedIds.add(text.slice(0, 80));
    items.push({
      id: r.id,
      text,
      context: (detail.tags as string[] | undefined)?.join(", ") ?? null,
      occurredStart: r.createdAt.toISOString(),
      occurredEnd: null,
      eventId: r.eventId,
      storage: "retain-log",
      score: null,
      tags: (detail.tags as string[] | undefined) ?? [],
      createdAt: r.createdAt.toISOString(),
    });
  }

  return NextResponse.json({
    cityId,
    query: q || null,
    hindsight: { available: hindsightAvailable, bankId: bankIdForCity(cityId), error: hindsightError },
    total: items.length,
    items: items.slice(0, limit),
    note: hindsightAvailable
      ? "Memories are real retained city experiences from Hindsight."
      : "Hindsight is unreachable — showing the durable retain log only. Nothing is invented.",
  });
}
