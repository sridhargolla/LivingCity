// LIVING CITY — Simulated city engine (autonomous incidents + city-state cards).
//
// HONESTY: everything this module produces is data_origin=SIMULATED and is labeled
// as such everywhere it appears. City-state cards derived from simulated events are
// provenance=SIMULATED. Cards derived from real feeds are provenance=LIVE. When
// neither exists, the card honestly shows NO_DATA. Live data is never simulated,
// simulated data is never live.

import { db } from "@/lib/db";
import { publish } from "@/server/realtime/eventBus";
import { ingestCandidates, publicEvent, type CandidateInput } from "@/server/ingestion/ingest";
import { detectAnomalies } from "@/server/anomaly";
import { CITY_REGISTRY } from "@/server/cities";
import type { FeedId } from "@/server/types";

// ── Scenario generators (all SIMULATED) ──────────────────────────────────────

type Zone = { lat: number; lon: number; name: string };

/** City-relative simulated sectors (deterministic offsets from the city center).
 *  Simulated locations are generic sector labels — never real neighborhoods —
 *  so a simulated event can never masquerade as a real local observation. */
function sectorsFor(cityLat: number, cityLon: number, cityName: string): Record<string, Zone> {
  const mk = (dLat: number, dLon: number, sector: string): Zone => ({
    lat: cityLat + dLat,
    lon: cityLon + dLon,
    name: `${cityName} — ${sector} sector (simulated)`,
  });
  return {
    northwest: mk(0.05, -0.05, "North-West"),
    central: mk(0, 0, "Central"),
    northeast: mk(0.05, 0.05, "North-East"),
    east: mk(0, 0.07, "East"),
    oldcity: mk(-0.04, 0.01, "South-Central"),
    west: mk(0.01, -0.08, "West"),
  };
}

export const SCENARIO_KEYS = [
  "heavy_rain",
  "emergency",
  "transit_delay",
  "grid_alert",
  "road_closure",
  "crowd",
  "clearing_weather",
] as const;
export type ScenarioKey = (typeof SCENARIO_KEYS)[number];

export const SCENARIO_LABELS: Record<ScenarioKey, string> = {
  heavy_rain: "Heavy Rain",
  emergency: "Emergency",
  transit_delay: "Transit Delay",
  grid_alert: "Grid Alert",
  road_closure: "Road Closure",
  crowd: "Crowd Build-up",
  clearing_weather: "Clearing Weather",
};

function scenarioToCandidates(key: ScenarioKey, cityId: string): CandidateInput[] {
  const city = CITY_REGISTRY.find((c) => c.cityId === cityId) ?? CITY_REGISTRY[0];
  const ZONES = sectorsFor(city.latitude, city.longitude, city.name);
  const zoneKeys = Object.keys(ZONES);
  const zone = ZONES[zoneKeys[Math.floor(Math.random() * zoneKeys.length)]];
  const runId = `sim-${Date.now().toString(36)}`;

  switch (key) {
    case "heavy_rain":
      return [
        {
          source: "simulator",
          dataOrigin: "SIMULATED",
          cityId,
          eventType: "WEATHER_RAIN",
          title: `Heavy Rainfall — ${zone.name}`,
          description: `Simulated heavy rainfall: 12-16 mm/h over ${zone.name} for the next 3 hours. Humidity 90%, wind 20 km/h.`,
          severity: "MAJOR",
          confidence: 0.9,
          latitude: zone.lat,
          longitude: zone.lon,
          locationName: zone.name,
          tags: ["simulated", "rain", `city:${city.cityId}`],
          metadata: { precipMm: 14, zone: zone.name, scenario: key },
          fingerprintSalt: runId,
        },
      ];
    case "emergency":
      return [
        {
          source: "simulator",
          dataOrigin: "SIMULATED",
          cityId,
          eventType: "PUBLIC_SAFETY",
          title: `Emergency Response — ${zone.name}`,
          description: `Simulated emergency: two-vehicle collision reported on the main arterial road near ${zone.name}. Emergency services en route.`,
          severity: "MAJOR",
          confidence: 0.85,
          latitude: zone.lat + 0.004,
          longitude: zone.lon - 0.003,
          locationName: zone.name,
          tags: ["simulated", "emergency", `city:${city.cityId}`],
          metadata: { category: "emergency", scenario: key },
          fingerprintSalt: runId,
        },
      ];
    case "transit_delay":
      return [
        {
          source: "simulator",
          dataOrigin: "SIMULATED",
          cityId,
          eventType: "BUS_DELAY",
          title: `Transit Delays — ${zone.name}`,
          description: `Simulated transit disruption: bus routes through ${zone.name} running 15-25 minutes behind schedule.`,
          severity: "MINOR",
          confidence: 0.85,
          latitude: zone.lat,
          longitude: zone.lon,
          locationName: zone.name,
          tags: ["simulated", "transit", `city:${city.cityId}`],
          metadata: { delayMinutes: 20, scenario: key },
          fingerprintSalt: runId,
        },
      ];
    case "grid_alert":
      return [
        {
          source: "simulator",
          dataOrigin: "SIMULATED",
          cityId,
          eventType: "POWER_OUTAGE",
          title: `Grid Alert — ${zone.name}`,
          description: `Simulated grid alert: localized power interruption affecting parts of ${zone.name}. Restoration estimated within 90 minutes.`,
          severity: "MODERATE",
          confidence: 0.85,
          latitude: zone.lat - 0.003,
          longitude: zone.lon + 0.004,
          locationName: zone.name,
          tags: ["simulated", "grid", `city:${city.cityId}`],
          metadata: { category: "grid", scenario: key },
          fingerprintSalt: runId,
        },
      ];
    case "road_closure":
      return [
        {
          source: "simulator",
          dataOrigin: "SIMULATED",
          cityId,
          eventType: "ROAD_INCIDENT",
          title: `Road Closure — ${zone.name}`,
          description: `Simulated road closure: lane restrictions on the ${zone.name} corridor for carriageworks. Diversion in effect.`,
          severity: "MODERATE",
          confidence: 0.9,
          latitude: zone.lat + 0.006,
          longitude: zone.lon + 0.006,
          locationName: zone.name,
          tags: ["simulated", "closure", `city:${city.cityId}`],
          metadata: { category: "closure", scenario: key },
          fingerprintSalt: runId,
        },
      ];
    case "crowd":
      return [
        {
          source: "simulator",
          dataOrigin: "SIMULATED",
          cityId,
          eventType: "PUBLIC_SAFETY",
          title: `Crowd Build-up — ${zone.name}`,
          description: `Simulated crowd build-up near a public event venue in ${zone.name}. Footfall above typical levels for this hour.`,
          severity: "MINOR",
          confidence: 0.8,
          latitude: zone.lat - 0.005,
          longitude: zone.lon - 0.005,
          locationName: zone.name,
          tags: ["simulated", "crowd", `city:${city.cityId}`],
          metadata: { category: "crowd", scenario: key },
          fingerprintSalt: runId,
        },
      ];
    case "clearing_weather": {
      // Resolve active simulated rain events + one "clearing" observation
      return [
        {
          source: "simulator",
          dataOrigin: "SIMULATED",
          cityId,
          eventType: "WEATHER_RAIN",
          title: `Weather Clearing — ${city.name}`,
          description: "Simulated observation: rainfall weakening across the city, skies clearing over the next hour.",
          severity: "INFO",
          confidence: 0.85,
          latitude: city.latitude,
          longitude: city.longitude,
          locationName: `${city.name} (citywide)`,
          tags: ["simulated", "clearing", `city:${city.cityId}`],
          metadata: { scenario: key },
          fingerprintSalt: runId,
        },
      ];
    }
  }
}

// ── Autonomous mode ──────────────────────────────────────────────────────────

const globalForSim = globalThis as unknown as {
  __livingCitySimulator?: { running: boolean; timer: NodeJS.Timeout | null; cityId: string; intervalMs: number; lastScenario: string | null; runCount: number };
};

const sim = (globalForSim.__livingCitySimulator ??= {
  running: false,
  timer: null,
  cityId: "hyderabad",
  intervalMs: 90_000,
  lastScenario: null,
  runCount: 0,
});

async function runScenarioOnce(cityId: string, key?: ScenarioKey): Promise<{ scenario: ScenarioKey; eventIds: string[] } | null> {
  const k: ScenarioKey = key ?? SCENARIO_KEYS[Math.floor(Math.random() * SCENARIO_KEYS.length)];
  const candidates = scenarioToCandidates(k, cityId);

  if (k === "clearing_weather") {
    // resolve active SIMULATED rain events for this city (honest lifecycle)
    const activeRain = await db.cityEvent.findMany({
      where: { cityId, eventType: "WEATHER_RAIN", dataOrigin: "SIMULATED", status: { in: ["ACTIVE", "DEVELOPING"] } },
      take: 5,
    });
    for (const r of activeRain) {
      await db.cityEvent.update({ where: { id: r.id }, data: { status: "RESOLVED", resolvedAt: new Date() } });
      publish("event.updated", { event: { ...publicEvent({ ...r, status: "RESOLVED", resolvedAt: new Date() }), status: "RESOLVED" } });
    }
  }

  const result = await ingestCandidates("simulator" as FeedId, candidates);
  if (result.accepted > 0) {
    sim.lastScenario = k;
    sim.runCount += 1;
    publish("city.state.updated", { cityId });
    await detectAnomalies(cityId).catch(() => undefined);
    return { scenario: k, eventIds: result.eventIds };
  }
  return null;
}

export function startSimulator(cityId: string, intervalMs?: number): { running: boolean; intervalMs: number } {
  if (sim.timer) clearInterval(sim.timer);
  sim.cityId = cityId;
  sim.intervalMs = Math.max(intervalMs ?? sim.intervalMs, 30_000);
  sim.running = true;
  sim.timer = setInterval(() => {
    runScenarioOnce(sim.cityId).catch((e) => console.error("[simulator] autonomous run failed", e));
  }, sim.intervalMs);
  console.log(`[simulator] autonomous simulated incidents started (city=${sim.cityId}, every ${sim.intervalMs / 1000}s)`);
  return { running: true, intervalMs: sim.intervalMs };
}

export function stopSimulator(): { running: boolean } {
  if (sim.timer) clearInterval(sim.timer);
  sim.timer = null;
  sim.running = false;
  console.log("[simulator] autonomous simulated incidents stopped");
  return { running: false };
}

export function simulatorStatus() {
  return { running: sim.running, cityId: sim.cityId, intervalMs: sim.intervalMs, lastScenario: sim.lastScenario, runCount: sim.runCount };
}

export async function triggerScenario(cityId: string, key: ScenarioKey) {
  return runScenarioOnce(cityId, key);
}

// ── City state cards (operator dashboard) ────────────────────────────────────

export interface CityStateCard {
  key: string;
  label: string;
  value: string;
  level: number; // 0..1 stress level for gauge
  provenance: "LIVE" | "SIMULATED" | "USER_REPORTED" | "NO_DATA";
  note: string;
}

const SEV_WEIGHT: Record<string, number> = { INFO: 0.05, MINOR: 0.15, MODERATE: 0.35, MAJOR: 0.6, CRITICAL: 0.9 };

function deriveFromEvents(events: Array<{ severity: string; dataOrigin: string; eventType: string }>): { level: number; provenance: CityStateCard["provenance"] } {
  let level = 0;
  const origins = new Set<string>();
  for (const e of events) {
    level += SEV_WEIGHT[e.severity] ?? 0.1;
    origins.add(e.dataOrigin);
  }
  let provenance: CityStateCard["provenance"] = "NO_DATA";
  if (origins.size === 1) provenance = [...origins][0] as CityStateCard["provenance"];
  else if (origins.size > 1) provenance = origins.has("SIMULATED") ? "SIMULATED" : ([...origins][0] as CityStateCard["provenance"]);
  return { level: Math.min(level, 1), provenance };
}

/** Test seam — exposes the provenance derivation for invariant tests. */
export const deriveFromEventsForTest = deriveFromEvents;

/** Compute the operator dashboard cards from ACTUAL stored events — nothing invented. */
export async function getCityState(cityId: string): Promise<{ cityId: string; cards: CityStateCard[]; simulator: ReturnType<typeof simulatorStatus>; updatedAt: string }> {
  const active = await db.cityEvent.findMany({
    where: { cityId, status: { in: ["ACTIVE", "DEVELOPING"] } },
    orderBy: { observedAt: "desc" },
    take: 40,
  });

  const latestLiveWeather = await db.cityEvent.findFirst({
    where: { cityId, dataOrigin: "LIVE", eventType: { startsWith: "WEATHER" } },
    orderBy: { observedAt: "desc" },
  });
  const latestAq = await db.cityEvent.findFirst({
    where: { cityId, dataOrigin: "LIVE", eventType: "AIR_QUALITY" },
    orderBy: { observedAt: "desc" },
  });

  const cards: CityStateCard[] = [];

  // Weather — LIVE only
  if (latestLiveWeather) {
    let desc = "conditions nominal";
    try {
      const m = JSON.parse(latestLiveWeather.metadata) as Record<string, unknown>;
      if (typeof m.weatherDesc === "string") desc = m.weatherDesc;
      if (typeof m.precipMm === "number" && m.precipMm > 0) desc += `, ${m.precipMm} mm/h rain`;
      if (typeof m.temperatureC === "number") desc += `, ${m.temperatureC}°C`;
    } catch {}
    cards.push({
      key: "weather",
      label: "Weather",
      value: desc.slice(0, 40),
      level: latestLiveWeather.severity === "MAJOR" || latestLiveWeather.severity === "CRITICAL" ? 0.7 : 0.15,
      provenance: "LIVE",
      note: `Open-Meteo feed · observed ${latestLiveWeather.observedAt.toISOString().slice(11, 16)} UTC`,
    });
  } else {
    cards.push({ key: "weather", label: "Weather", value: "—", level: 0, provenance: "NO_DATA", note: "no live weather observation on record" });
  }

  // Air quality — LIVE only
  if (latestAq) {
    let aqi = "—";
    try {
      const m = JSON.parse(latestAq.metadata) as Record<string, unknown>;
      if (typeof m.usAqi === "number") aqi = `AQI ${m.usAqi}`;
    } catch {}
    cards.push({
      key: "air_quality",
      label: "Air Quality",
      value: aqi,
      level: Math.min(((parseInt(aqi.replace(/\D/g, ""), 10) || 0) / 200), 1),
      provenance: "LIVE",
      note: `Open-Meteo CAMS feed · observed ${latestAq.observedAt.toISOString().slice(11, 16)} UTC`,
    });
  } else {
    cards.push({ key: "air_quality", label: "Air Quality", value: "—", level: 0, provenance: "NO_DATA", note: "no live air-quality observation on record" });
  }

  // Traffic — derived from real stored disruption events (any origin, labeled)
  const trafficEvents = active.filter((e) => e.eventType === "TRAFFIC_DISRUPTION" || e.eventType === "ROAD_INCIDENT");
  const t = deriveFromEvents(trafficEvents);
  cards.push({
    key: "traffic",
    label: "Traffic",
    value: trafficEvents.length === 0 ? "nominal" : `${trafficEvents.length} disruption${trafficEvents.length > 1 ? "s" : ""} active`,
    level: t.level,
    provenance: t.provenance,
    note: trafficEvents.length === 0 ? "no live traffic provider configured — no disruption events on record" : `derived from ${trafficEvents.length} stored event(s)`,
  });

  // Transit
  const transitEvents = active.filter((e) => e.eventType === "BUS_DELAY");
  const tr = deriveFromEvents(transitEvents);
  cards.push({
    key: "transit",
    label: "Transit",
    value: transitEvents.length === 0 ? "nominal" : `${transitEvents.length} delay event${transitEvents.length > 1 ? "s" : ""}`,
    level: tr.level,
    provenance: tr.provenance,
    note: transitEvents.length === 0 ? "no live transit provider configured — no delay events on record" : `derived from ${transitEvents.length} stored event(s)`,
  });

  // Grid
  const gridEvents = active.filter((e) => e.eventType === "POWER_OUTAGE");
  const g = deriveFromEvents(gridEvents);
  cards.push({
    key: "grid",
    label: "Grid",
    value: gridEvents.length === 0 ? "nominal" : `${gridEvents.length} alert${gridEvents.length > 1 ? "s" : ""}`,
    level: g.level,
    provenance: g.provenance,
    note: gridEvents.length === 0 ? "no live grid provider configured" : `derived from ${gridEvents.length} stored event(s)`,
  });

  // Hospital / emergency load
  const hospEvents = active.filter((e) => e.eventType === "PUBLIC_SAFETY");
  const h = deriveFromEvents(hospEvents);
  cards.push({
    key: "hospital",
    label: "Emergency Load",
    value: hospEvents.length === 0 ? "nominal" : `${hospEvents.length} active incident${hospEvents.length > 1 ? "s" : ""}`,
    level: h.level,
    provenance: h.provenance,
    note: hospEvents.length === 0 ? "no hospital-bed feed configured — no emergency events on record" : `derived from ${hospEvents.length} stored event(s)`,
  });

  return {
    cityId,
    cards,
    simulator: simulatorStatus(),
    updatedAt: new Date().toISOString(),
  };
}
