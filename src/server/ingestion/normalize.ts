// LIVING CITY — Event normalization + deduplication + validation.
// No LLM here: normalization, dedup and validation are deterministic by design.

import { createHash } from "crypto";
import { locationBucket } from "@/server/types";

export interface NormalizedEvent {
  source: string;
  sourceEventId: string | null;
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
  startedAt: Date;
  observedAt: Date;
  tags: string[];
  metadata: Record<string, unknown>;
  fingerprint: string;
}

const HYD_BOUNDING = { minLat: 17.1, maxLat: 17.75, minLon: 78.1, maxLon: 78.85 };

export function isWithinHyderabad(lat: number, lon: number): boolean {
  return lat >= HYD_BOUNDING.minLat && lat <= HYD_BOUNDING.maxLat && lon >= HYD_BOUNDING.minLon && lon <= HYD_BOUNDING.maxLon;
}

/** Severity band keeps fingerprints stable across minor sensor jitter. */
export function severityBand(severity: string): string {
  switch (severity) {
    case "INFO":
    case "MINOR":
      return "low";
    case "MODERATE":
      return "moderate";
    default:
      return "high";
  }
}

export function makeFingerprint(parts: {
  source: string;
  eventType: string;
  severity: string;
  at: Date;
  lat: number | null;
  lon: number | null;
  salt?: string;
}): string {
  const day = new Date(parts.at).toISOString().slice(0, 10);
  const loc =
    parts.lat !== null && parts.lon !== null && isFinite(parts.lat) && isFinite(parts.lon)
      ? locationBucket(parts.lat, parts.lon)
      : "citywide";
  const raw = `${parts.source}|${parts.eventType}|${severityBand(parts.severity)}|${day}|${loc}${parts.salt ? `|${parts.salt}` : ""}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Strip control characters, collapse whitespace, hard-limit length. */
export function sanitizeText(input: string, maxLen = 1000): string {
  return String(input ?? "")
    .replace(CONTROL_CHARS, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

export function clampConfidence(c: number): number {
  if (!isFinite(c)) return 0.5;
  return Math.min(1, Math.max(0, c));
}

export function validSeverity(s: string): string {
  return ["INFO", "MINOR", "MODERATE", "MAJOR", "CRITICAL"].includes(s) ? s : "INFO";
}

/** Build a NormalizedEvent with validation + dedup fingerprint. Returns null when invalid. */
export function buildNormalizedEvent(input: {
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
  /** Optional salt — used by the demo engine so each controlled run is distinct. */
  fingerprintSalt?: string;
}): NormalizedEvent | null {
  const title = sanitizeText(input.title, 200);
  if (!title) return null;
  if (!input.eventType) return null;

  let lat: number | null = null;
  let lon: number | null = null;
  if (
    typeof input.latitude === "number" &&
    typeof input.longitude === "number" &&
    isFinite(input.latitude) &&
    isFinite(input.longitude) &&
    !(input.latitude === 0 && input.longitude === 0)
  ) {
    lat = input.latitude;
    lon = input.longitude;
  } else if (typeof input.latitude === "number" || typeof input.longitude === "number") {
    // Partial coordinates are invalid; do not guess.
    lat = null;
    lon = null;
  }

  const startedAt = input.startedAt ?? new Date();
  const severity = validSeverity(input.severity ?? "INFO");

  return {
    source: sanitizeText(input.source, 80),
    sourceEventId: input.sourceEventId ? sanitizeText(input.sourceEventId, 200) : null,
    dataOrigin: input.dataOrigin,
    eventType: input.eventType,
    title,
    description: sanitizeText(input.description ?? "", 2000),
    latitude: lat,
    longitude: lon,
    locationName: sanitizeText(input.locationName ?? "Hyderabad", 200),
    severity,
    confidence: clampConfidence(input.confidence ?? 0.8),
    status: input.status ?? "ACTIVE",
    startedAt,
    observedAt: input.observedAt ?? new Date(),
    tags: (input.tags ?? []).slice(0, 12).map((t) => sanitizeText(t, 40)).filter(Boolean),
    metadata: input.metadata ?? {},
    fingerprint: makeFingerprint({
      source: input.source,
      eventType: input.eventType,
      severity,
      at: startedAt,
      lat,
      lon,
      salt: input.fingerprintSalt,
    }),
  };
}

/** Derive rain severity from hourly precipitation (mm/h) — IMD-informed bands. */
export function rainSeverity(precipMm: number): { severity: string; label: string } {
  if (precipMm >= 15.1) return { severity: "CRITICAL", label: "Extremely Heavy Rainfall" };
  if (precipMm >= 7.6) return { severity: "MAJOR", label: "Heavy Rainfall" };
  if (precipMm >= 2.5) return { severity: "MODERATE", label: "Moderate Rainfall" };
  if (precipMm >= 0.5) return { severity: "MINOR", label: "Light Rainfall" };
  return { severity: "INFO", label: "Drizzle" };
}

/** Derive air-quality severity from US AQI. */
export function aqiSeverity(usAqi: number): { severity: string; label: string; category: string } {
  if (usAqi >= 200) return { severity: "CRITICAL", label: "Air Quality (Very Unhealthy)", category: "Very Unhealthy" };
  if (usAqi >= 150) return { severity: "MAJOR", label: "Air Quality (Unhealthy)", category: "Unhealthy" };
  if (usAqi >= 100) return { severity: "MODERATE", label: "Air Quality (Unhealthy for Sensitive Groups)", category: "Unhealthy for Sensitive Groups" };
  if (usAqi >= 51) return { severity: "MINOR", label: "Air Quality (Moderate)", category: "Moderate" };
  return { severity: "INFO", label: "Air Quality (Good)", category: "Good" };
}
