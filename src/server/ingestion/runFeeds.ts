// LIVING CITY — Feed orchestrator (PHASE 14: multi-city aware).
// Runs every provider for every configured city with error isolation.
// If one source fails, the others continue (feed health recorded honestly).

import { db } from "@/lib/db";
import { publish } from "@/server/realtime/eventBus";
import { ingestCandidates, recordFeedFailure } from "./ingest";
import { fetchOpenMeteo, openMeteoToEvents } from "./providers/open-meteo";
import { fetchAirQuality, airQualityToEvents } from "./providers/open-meteo-air-quality";
import { fetchWttr, wttrToEvents } from "./providers/wttr-in";
import { fetchOpenWeather } from "./providers/openweather";
import { CITY_REGISTRY, getCityConfig } from "@/server/cities";
import type { FeedId } from "@/server/types";

export interface FeedStatus {
  feedId: string;
  status: "HEALTHY" | "DEGRADED" | "FAILED" | "DORMANT";
  lastRunAt: string | null;
  durationMs: number | null;
  lastError: string | null;
  note: string;
}

const globalForFeeds = globalThis as unknown as {
  __livingCityFeeds?: { running: boolean; lastRunAt: string | null; lastStatuses: Map<string, FeedStatus> };
};

const feeds = (globalForFeeds.__livingCityFeeds ??= {
  running: false,
  lastRunAt: null,
  lastStatuses: new Map(),
});

export async function runAllFeeds(): Promise<void> {
  if (feeds.running) return;
  feeds.running = true;
  try {
    for (const cityCfg of CITY_REGISTRY) {
      await runCityFeeds(cityCfg.cityId);
    }
    feeds.lastRunAt = new Date().toISOString();
  } finally {
    feeds.running = false;
  }
}

async function runCityFeeds(cityId: string): Promise<void> {
  const city = getCityConfig(cityId);
  const keyPrefix = cityId === "hyderabad" ? "" : `${cityId}:`;
  const citywide = `${city.name} (citywide)`;

  // ── Open-Meteo weather (primary) ────────────────────────────────────────
  const om = await fetchOpenMeteo(city.latitude, city.longitude);
  if (om.ok && om.data) {
    const events = openMeteoToEvents(om.data, city.name);
    const r = await ingestCandidates(
      "open-meteo",
      events.map((e) => ({
        ...e,
        source: "open-meteo",
        dataOrigin: "LIVE" as const,
        cityId,
        latitude: city.latitude,
        longitude: city.longitude,
        locationName: citywide,
        observedAt: new Date(),
      }))
    );
    feeds.lastStatuses.set(`${keyPrefix}open-meteo`, {
      feedId: `${keyPrefix}open-meteo`,
      status: "HEALTHY",
      lastRunAt: new Date().toISOString(),
      durationMs: om.durationMs,
      lastError: null,
      note: `${r.accepted} new / ${r.duplicates} duplicate of ${events.length} signal(s)`,
    });
  } else {
    await recordFeedFailure("open-meteo", om.error ?? "unknown", om.durationMs);
    feeds.lastStatuses.set(`${keyPrefix}open-meteo`, {
      feedId: `${keyPrefix}open-meteo`,
      status: "FAILED",
      lastRunAt: new Date().toISOString(),
      durationMs: om.durationMs,
      lastError: om.error ?? null,
      note: `${city.name}: will retry on next poll; other feeds unaffected`,
    });
  }
  publish("feed.status_changed", { feedId: `${keyPrefix}open-meteo`, cityId, status: feeds.lastStatuses.get(`${keyPrefix}open-meteo`)?.status });

  // ── Air quality (real, verified) ────────────────────────────────────────
  const aq = await fetchAirQuality(city.latitude, city.longitude);
  if (aq.ok && aq.data) {
    const events = airQualityToEvents(aq.data, city.name);
    const r = await ingestCandidates(
      "open-meteo-air-quality",
      events.map((e) => ({
        ...e,
        source: "open-meteo-air-quality",
        dataOrigin: "LIVE" as const,
        cityId,
        latitude: city.latitude,
        longitude: city.longitude,
        locationName: citywide,
        observedAt: new Date(),
      }))
    );
    feeds.lastStatuses.set(`${keyPrefix}open-meteo-air-quality`, {
      feedId: `${keyPrefix}open-meteo-air-quality`,
      status: "HEALTHY",
      lastRunAt: new Date().toISOString(),
      durationMs: aq.durationMs,
      lastError: null,
      note: `${r.accepted} new / ${r.duplicates} duplicate`,
    });
  } else {
    await recordFeedFailure("open-meteo-air-quality", aq.error ?? "unknown", aq.durationMs);
    feeds.lastStatuses.set(`${keyPrefix}open-meteo-air-quality`, {
      feedId: `${keyPrefix}open-meteo-air-quality`,
      status: "FAILED",
      lastRunAt: new Date().toISOString(),
      durationMs: aq.durationMs,
      lastError: aq.error ?? null,
      note: `${city.name}: will retry`,
    });
  }
  publish("feed.status_changed", { feedId: `${keyPrefix}open-meteo-air-quality`, cityId, status: feeds.lastStatuses.get(`${keyPrefix}open-meteo-air-quality`)?.status });

  // ── wttr.in fallback (runs when primary weather failed) ─────────────────
  const omStatus = feeds.lastStatuses.get(`${keyPrefix}open-meteo`)?.status;
  if (omStatus !== "HEALTHY") {
    const wt = await fetchWttr(city.latitude, city.longitude);
    if (wt.ok && wt.data) {
      const events = wttrToEvents(wt.data, city.name);
      const r = await ingestCandidates(
        "wttr-in",
        events.map((e) => ({
          ...e,
          source: "wttr.in",
          dataOrigin: "LIVE" as const,
          cityId,
          latitude: city.latitude,
          longitude: city.longitude,
          locationName: citywide,
          observedAt: new Date(),
        }))
      );
      feeds.lastStatuses.set(`${keyPrefix}wttr-in`, {
        feedId: `${keyPrefix}wttr-in`,
        status: "HEALTHY",
        lastRunAt: new Date().toISOString(),
        durationMs: wt.durationMs,
        lastError: null,
        note: `fallback active; ${r.accepted} new`,
      });
    } else {
      await recordFeedFailure("wttr-in", wt.error ?? "unknown", wt.durationMs);
      feeds.lastStatuses.set(`${keyPrefix}wttr-in`, {
        feedId: `${keyPrefix}wttr-in`,
        status: "FAILED",
        lastRunAt: new Date().toISOString(),
        durationMs: wt.durationMs,
        lastError: wt.error ?? null,
        note: `fallback provider also failed`,
      });
    }
    publish("feed.status_changed", { feedId: `${keyPrefix}wttr-in`, cityId, status: feeds.lastStatuses.get(`${keyPrefix}wttr-in`)?.status });
  } else {
    feeds.lastStatuses.set(`${keyPrefix}wttr-in`, {
      feedId: `${keyPrefix}wttr-in`,
      status: "DORMANT",
      lastRunAt: feeds.lastStatuses.get(`${keyPrefix}wttr-in`)?.lastRunAt ?? null,
      durationMs: null,
      lastError: null,
      note: "standby — primary weather feed healthy",
    });
  }

  // ── OpenWeather (only if key configured) ────────────────────────────────
  const ow = await fetchOpenWeather(city.latitude, city.longitude);
  if (ow.ok && ow.data) {
    if (ow.data.rain1hMm !== null && ow.data.rain1hMm >= 0.5) {
      await ingestCandidates("openweather", [
        {
          source: "openweather",
          dataOrigin: "LIVE",
          cityId,
          eventType: "WEATHER_RAIN",
          title: `Rainfall — ${city.name} (OpenWeather)`,
          description: `OpenWeather reports ${ow.data.rain1hMm} mm rain in the last hour, ${ow.data.weatherMain ?? ""}, ${ow.data.tempC ?? "?"}°C.`,
          severity: ow.data.rain1hMm >= 7.6 ? "MAJOR" : ow.data.rain1hMm >= 2.5 ? "MODERATE" : "MINOR",
          confidence: 0.9,
          latitude: city.latitude,
          longitude: city.longitude,
          locationName: citywide,
          tags: ["rain", "openweather"],
        },
      ]);
    }
    feeds.lastStatuses.set(`${keyPrefix}openweather`, {
      feedId: `${keyPrefix}openweather`,
      status: "HEALTHY",
      lastRunAt: new Date().toISOString(),
      durationMs: ow.durationMs,
      lastError: null,
      note: "key configured",
    });
  } else {
    feeds.lastStatuses.set(`${keyPrefix}openweather`, {
      feedId: `${keyPrefix}openweather`,
      status: "DORMANT",
      lastRunAt: null,
      durationMs: null,
      lastError: null,
      note: ow.error ?? "not configured",
    });
  }
}

export async function getFeedStatuses(): Promise<FeedStatus[]> {
  const current = feeds.lastStatuses;
  const feedIds = [
    "open-meteo",
    "open-meteo-air-quality",
    "wttr-in",
    "openweather",
    "mumbai:open-meteo",
    "mumbai:open-meteo-air-quality",
    "bengaluru:open-meteo",
    "bengaluru:open-meteo-air-quality",
    "report-portal",
    "demo-scenarios",
    "simulator",
  ];
  const out: FeedStatus[] = [];
  for (const id of feedIds) {
    const inMem = current.get(id);
    if (inMem) {
      out.push(inMem);
      continue;
    }
    const baseId = id.includes(":") ? (id.split(":")[1] ?? id) : id;
    const last = await db.feedRun.findFirst({ where: { feedId: baseId }, orderBy: { createdAt: "desc" } });
    out.push({
      feedId: id,
      status: last ? (last.status === "HEALTHY" ? "HEALTHY" : "FAILED") : "DORMANT",
      lastRunAt: last ? last.createdAt.toISOString() : null,
      durationMs: last ? last.durationMs : null,
      lastError: last?.error ?? null,
      note: last ? `${last.eventsNew} new events at last run` : "has not run yet in this process",
    });
  }
  return out;
}

export function lastRunAt(): string | null {
  return feeds.lastRunAt;
}

export type { FeedId };
