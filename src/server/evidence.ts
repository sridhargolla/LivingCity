// LIVING CITY — Evidence / provenance system (PHASE 4).
//
// Every factual claim shown by the UI or the copilot must be traceable to a stored
// event and its source. Evidence objects are built DETERMINISTICALLY from stored
// events — they are never invented. If there is no stored observation, there is no
// evidence, and the honest answer is "I don't have verified evidence for that."

import { db } from "@/lib/db";
import type { PublicEvent } from "@/server/ingestion/ingest";

/** Verified source registry — only these sources are recognized as evidence origins.
 *  sourceUrl points at the provider's real API/homepage, not an invented deep link. */
export const SOURCE_INFO: Record<string, { name: string; url: string; kind: "LIVE" | "OPERATOR" | "SIMULATION" }> = {
  "open-meteo": { name: "Open-Meteo Forecast API", url: "https://open-meteo.com/", kind: "LIVE" },
  "open-meteo-air-quality": { name: "Open-Meteo Air Quality API (CAMS data)", url: "https://open-meteo.com/en/docs/air-quality-api", kind: "LIVE" },
  "wttr.in": { name: "wttr.in weather service", url: "https://wttr.in", kind: "LIVE" },
  openweather: { name: "OpenWeather Current Weather API", url: "https://openweathermap.org/api", kind: "LIVE" },
  operator: { name: "City operator report", url: "", kind: "OPERATOR" },
  "report-portal": { name: "City operator report", url: "", kind: "OPERATOR" },
  "demo-scenarios": { name: "Built-in simulation engine", url: "", kind: "SIMULATION" },
  simulator: { name: "Built-in simulation engine", url: "", kind: "SIMULATION" },
};

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
  /** Compact raw-observation snapshot (from event metadata) — never a full payload dump. */
  raw: Record<string, unknown>;
}

/** Build evidence for one stored event. Deterministic — the evidence IS the stored record. */
export function buildEvidenceForEvent(e: {
  id: string;
  source: string;
  dataOrigin: string;
  eventType: string;
  title: string;
  description: string;
  locationName: string;
  latitude: number | null;
  longitude: number | null;
  severity: string;
  observedAt: Date | string;
  metadata: string;
}): EvidenceObject {
  const info = SOURCE_INFO[e.source] ?? { name: e.source, url: "", kind: "LIVE" as const };
  let raw: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(e.metadata) as Record<string, unknown>;
    // keep it small + safe: only scalar fields, no instructions
    for (const [k, v] of Object.entries(parsed)) {
      if (["number", "string", "boolean"].includes(typeof v) && String(k).length < 40) {
        raw[k] = typeof v === "string" ? v.slice(0, 120) : v;
      }
    }
  } catch {
    raw = {};
  }
  return {
    claim: e.title + (e.description ? ` — ${e.description.slice(0, 240)}` : ""),
    source: e.source,
    sourceName: info.name,
    observed_at: typeof e.observedAt === "string" ? e.observedAt : e.observedAt.toISOString(),
    location: e.locationName,
    data_origin: (["LIVE", "USER_REPORTED", "SIMULATED"].includes(e.dataOrigin) ? e.dataOrigin : "LIVE") as EvidenceObject["data_origin"],
    event_id: e.id,
    source_url: info.url || null,
    coordinates: e.latitude !== null && e.longitude !== null ? { lat: e.latitude, lon: e.longitude } : null,
    raw,
  };
}

/** Validate an externally-facing URL before the UI is allowed to open it.
 *  Only https + allowlisted registrable domains. Prevents LLM/event content from
 *  forcing navigation to untrusted destinations. */
const REGISTRABLE_DOMAINS = ["open-meteo.com", "wttr.in", "openweathermap.org", "openstreetmap.org"];

export function isSafeExternalUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const host = u.host.toLowerCase();
    return REGISTRABLE_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

/** Fetch events + build evidence for the evidence dashboard. */
export async function collectEvidence(opts: {
  cityId?: string;
  origins?: string[];
  limit?: number;
}): Promise<EvidenceObject[]> {
  const events = await db.cityEvent.findMany({
    where: {
      ...(opts.cityId ? { cityId: opts.cityId } : {}),
      ...(opts.origins && opts.origins.length ? { dataOrigin: { in: opts.origins } } : {}),
    },
    orderBy: { observedAt: "desc" },
    take: Math.min(opts.limit ?? 40, 100),
  });
  return events.map((e) => buildEvidenceForEvent(e));
}

/** Resolve "show me the evidence" — evidence for a specific event or the latest relevant one. */
export async function evidenceForEventId(eventId: string): Promise<EvidenceObject | null> {
  const e = await db.cityEvent.findUnique({ where: { id: eventId } });
  return e ? buildEvidenceForEvent(e) : null;
}

export type { PublicEvent };
