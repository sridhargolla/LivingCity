// LIVING CITY — shared UI formatting helpers.
export const SEVERITY_COLORS: Record<string, string> = {
  INFO: "#38bdf8",
  MINOR: "#34d399",
  MODERATE: "#fbbf24",
  MAJOR: "#fb923c",
  CRITICAL: "#f87171",
};

export const ORIGIN_META: Record<string, { label: string; color: string; badge: string }> = {
  LIVE: { label: "LIVE", color: "#34d399", badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  SIMULATED: { label: "SIMULATED", color: "#c084fc", badge: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  USER_REPORTED: { label: "USER-REPORTED", color: "#fbbf24", badge: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
};

export const RISK_COLORS: Record<string, string> = {
  NONE: "#64748b",
  LOW: "#34d399",
  ELEVATED: "#fbbf24",
  HIGH: "#f87171",
};

export const RELATION_COLORS: Record<string, string> = {
  RECURRING_PATTERN: "#c084fc",
  SIMILAR: "#38bdf8",
  RELATED: "#fbbf24",
  POSSIBLE_ESCALATION: "#f87171",
  UNRELATED: "#64748b",
  NOVEL: "#34d399",
};

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function shortTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });
}

export const EVENT_ICONS: Record<string, string> = {
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
