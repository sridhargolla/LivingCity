// LIVING CITY — Open-Meteo Air Quality adapter (REAL source, free, no key).
// https://open-meteo.com/en/docs/air-quality-api — verified working in sandbox.

import { env } from "@/server/env";
import { fetchWithResilience } from "./adapter";
import { aqiSeverity } from "../normalize";

export interface AirQualitySnapshot {
  pm10: number | null;
  pm25: number | null;
  usAqi: number | null;
  observedIso: string;
}

export async function fetchAirQuality(lat = env.city.lat, lon = env.city.lon) {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,us_aqi&timezone=Asia%2FKolkata`;
  return fetchWithResilience<AirQualitySnapshot>(
    "open-meteo-air-quality",
    url,
    (json) => {
      const d = json as { current?: Record<string, number | string> };
      const c = d.current ?? {};
      return {
        pm10: num(c.pm10),
        pm25: num(c.pm2_5),
        usAqi: num(c.us_aqi),
        observedIso: String(c.time ?? new Date().toISOString()),
      };
    },
    { timeoutMs: 12000, retries: 1 }
  );
}

function num(v: unknown): number | null {
  return typeof v === "number" && isFinite(v) ? v : null;
}

export function airQualityToEvents(s: AirQualitySnapshot) {
  if (s.usAqi === null || s.usAqi < 51) return []; // only event-worthy when Moderate+
  const band = aqiSeverity(s.usAqi);
  return [
    {
      eventType: "AIR_QUALITY",
      title: `${band.label} — ${env.city.name}`,
      description: `US AQI ${Math.round(s.usAqi)} (${band.category}). PM2.5 ${s.pm25 ?? "?"} μg/m³, PM10 ${s.pm10 ?? "?"} μg/m³ at ${s.observedIso} (IST). Source: Open-Meteo Air Quality API (CAMS model).`,
      severity: band.severity,
      confidence: 0.9,
      tags: ["air-quality", `aqi-${Math.round(s.usAqi)}`, "open-meteo-air-quality"],
      status: "ACTIVE",
    },
  ];
}
