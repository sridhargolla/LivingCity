// GET  /api/settings — configuration surface: cities, data sources, AI, Hindsight, privacy prefs.
// PATCH /api/settings — update active city / operator preferences.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { CITY_REGISTRY, bankIdForCity, getCityConfig } from "@/server/cities";
import { HindsightMemoryService } from "@/server/hindsight/HindsightMemoryService";
import { getFeedStatuses } from "@/server/ingestion/runFeeds";
import { AI_PROVIDER_INFO, getDefaultModel } from "@/server/llm/gateway";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";

const ACTIVE_CITY_KEY = "activeCity";
const PREFS_KEY = "prefs";

async function readSetting(key: string): Promise<Record<string, unknown>> {
  const row = await db.appSetting.findUnique({ where: { key } });
  if (!row) return {};
  try {
    return JSON.parse(row.value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function writeSetting(key: string, value: Record<string, unknown>): Promise<void> {
  await db.appSetting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(value) },
    update: { value: JSON.stringify(value) },
  });
}

export async function GET() {
  const [activeCity, prefs, hindsight, feeds, convCount, cityCounts] = await Promise.all([
    readSetting(ACTIVE_CITY_KEY),
    readSetting(PREFS_KEY),
    HindsightMemoryService.checkHealth(),
    getFeedStatuses(),
    db.conversation.count(),
    db.cityEvent.groupBy({ by: ["cityId"], _count: true }),
  ]);

  const cities = CITY_REGISTRY.map((c) => ({
    ...c,
    storedEvents: cityCounts.find((x) => x.cityId === c.cityId)?._count ?? 0,
  }));

  const providers = feeds.map((f) => ({
    feedId: f.feedId,
    status: f.status,
    lastRunAt: f.lastRunAt,
    lastError: f.lastError,
    note: f.note,
    durationMs: f.durationMs,
  }));

  return NextResponse.json({
    activeCityId: (activeCity.cityId as string) ?? "hyderabad",
    cities,
    providers,
    ai: { ...AI_PROVIDER_INFO, model: getDefaultModel() },
    hindsight: {
      available: hindsight.available,
      baseUrl: hindsight.baseUrl,
      bankId: bankIdForCity((activeCity.cityId as string) ?? "hyderabad"),
      version: hindsight.version ?? null,
      detail: hindsight.detail ?? null,
      configuredBankDefault: env.hindsight.bankId,
    },
    privacy: {
      conversationsStored: convCount,
      conversationHistoryEnabled: (prefs.conversationHistoryEnabled as boolean) ?? true,
      memoryRetentionEnabled: (prefs.memoryRetentionEnabled as boolean) ?? true,
    },
    notifications: {
      browserAlertsEnabled: (prefs.browserAlertsEnabled as boolean) ?? false,
    },
  });
}

const PatchSchema = z.object({
  activeCityId: z.string().max(40).optional(),
  prefs: z
    .object({
      conversationHistoryEnabled: z.boolean().optional(),
      memoryRetentionEnabled: z.boolean().optional(),
      browserAlertsEnabled: z.boolean().optional(),
    })
    .optional(),
});

export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  if (parsed.data.activeCityId) {
    const cfg = getCityConfig(parsed.data.activeCityId);
    await writeSetting(ACTIVE_CITY_KEY, { cityId: cfg.cityId });
  }
  if (parsed.data.prefs) {
    const current = await readSetting(PREFS_KEY);
    await writeSetting(PREFS_KEY, { ...current, ...parsed.data.prefs });
  }

  return NextResponse.json({ ok: true });
}
