// LIVING CITY — Server-side environment configuration.
// All credentials come from env vars. Never hardcode secrets.

function req(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  hindsight: {
    baseUrl: req("HINDSIGHT_BASE_URL", "http://localhost:8888"),
    apiKey: process.env.HINDSIGHT_API_KEY ?? "",
    bankId: req("HINDSIGHT_BANK_ID", "living-city-hyderabad"),
    enabled: (process.env.HINDSIGHT_ENABLED ?? "true") !== "false",
  },
  city: {
    name: "Hyderabad",
    lat: Number(req("CITY_LAT", "17.3850")),
    lon: Number(req("CITY_LON", "78.4867")),
  },
  weather: {
    /** OpenWeather optional — only used if WEATHER_API_KEY is set. */
    openWeatherApiKey: process.env.WEATHER_API_KEY ?? "",
  },
  ingestion: {
    pollIntervalMs: Number(req("FEED_POLL_INTERVAL_MS", "300000")), // 5 min
    disabled: process.env.FEED_POLLING_DISABLED === "true",
  },
} as const;
