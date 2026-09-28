// LIVING CITY — Multi-city registry (PHASE 14).
//
// Cities are configuration, not hardcoded assumptions. Each city owns:
//   - its events (CityEvent.cityId)
//   - its Hindsight memory bank (living-city-<cityId>)  → CITY A MEMORY ≠ CITY B MEMORY
//   - its provider availability
//
// HONESTY RULE: a city only appears as "live-capable" when its providers actually
// work for its coordinates. Open-Meteo (weather + air quality) is a free global API,
// so the configured cities are genuinely live-capable. Cities must never be shown
// with fabricated live data.

import { db } from "@/lib/db";

export interface CityConfig {
  cityId: string;
  name: string;
  country: string;
  timezone: string;
  latitude: number;
  longitude: number;
  /** The initially configured city (Hyderabad). */
  primary: boolean;
  /** Providers genuinely available for this city's coordinates. */
  providers: {
    weather: boolean; // open-meteo / wttr.in fallback / openweather if keyed
    airQuality: boolean; // open-meteo air quality
    traffic: boolean; // NO free legitimate provider configured → false (honest)
    transit: boolean; // NO free legitimate provider configured → false (honest)
  };
}

export const CITY_REGISTRY: CityConfig[] = [
  {
    cityId: "hyderabad",
    name: "Hyderabad",
    country: "India",
    timezone: "Asia/Kolkata",
    latitude: 17.385,
    longitude: 78.4867,
    primary: true,
    providers: { weather: true, airQuality: true, traffic: false, transit: false },
  },
  {
    cityId: "mumbai",
    name: "Mumbai",
    country: "India",
    timezone: "Asia/Kolkata",
    latitude: 19.076,
    longitude: 72.8777,
    primary: false,
    providers: { weather: true, airQuality: true, traffic: false, transit: false },
  },
  {
    cityId: "bengaluru",
    name: "Bengaluru",
    country: "India",
    timezone: "Asia/Kolkata",
    latitude: 12.9716,
    longitude: 77.5946,
    primary: false,
    providers: { weather: true, airQuality: true, traffic: false, transit: false },
  },
];

export function getCityConfig(cityId: string): CityConfig {
  return CITY_REGISTRY.find((c) => c.cityId === cityId) ?? CITY_REGISTRY[0];
}

/** Hindsight memory bank for a city. City banks are strictly isolated. */
export function bankIdForCity(cityId: string): string {
  return `living-city-${getCityConfig(cityId).cityId}`;
}

/** Sync registry → DB (idempotent, runs at boot). */
export async function syncCities(): Promise<void> {
  for (const c of CITY_REGISTRY) {
    await db.city.upsert({
      where: { cityId: c.cityId },
      create: {
        cityId: c.cityId,
        name: c.name,
        country: c.country,
        timezone: c.timezone,
        latitude: c.latitude,
        longitude: c.longitude,
        primary: c.primary,
        config: JSON.stringify({ providers: c.providers }),
      },
      update: {
        name: c.name,
        country: c.country,
        timezone: c.timezone,
        latitude: c.latitude,
        longitude: c.longitude,
        primary: c.primary,
        config: JSON.stringify({ providers: c.providers }),
      },
    });
  }
}

export async function listCities(): Promise<Array<CityConfig & { eventCount?: number }>> {
  return CITY_REGISTRY;
}
