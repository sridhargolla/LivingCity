// LIVING CITY — wttr.in weather adapter (REAL source, free, no key) — fallback provider.
// https://wttr.in/:help — JSON current conditions. Community service; may be flaky,
// so it is a FALLBACK, never primary. Health tracking reports failures honestly.

import { env } from "@/server/env";
import { fetchWithResilience } from "./adapter";
import { rainSeverity } from "../normalize";

export interface WttrSnapshot {
  tempC: number | null;
  humidityPct: number | null;
  precipMm: number | null;
  cloudCover: number | null;
  windKmph: number | null;
  weatherDesc: string | null;
  observationTime: string | null;
}

export async function fetchWttr(query = env.city.name) {
  const url = `https://wttr.in/${encodeURIComponent(query)}?format=j1`;
  return fetchWithResilience<WttrSnapshot>(
    "wttr-in",
    url,
    (json) => {
      const d = json as {
        current_condition?: Array<{
          temp_C?: string;
          humidity?: string;
          precipMM?: string;
          cloudcover?: string;
          windspeedKmph?: string;
          weatherDesc?: Array<{ value?: string }>;
          observation_time?: string;
        }>;
      };
      const c = d.current_condition?.[0];
      if (!c) throw new Error("wttr.in response missing current_condition");
      return {
        tempC: fnum(c.temp_C),
        humidityPct: fnum(c.humidity),
        precipMm: fnum(c.precipMM),
        cloudCover: fnum(c.cloudcover),
        windKmph: fnum(c.windspeedKmph),
        weatherDesc: c.weatherDesc?.[0]?.value ?? null,
        observationTime: c.observation_time ?? null,
      };
    },
    { timeoutMs: 12000, retries: 1 }
  );
}

function fnum(v: string | undefined): number | null {
  const n = Number(v);
  return v !== undefined && isFinite(n) ? n : null;
}

export function wttrToEvents(s: WttrSnapshot) {
  if (s.precipMm === null || s.precipMm < 0.5) return [];
  const band = rainSeverity(s.precipMm);
  return [
    {
      eventType: "WEATHER_RAIN",
      title: `${band.label} — ${env.city.name} (wttr.in)`,
      description: `wttr.in observed ${s.precipMm.toFixed(1)} mm precipitation (${s.weatherDesc ?? "n/a"}), ${s.tempC ?? "?"}°C, humidity ${s.humidityPct ?? "?"}%.`,
      severity: band.severity,
      confidence: 0.75,
      tags: ["rain", "wttr-in"],
      status: "ACTIVE",
    },
  ];
}
