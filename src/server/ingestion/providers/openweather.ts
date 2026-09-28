// LIVING CITY — OpenWeather adapter (REAL source, REQUIRES API key via WEATHER_API_KEY).
// Only invoked when the key is configured. Documented limitation: key not bundled.

import { env } from "@/server/env";
import { fetchWithResilience } from "./adapter";

export interface OpenWeatherSnapshot {
  tempC: number | null;
  humidityPct: number | null;
  rain1hMm: number | null;
  weatherMain: string | null;
  observedIso: string;
}

export function isConfigured(): boolean {
  return Boolean(env.weather.openWeatherApiKey);
}

export async function fetchOpenWeather() {
  if (!isConfigured()) {
    return { ok: false as const, error: "WEATHER_API_KEY not configured — OpenWeather adapter dormant", durationMs: 0 };
  }
  const url = `https://api.openweathermap.org/data/2.5/weather?q=Hyderabad,IN&appid=${env.weather.openWeatherApiKey}&units=metric`;
  return fetchWithResilience<OpenWeatherSnapshot>(
    "openweather",
    url,
    (json) => {
      const d = json as {
        main?: { temp?: number; humidity?: number };
        rain?: { "1h"?: number };
        weather?: Array<{ main?: string }>;
        dt?: number;
      };
      return {
        tempC: typeof d.main?.temp === "number" ? d.main.temp : null,
        humidityPct: typeof d.main?.humidity === "number" ? d.main.humidity : null,
        rain1hMm: typeof d.rain?.["1h"] === "number" ? d.rain["1h"] : null,
        weatherMain: d.weather?.[0]?.main ?? null,
        observedIso: d.dt ? new Date(d.dt * 1000).toISOString() : new Date().toISOString(),
      };
    },
    { timeoutMs: 12000, retries: 0 }
  );
}
