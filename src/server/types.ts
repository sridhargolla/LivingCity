// LIVING CITY — Shared domain types (canonical event model)

export type DataOrigin = "LIVE" | "SIMULATED" | "USER_REPORTED";

export type EventType =
  | "WEATHER_RAIN"
  | "WEATHER_HEAT"
  | "WEATHER_STORM"
  | "AIR_QUALITY"
  | "FLOODING_REPORT"
  | "WATERLOGGING"
  | "TRAFFIC_DISRUPTION"
  | "ROAD_INCIDENT"
  | "INFRASTRUCTURE"
  | "PUBLIC_SAFETY"
  | "BUS_DELAY"
  | "POWER_OUTAGE"
  | "USER_REPORT";

export type Severity = "INFO" | "MINOR" | "MODERATE" | "MAJOR" | "CRITICAL";

export type EventStatus = "ACTIVE" | "DEVELOPING" | "RESOLVED";

export type RelationType =
  | "RELATED"
  | "SIMILAR"
  | "RECURRING_PATTERN"
  | "POSSIBLE_ESCALATION"
  | "UNRELATED"
  | "NOVEL";

export type FeedId =
  | "open-meteo"
  | "open-meteo-air-quality"
  | "wttr-in"
  | "openweather"
  | "report-portal"
  | "demo-scenarios";

export const EVENT_TYPE_LABELS: Record<string, string> = {
  WEATHER_RAIN: "Heavy Rain",
  WEATHER_HEAT: "Heat Stress",
  WEATHER_STORM: "Thunderstorm",
  AIR_QUALITY: "Air Quality",
  FLOODING_REPORT: "Flooding Report",
  WATERLOGGING: "Water Accumulation",
  TRAFFIC_DISRUPTION: "Traffic Slowdown",
  ROAD_INCIDENT: "Road Incident",
  INFRASTRUCTURE: "Infrastructure Issue",
  PUBLIC_SAFETY: "Public Safety",
  BUS_DELAY: "Bus Delay",
  POWER_OUTAGE: "Power Outage",
  USER_REPORT: "Operator Report",
};

export const EVENT_TYPE_ICONS: Record<string, string> = {
  WEATHER_RAIN: "🌧️",
  WEATHER_HEAT: "🔥",
  WEATHER_STORM: "⛈️",
  AIR_QUALITY: "😷",
  FLOODING_REPORT: "🌊",
  WATERLOGGING: "💧",
  TRAFFIC_DISRUPTION: "🚦",
  ROAD_INCIDENT: "🚧",
  INFRASTRUCTURE: "🏗️",
  PUBLIC_SAFETY: "🚨",
  BUS_DELAY: "🚌",
  POWER_OUTAGE: "🔌",
  USER_REPORT: "📋",
};

export const SEVERITY_ORDER: Record<string, number> = {
  INFO: 0,
  MINOR: 1,
  MODERATE: 2,
  MAJOR: 3,
  CRITICAL: 4,
};

/** Hyderabad operational zones used for coarse location naming / memory scoping. */
export interface CityZone {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export const HYDERABAD_ZONES: CityZone[] = [
  { id: "west", name: "Western Corridor (Gachibowli · Kukatpally)", lat: 17.4401, lon: 78.3489 },
  { id: "central", name: "Central Hyderabad (Abids · Nampally)", lat: 17.3850, lon: 78.4867 },
  { id: "north", name: "North Hyderabad (Kompally · Alwal)", lat: 17.5400, lon: 78.4900 },
  { id: "east", name: "East Hyderabad (Uppal · Ghatkesar)", lat: 17.4000, lon: 78.5600 },
  { id: "oldcity", name: "Old City (Charminar · Falaknuma)", lat: 17.3616, lon: 78.4747 },
  { id: "secunderabad", name: "Secunderabad (Paradise · Tarnaka)", lat: 17.4399, lon: 78.4983 },
  { id: "south", name: "South Hyderabad (Shamshabad · Attapur)", lat: 17.2403, lon: 78.4294 },
];

export function nearestZone(lat: number, lon: number): CityZone {
  let best = HYDERABAD_ZONES[0];
  let bestD = Number.POSITIVE_INFINITY;
  for (const z of HYDERABAD_ZONES) {
    const d = (z.lat - lat) ** 2 + (z.lon - lon) ** 2;
    if (d < bestD) {
      bestD = d;
      best = z;
    }
  }
  return best;
}

/** The 2km-grid bucket used for event dedup fingerprints. */
export function locationBucket(lat: number, lon: number): string {
  return `${(Math.round(lat * 50) / 50).toFixed(2)}:${(Math.round(lon * 50) / 50).toFixed(2)}`;
}
