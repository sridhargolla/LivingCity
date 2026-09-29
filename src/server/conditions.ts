// LIVING CITY — Shared live city conditions layer.
//
// ONE underlying data system consumed by Dashboard, Live City, Live Events,
// Analytics and the Copilot. No page maintains its own data source.
//
// Honesty contract:
//   - A metric is only ever LIVE when a verified provider returned real data.
//   - Traffic / Transit have NO free legitimate provider configured → they are
//     reported as UNAVAILABLE ("Data Unavailable"), never filled with numbers.
//   - Alerts are derived deterministically from real provider observations and
//     always link back to the stored event that carries the evidence.

import { db } from "@/lib/db";
import { fetchOpenMeteo, type OpenMeteoSnapshot } from "@/server/ingestion/providers/open-meteo";
import { fetchAirQuality, type AirQualitySnapshot } from "@/server/ingestion/providers/open-meteo-air-quality";
import { getCityConfig } from "@/server/cities";
import { HindsightMemoryService } from "@/server/hindsight/HindsightMemoryService";
import { getFeedStatuses } from "@/server/ingestion/runFeeds";
import { publicEvent } from "@/server/ingestion/ingest";

export type MetricStatus = "LIVE" | "DEGRADED" | "UNAVAILABLE";

export interface MetricCard {
  key: string;
  label: string;
  status: MetricStatus;
  value: string;
  detail: string;
  observedAt: string | null;
  source: string | null;
  sourceUrl: string | null;
  /** 0..1 — for optional gauge rendering. null when no numeric value. */
  level: number | null;
  note: string;
}

export interface CityAlert {
  id: string;
  eventId: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  observedAt: string;
  source: string;
  sourceUrl: string | null;
}

export type CityEventPublic = ReturnType<typeof publicEvent>;

export interface CityOverview {
  cityId: string;
  cityName: string;
  timezone: string;
  coordinates: { lat: number; lon: number };
  metrics: {
    weather: MetricCard;
    airQuality: MetricCard;
    traffic: MetricCard;
    transit: MetricCard;
  };
  weatherDetail: {
    temperatureC: number | null;
    humidityPct: number | null;
    precipMm: number | null;
    windKmh: number | null;
    cloudCover: number | null;
    condition: string;
    forecast: { maxPrecipProb: number; expectedMm: number } | null;
  } | null;
  airQualityDetail: { usAqi: number | null; pm25: number | null; pm10: number | null; category: string } | null;
  alerts: CityAlert[];
  activeIncidents: number;
  recentEvents: CityEventPublic[];
  hindsight: { available: boolean; bankId: string; detail?: string };
  feeds: Awaited<ReturnType<typeof getFeedStatuses>>;
  lastUpdated: string;
}

// ── Weather code descriptions (WMO) ───────────────────────────────────────────
const WMO: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Depositing rime fog",
  51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
  56: "Light freezing drizzle", 57: "Dense freezing drizzle",
  61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
  66: "Light freezing rain", 67: "Heavy freezing rain",
  71: "Slight snowfall", 73: "Moderate snowfall", 75: "Heavy snowfall",
  77: "Snow grains",
  80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
  85: "Slight snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
};
function wmoDesc(code: number | null): string {
  if (code === null) return "Unknown";
  return WMO[code] ?? `Weather code ${code}`;
}

export function aqiCategory(usAqi: number | null): string {
  if (usAqi === null) return "Unknown";
  if (usAqi <= 50) return "Good";
  if (usAqi <= 100) return "Moderate";
  if (usAqi <= 150) return "Unhealthy for sensitive groups";
  if (usAqi <= 200) return "Unhealthy";
  if (usAqi <= 300) return "Very unhealthy";
  return "Hazardous";
}

// ── Per-process cache (local memory caching; no external middleware) ─────────
interface CacheEntry<T> { data: T; at: number }
const globalForCache = globalThis as unknown as {
  __livingCityConditions?: {
    weather: Map<string, CacheEntry<FetchResult<OpenMeteoSnapshot>>>;
    air: Map<string, CacheEntry<FetchResult<AirQualitySnapshot>>>;
    hindsight: CacheEntry<{ available: boolean; bankId: string; detail?: string }> | null;
  };
};
const cache = (globalForCache.__livingCityConditions ??= {
  weather: new Map(),
  air: new Map(),
  hindsight: null,
});

interface FetchResult<T> { ok: boolean; data: T | null; error?: string; durationMs: number }

const WEATHER_TTL_MS = 90_000; // free-tier friendly, still "live"
const AIR_TTL_MS = 300_000;
const HINDSIGHT_TTL_MS = 60_000;

async function cachedFetch<T>(
  store: Map<string, CacheEntry<FetchResult<T>>>,
  key: string,
  ttlMs: number,
  fn: () => Promise<FetchResult<T>>
): Promise<FetchResult<T>> {
  const hit = store.get(key);
  const now = Date.now();
  if (hit && now - hit.at < ttlMs) return hit.data;
  const result = await fn();
  store.set(key, { data: result, at: now });
  return result;
}

function card(m: Omit<MetricCard, "level"> & { level?: number | null }): MetricCard {
  return { level: null, ...m };
}

export async function getCityOverview(cityId: string): Promise<CityOverview> {
  const cfg = getCityConfig(cityId);

  const [weatherRes, airRes, recentRows] = await Promise.all([
    cachedFetch(cache.weather, cityId, WEATHER_TTL_MS, () =>
      fetchOpenMeteo(cfg.latitude, cfg.longitude)
    ),
    cachedFetch(cache.air, cityId, AIR_TTL_MS, () => fetchAirQuality(cfg.latitude, cfg.longitude)),
    db.cityEvent.findMany({
      where: { cityId, dataOrigin: { not: "SIMULATED" } },
      orderBy: { observedAt: "desc" },
      take: 40,
    }),
  ]);

  const recentEvents = recentRows.map(publicEvent);
  const active = recentEvents.filter((e) => e.status === "ACTIVE" || e.status === "DEVELOPING");

  // ── Weather metric ─────────────────────────────────────────────────────────
  const w = weatherRes.ok ? weatherRes.data : null;
  const weather: MetricCard = w
    ? card({
        key: "weather",
        label: "Weather",
        status: "LIVE",
        value: w.temperatureC !== null ? `${Math.round(w.temperatureC)}°C` : "—",
        detail: `${wmoDesc(w.weatherCode)}${w.precipMm !== null && w.precipMm > 0 ? ` · ${w.precipMm.toFixed(1)} mm/h rain` : ""}${w.humidityPct !== null ? ` · ${Math.round(w.humidityPct)}% humidity` : ""}`,
        observedAt: w.observedIso,
        source: "Open-Meteo",
        sourceUrl: "https://open-meteo.com/",
        note: "Verified live provider (free, no key).",
      })
    : card({
        key: "weather",
        label: "Weather",
        status: "UNAVAILABLE",
        value: "Data Unavailable",
        detail: weatherRes.error ? `Provider error: ${weatherRes.error.slice(0, 120)}` : "No verified live provider response.",
        observedAt: null,
        source: null,
        sourceUrl: null,
        note: "Not fabricated. Will retry on next poll.",
      });

  // ── Air quality metric ─────────────────────────────────────────────────────
  const a = airRes.ok ? airRes.data : null;
  const airQuality: MetricCard = a
    ? card({
        key: "airQuality",
        label: "Air Quality",
        status: "LIVE",
        value: a.usAqi !== null ? `AQI ${Math.round(a.usAqi)}` : "—",
        detail: `${aqiCategory(a.usAqi)}${a.pm25 !== null ? ` · PM2.5 ${a.pm25.toFixed(0)} µg/m³` : ""}`,
        observedAt: a.observedIso,
        source: "Open-Meteo Air Quality (CAMS)",
        sourceUrl: "https://open-meteo.com/en/docs/air-quality-api",
        note: "Verified live provider (free, no key).",
      })
    : card({
        key: "airQuality",
        label: "Air Quality",
        status: "UNAVAILABLE",
        value: "Data Unavailable",
        detail: airRes.error ? `Provider error: ${airRes.error.slice(0, 120)}` : "No verified live provider response.",
        observedAt: null,
        source: null,
        sourceUrl: null,
        note: "Not fabricated. Will retry on next poll.",
      });

  // ── Traffic / Transit — no legitimate free provider is configured. ─────────
  const traffic: MetricCard = card({
    key: "traffic",
    label: "Traffic",
    status: "UNAVAILABLE",
    value: "Data Unavailable",
    detail: "No verified traffic data provider is configured for this city.",
    observedAt: null,
    source: null,
    sourceUrl: null,
    note: "We do not display estimated or fabricated traffic. Configure a licensed provider to enable this metric.",
  });
  const transit: MetricCard = card({
    key: "transit",
    label: "Transit",
    status: "UNAVAILABLE",
    value: "Data Unavailable",
    detail: "No verified transit data provider is configured for this city.",
    observedAt: null,
    source: null,
    sourceUrl: null,
    note: "We do not display estimated or fabricated transit status. Configure a licensed GTFS-RT provider to enable this metric.",
  });

  // ── Alerts — deterministic derivations from REAL stored events ─────────────
  const alertworthy = active.filter((e) => {
    if (e.severity === "MINOR" || e.severity === "INFO") {
      return e.eventType === "WEATHER_STORM";
    }
    return ["MODERATE", "MAJOR", "CRITICAL"].includes(e.severity);
  });
  const alerts: CityAlert[] = alertworthy.slice(0, 6).map((e) => ({
    id: `alert-${e.id}`,
    eventId: e.id,
    title: e.title,
    description: e.description.slice(0, 240),
    severity: e.severity,
    category: e.eventType,
    observedAt: e.observedAt,
    source: e.source,
    sourceUrl: null,
  }));

  // ── Hindsight health (cached probe) ────────────────────────────────────────
  let hindsight = cache.hindsight?.data ?? null;
  if (!hindsight || Date.now() - (cache.hindsight?.at ?? 0) > HINDSIGHT_TTL_MS) {
    const h = await HindsightMemoryService.checkHealth();
    hindsight = { available: h.available, bankId: h.bankId, detail: h.detail };
    cache.hindsight = { data: hindsight, at: Date.now() };
  }

  const feeds = (await getFeedStatuses()).filter((f) => f.feedId.includes(":") ? f.feedId.startsWith(`${cityId}:`) : cityId === "hyderabad");

  return {
    cityId,
    cityName: cfg.name,
    timezone: cfg.timezone,
    coordinates: { lat: cfg.latitude, lon: cfg.longitude },
    metrics: { weather, airQuality, traffic, transit },
    weatherDetail: w
      ? {
          temperatureC: w.temperatureC,
          humidityPct: w.humidityPct,
          precipMm: w.precipMm,
          windKmh: w.windKmh,
          cloudCover: w.cloudCover,
          condition: wmoDesc(w.weatherCode),
          forecast: w.forecast,
        }
      : null,
    airQualityDetail: a
      ? { usAqi: a.usAqi, pm25: a.pm25, pm10: a.pm10, category: aqiCategory(a.usAqi) }
      : null,
    alerts,
    activeIncidents: active.filter((e) => !["WEATHER_RAIN", "WEATHER_HEAT", "WEATHER_STORM", "AIR_QUALITY"].includes(e.eventType)).length,
    recentEvents: recentEvents.slice(0, 20),
    hindsight,
    feeds,
    lastUpdated: new Date().toISOString(),
  };
}

/** Invalidate the condition caches (called after a feed run publishes new events). */
export function invalidateConditions(cityId?: string): void {
  if (cityId) {
    cache.weather.delete(cityId);
    cache.air.delete(cityId);
  } else {
    cache.weather.clear();
    cache.air.clear();
  }
  cache.hindsight = null;
}
