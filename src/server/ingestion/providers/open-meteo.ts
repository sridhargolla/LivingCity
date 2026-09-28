// LIVING CITY — Open-Meteo weather adapter (REAL source, free, no API key).
// https://open-meteo.com/en/docs — current conditions + hourly precipitation forecast.
// Note: Open-Meteo's free tier limits per IP/day; optional API key supported via
// OPEN_METEO_API_KEY env (they support `apikey` query param for paid plans).

import { env } from "@/server/env";
import { fetchWithResilience } from "./adapter";
import { rainSeverity } from "../normalize";

export interface OpenMeteoSnapshot {
  temperatureC: number | null;
  humidityPct: number | null;
  precipMm: number | null;
  weatherCode: number | null;
  windKmh: number | null;
  cloudCover: number | null;
  observedIso: string;
  /** Max precipitation probability & expected mm over next 6 hours (forecast). */
  forecast: { maxPrecipProb: number; expectedMm: number } | null;
  raw: Record<string, unknown>;
}

export async function fetchOpenMeteo(lat = env.city.lat, lon = env.city.lon) {
  const key = process.env.OPEN_METEO_API_KEY ? `&apikey=${encodeURIComponent(process.env.OPEN_METEO_API_KEY)}` : "";
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,cloud_cover` +
    `&hourly=precipitation,precipitation_probability&forecast_hours=7&timezone=Asia%2FKolkata${key}`;

  return fetchWithResilience<OpenMeteoSnapshot>(
    "open-meteo",
    url,
    (json) => {
      const d = json as {
        current?: Record<string, number | string>;
        hourly?: { precipitation?: number[]; precipitation_probability?: number[] };
      };
      const current = d.current ?? {};
      const hourly = d.hourly ?? {};
      const futurePrecip = (hourly.precipitation ?? []).slice(1, 7);
      const futureProb = (hourly.precipitation_probability ?? []).slice(1, 7);
      const forecast =
        futurePrecip.length > 0
          ? {
              maxPrecipProb: Math.max(0, ...futureProb.filter((p) => typeof p === "number")),
              expectedMm: futurePrecip.reduce((a: number, b) => a + (typeof b === "number" ? b : 0), 0),
            }
          : null;
      return {
        temperatureC: num(current.temperature_2m),
        humidityPct: num(current.relative_humidity_2m),
        precipMm: num(current.precipitation),
        weatherCode: num(current.weather_code),
        windKmh: num(current.wind_speed_10m),
        cloudCover: num(current.cloud_cover),
        observedIso: String(current.time ?? new Date().toISOString()),
        forecast,
        raw: json as Record<string, unknown>,
      };
    },
    { timeoutMs: 12000, retries: 1 }
  );
}

function num(v: unknown): number | null {
  return typeof v === "number" && isFinite(v) ? v : null;
}

/** Map a snapshot to weather event candidates (empty array = no event-worthy conditions). */
export function openMeteoToEvents(s: OpenMeteoSnapshot): Array<{
  eventType: string;
  title: string;
  description: string;
  severity: string;
  confidence: number;
  tags: string[];
  status: string;
}> {
  const events: Array<{
    eventType: string;
    title: string;
    description: string;
    severity: string;
    confidence: number;
    tags: string[];
    status: string;
  }> = [];

  // 1. Current precipitation
  if (s.precipMm !== null && s.precipMm >= 0.5) {
    const band = rainSeverity(s.precipMm);
    events.push({
      eventType: "WEATHER_RAIN",
      title: `${band.label} — ${env.city.name}`,
      description: `Open-Meteo observed ${s.precipMm.toFixed(1)} mm/h precipitation at ${s.observedIso} (IST). Temperature ${s.temperatureC ?? "?"}°C, humidity ${s.humidityPct ?? "?"}%, wind ${s.windKmh ?? "?"} km/h. Historically associated with water accumulation and traffic slowdown on major corridors.`,
      severity: band.severity,
      confidence: 0.95,
      tags: ["rain", `precip-${s.precipMm.toFixed(1)}mm`, "open-meteo"],
      status: "ACTIVE",
    });
  }

  // 2. Thunderstorm codes (WMO 95-99)
  if (s.weatherCode !== null && s.weatherCode >= 95) {
    events.push({
      eventType: "WEATHER_STORM",
      title: `Thunderstorm Activity — ${env.city.name}`,
      description: `Open-Meteo weather code ${s.weatherCode} indicates thunderstorm conditions. Wind ${s.windKmh ?? "?"} km/h.`,
      severity: "MAJOR",
      confidence: 0.9,
      tags: ["storm", "thunder", "open-meteo"],
      status: "ACTIVE",
    });
  }

  // 3. Heat stress
  if (s.temperatureC !== null && s.temperatureC >= 40) {
    events.push({
      eventType: "WEATHER_HEAT",
      title: `Heat Stress — ${env.city.name} (${s.temperatureC.toFixed(0)}°C)`,
      description: `Open-Meteo observed ${s.temperatureC.toFixed(1)}°C ambient temperature with ${s.humidityPct ?? "?"}% humidity.`,
      severity: s.temperatureC >= 43 ? "MAJOR" : "MODERATE",
      confidence: 0.95,
      tags: ["heat", "temperature", "open-meteo"],
      status: "ACTIVE",
    });
  }

  // 4. Incoming heavy rain (forecast arm) — clearly labeled as forecast, lower confidence
  if (s.forecast && s.forecast.maxPrecipProb >= 70 && s.forecast.expectedMm >= 1.0) {
    events.push({
      eventType: "WEATHER_RAIN",
      title: `Rain Likely Within 6 Hours — ${env.city.name}`,
      description: `Open-Meteo hourly forecast shows ${s.forecast.maxPrecipProb}% max precipitation probability and ~${s.forecast.expectedMm.toFixed(1)} mm expected accumulation over the next 6 hours. This is a FORECAST signal, not observed rainfall.`,
      severity: s.forecast.expectedMm >= 7.6 ? "MODERATE" : "MINOR",
      confidence: 0.6,
      tags: ["rain", "forecast", "open-meteo"],
      status: "DEVELOPING",
    });
  }

  return events;
}
